import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateApplicationDraft } from "@/lib/ai/gemini";
import { getActiveGeminiApiKey, getActiveSmtpConfig } from "@/lib/settings/config";
import { enqueueCampaign } from "@/lib/queue/bullmq";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { targetRole, tone, delayMs = 3000, concurrency = 2 } = body;

    // 1. Verify active SMTP configuration
    const smtpConfig = await getActiveSmtpConfig();
    if (!smtpConfig) {
      return NextResponse.json(
        { error: "No active SMTP configuration found. Please check SMTP credentials in Settings." },
        { status: 400 }
      );
    }

    // 2. Verify active resume
    const currentResume = await prisma.resume.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    if (!currentResume) {
      return NextResponse.json(
        { error: "No resume uploaded. Please upload your resume first." },
        { status: 400 }
      );
    }

    let structuredResume = currentResume.structuredData;
    if (typeof structuredResume === "string") {
      try {
        structuredResume = JSON.parse(structuredResume);
      } catch {}
    }

    // 3. Find all valid, unexcluded contacts
    const contacts = await prisma.contact.findMany({
      where: {
        isValid: true,
        isExcluded: false,
      },
      orderBy: { rowNumber: "asc" },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "No valid contacts found. Please upload a contact spreadsheet first." },
        { status: 400 }
      );
    }

    const apiKey = await getActiveGeminiApiKey();

    // 4. Generate & approve drafts for each contact
    const approvedDraftIds: string[] = [];

    // Bounded concurrency (2 at a time)
    for (let i = 0; i < contacts.length; i += 2) {
      const batch = contacts.slice(i, i + 2);
      const batchPromises = batch.map(async (contact) => {
        try {
          const generated = await generateApplicationDraft(
            {
              resumeData: structuredResume as any,
              hrName: contact.name,
              companyName: contact.company,
              targetRole: targetRole || contact.role || "Software Engineer",
              jobDescription: contact.jobDescription,
              tone: tone || "Professional, confident, and direct",
            },
            apiKey
          );

          const existingDraft = await prisma.applicationDraft.findFirst({
            where: { contactId: contact.id, resumeId: currentResume.id },
            select: { id: true },
          });

          const draft = await prisma.applicationDraft.upsert({
            where: { id: existingDraft?.id || "none" },
            create: {
              contactId: contact.id,
              resumeId: currentResume.id,
              targetRole: targetRole || contact.role || "Software Engineer",
              subject: generated.subject,
              greeting: generated.greeting,
              emailBody: generated.emailBody,
              coverLetter: generated.coverLetter,
              validationNotes: generated.validationNotes,
              aiModelUsed: process.env.GEMINI_MODEL || "gemini-flash-latest",
              status: "APPROVED",
              isApproved: true,
            },
            update: {
              targetRole: targetRole || contact.role || "Software Engineer",
              subject: generated.subject,
              greeting: generated.greeting,
              emailBody: generated.emailBody,
              coverLetter: generated.coverLetter,
              validationNotes: generated.validationNotes,
              aiModelUsed: process.env.GEMINI_MODEL || "gemini-flash-latest",
              status: "APPROVED",
              isApproved: true,
              version: { increment: 1 },
            },
          });

          return { success: true, draftId: draft.id, contactId: contact.id };
        } catch (err: any) {
          console.error(`Error generating draft for ${contact.email}:`, err.message);
          return { success: false, contactId: contact.id };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const res of batchResults) {
        if (res.success && res.draftId) {
          approvedDraftIds.push(res.draftId);
        }
      }

      if (i + 2 < contacts.length) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    if (approvedDraftIds.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate drafts for the contacts." },
        { status: 500 }
      );
    }

    // 5. Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: `1-Click Outreach - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        status: "PENDING",
        totalCount: approvedDraftIds.length,
        pendingCount: approvedDraftIds.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        delayMs: Number(delayMs) || 3000,
        concurrency: Number(concurrency) || 2,
      },
    });

    // 6. Create SendingJobs
    const drafts = await prisma.applicationDraft.findMany({
      where: { id: { in: approvedDraftIds } },
    });

    await prisma.sendingJob.createMany({
      data: drafts.map((d) => ({
        campaignId: campaign.id,
        contactId: d.contactId,
        draftId: d.id,
        status: "PENDING",
      })),
    });

    // 7. Enqueue Sending
    await enqueueCampaign(campaign.id);

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      totalQueued: approvedDraftIds.length,
      message: `Successfully prepared and queued ${approvedDraftIds.length} tailored job applications!`,
    });
  } catch (err: any) {
    console.error("[Quick Send Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

