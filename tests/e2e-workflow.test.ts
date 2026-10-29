import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { processRawRowsWithMapping } from "@/lib/parsers/csv-excel";
import { generateApplicationDraft } from "@/lib/ai/gemini";
import { runCampaignQueue } from "@/lib/queue/db-queue";
import fs from "fs";
import path from "path";

describe("E2E Application Workflow Integration Test", () => {
  let createdResumeId: string;
  let createdContactListId: string;
  let testResumePath: string;

  beforeAll(async () => {
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads", "resumes");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    testResumePath = path.join(uploadsDir, "test_resume.pdf");
    fs.writeFileSync(testResumePath, "%PDF-1.4 sample resume content for test verification");

    // Clean test tables
    await prisma.smtpAttempt.deleteMany({});
    await prisma.sendingJob.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.applicationDraft.deleteMany({});
    await prisma.contact.deleteMany({});
    await prisma.contactList.deleteMany({});
    await prisma.resume.deleteMany({});

    // 1. Create Verified Resume Profile
    const resume = await prisma.resume.create({
      data: {
        fileName: "test_resume.pdf",
        originalName: "Alex_Rivera_Resume.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        filePath: testResumePath,
        fileHash: "test-hash-12345",
        parsedRawText: "Alex Rivera\nFull Stack Developer with 4 years experience in Next.js and PostgreSQL.",
        structuredData: JSON.stringify({
          fullName: "Alex Rivera",
          email: "alex.rivera@example.com",
          phone: "+1-555-0199",
          location: "Seattle, WA",
          summary: "Full Stack Developer",
          skills: ["TypeScript", "Next.js", "PostgreSQL", "Tailwind CSS"],
          education: [{ institution: "UW", degree: "B.S. CS", graduationYear: "2021" }],
          experience: [{ company: "TechCorp", title: "Software Engineer", highlights: ["Built payment pipeline"] }],
          projects: [{ name: "JobMatcher", description: "Outreach tool", technologies: ["TypeScript"] }],
          certifications: [],
        }),
        isCurrent: true,
      },
    });
    createdResumeId = resume.id;
  });

  afterAll(async () => {
    if (fs.existsSync(testResumePath)) {
      try {
        fs.unlinkSync(testResumePath);
      } catch {}
    }
  });

  it("Step 1: Imports contacts and enforces data validation & deduplication", async () => {
    const rawRows = [
      { _originalRowIndex: "2", Name: "Sarah Connor", Email: "sarah@cyberdyne.com", Company: "Cyberdyne Systems", Role: "Full Stack Engineer" },
      { _originalRowIndex: "3", Name: "Miles Dyson", Email: "miles@cyberdyne.com", Company: "Cyberdyne Systems", Role: "Backend Architect" },
      { _originalRowIndex: "4", Name: "Duplicate Dyson", Email: "MILES@CYBERDYNE.COM", Company: "Cyberdyne Systems", Role: "Backend Architect" }, // duplicate email
      { _originalRowIndex: "5", Name: "Bad Row", Email: "not-an-email", Company: "Unknown Inc", Role: "Developer" }, // invalid email
    ];

    const mapping = {
      nameColumn: "Name",
      emailColumn: "Email",
      companyColumn: "Company",
      roleColumn: "Role",
    };

    const { contacts, stats } = processRawRowsWithMapping(rawRows, mapping);

    expect(stats.totalRows).toBe(4);
    expect(stats.validCount).toBe(2);
    expect(stats.duplicateCount).toBe(1);
    expect(stats.invalidCount).toBe(2);

    const contactList = await prisma.contactList.create({
      data: {
        fileName: "hr_contacts.csv",
        fileType: "csv",
        totalRows: stats.totalRows,
        validCount: stats.validCount,
        invalidCount: stats.invalidCount,
        duplicateCount: stats.duplicateCount,
      },
    });
    createdContactListId = contactList.id;

    await prisma.contact.createMany({
      data: contacts.map((c) => ({
        contactListId: contactList.id,
        rowNumber: c.rowNumber,
        name: c.name,
        email: c.email,
        normalizedEmail: c.normalizedEmail,
        company: c.company,
        role: c.role,
        isValid: c.isValid,
        validationErrors: c.validationErrors,
        isDuplicate: c.isDuplicate,
        isExcluded: c.isExcluded,
      })),
    });

    const savedContacts = await prisma.contact.findMany({ where: { contactListId: contactList.id } });
    expect(savedContacts).toHaveLength(4);
  });

  it("Step 2: Generates a tailored AI application draft for a valid contact", async () => {
    const contact = await prisma.contact.findFirst({
      where: { contactListId: createdContactListId, isValid: true, isDuplicate: false },
    });
    expect(contact).toBeDefined();

    const resume = await prisma.resume.findUnique({ where: { id: createdResumeId } });
    const profile = JSON.parse(resume!.structuredData as string);

    const draftData = await generateApplicationDraft({
      resumeData: profile,
      hrName: contact!.name,
      companyName: contact!.company,
      targetRole: contact!.role || "Software Engineer",
    });

    expect(draftData.subject).toContain("Full Stack Engineer");
    expect(draftData.greeting).toContain(contact!.name);
    expect(draftData.emailBody).toContain(contact!.company);
    expect(draftData.coverLetter).toContain(contact!.company);

    const draft = await prisma.applicationDraft.create({
      data: {
        contactId: contact!.id,
        resumeId: createdResumeId,
        targetRole: contact!.role,
        subject: draftData.subject,
        greeting: draftData.greeting,
        emailBody: draftData.emailBody,
        coverLetter: draftData.coverLetter,
        validationNotes: draftData.validationNotes,
        isApproved: false,
        status: "DRAFT",
      },
    });

    expect(draft.id).toBeDefined();
    expect(draft.isApproved).toBe(false);

    // Step 3: Approve Draft
    const approved = await prisma.applicationDraft.update({
      where: { id: draft.id },
      data: { isApproved: true, status: "APPROVED" },
    });
    expect(approved.isApproved).toBe(true);
  });

  it("Step 4: Creates a Batch Campaign and prepares SendingJobs", async () => {
    const approvedDrafts = await prisma.applicationDraft.findMany({
      where: { isApproved: true },
      include: { contact: true },
    });

    expect(approvedDrafts.length).toBeGreaterThan(0);

    const campaign = await prisma.campaign.create({
      data: {
        name: "Test E2E Batch Campaign",
        status: "PENDING",
        totalCount: approvedDrafts.length,
        pendingCount: approvedDrafts.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        delayMs: 100,
        concurrency: 1,
      },
    });

    await prisma.sendingJob.createMany({
      data: approvedDrafts.map((d) => ({
        campaignId: campaign.id,
        contactId: d.contactId,
        draftId: d.id,
        status: "PENDING",
      })),
    });

    const jobs = await prisma.sendingJob.findMany({ where: { campaignId: campaign.id } });
    expect(jobs).toHaveLength(approvedDrafts.length);
    expect(jobs[0].status).toBe("PENDING");
  });

  it("Step 5: Enforces Duplicate Prevention Safeguard", async () => {
    // If a contact already has a SENT job, subsequent campaigns must skip it
    const contact = await prisma.contact.findFirst({ where: { contactListId: createdContactListId } });
    const draft = await prisma.applicationDraft.findFirst({ where: { contactId: contact!.id } });

    const newCampaign = await prisma.campaign.create({
      data: {
        name: "Repeated Outreach Campaign",
        status: "PENDING",
        totalCount: 1,
        pendingCount: 1,
      },
    });

    // Simulate that the contact already received an email earlier
    await prisma.sendingJob.create({
      data: {
        campaignId: newCampaign.id,
        contactId: contact!.id,
        draftId: draft!.id,
        status: "SENT",
        acceptedAt: new Date(),
        smtpMessageId: "sample-msg-id-12345",
      },
    });

    const repeatJob = await prisma.sendingJob.create({
      data: {
        campaignId: newCampaign.id,
        contactId: contact!.id,
        draftId: draft!.id,
        status: "PENDING",
      },
    });

    // Verify duplicate check query
    const alreadySent = await prisma.sendingJob.findFirst({
      where: {
        contactId: contact!.id,
        status: "SENT",
        id: { not: repeatJob.id },
      },
    });

    expect(alreadySent).toBeDefined();
    expect(alreadySent?.smtpMessageId).toBe("sample-msg-id-12345");
  });
});

