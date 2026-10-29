import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateApplicationDraft } from "@/lib/ai/gemini";
import { getActiveGeminiApiKey } from "@/lib/settings/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactId, targetRole, tone } = body;

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required." }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const currentResume = await prisma.resume.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    if (!currentResume) {
      return NextResponse.json(
        { error: "No active resume found. Please upload a resume first." },
        { status: 400 }
      );
    }

    let structuredResume = currentResume.structuredData;
    if (typeof structuredResume === "string") {
      try {
        structuredResume = JSON.parse(structuredResume);
      } catch {}
    }

    const apiKey = await getActiveGeminiApiKey();

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

    // Create or update draft
    const draft = await prisma.applicationDraft.upsert({
      where: {
        id: (
          await prisma.applicationDraft.findFirst({
            where: { contactId: contact.id, resumeId: currentResume.id },
            select: { id: true },
          })
        )?.id || "non-existent-id",
      },
      create: {
        contactId: contact.id,
        resumeId: currentResume.id,
        targetRole: targetRole || contact.role || "Software Engineer",
        subject: generated.subject,
        greeting: generated.greeting,
        emailBody: generated.emailBody,
        coverLetter: generated.coverLetter,
        validationNotes: generated.validationNotes,
        aiModelUsed: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        status: "DRAFT",
        isApproved: false,
      },
      update: {
        targetRole: targetRole || contact.role || "Software Engineer",
        subject: generated.subject,
        greeting: generated.greeting,
        emailBody: generated.emailBody,
        coverLetter: generated.coverLetter,
        validationNotes: generated.validationNotes,
        aiModelUsed: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        version: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true, draft });
  } catch (err: any) {
    console.error("[Generate Draft Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

