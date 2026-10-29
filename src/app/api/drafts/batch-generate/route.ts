import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateApplicationDraft } from "@/lib/ai/gemini";
import { getActiveGeminiApiKey } from "@/lib/settings/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactIds, targetRole, tone } = body;

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

    // Determine target contacts
    const where: any = {
      isValid: true,
      isExcluded: false,
    };
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      where.id = { in: contactIds };
    }

    const contacts = await prisma.contact.findMany({ where });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "No valid, unexcluded contacts found for draft generation." },
        { status: 400 }
      );
    }

    const apiKey = await getActiveGeminiApiKey();
    const results: any[] = [];

    // Bounded concurrency execution (2 at a time)
    const concurrency = 2;
    for (let i = 0; i < contacts.length; i += concurrency) {
      const slice = contacts.slice(i, i + concurrency);
      const batchPromises = slice.map(async (contact) => {
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

          // Find existing draft if any
          const existing = await prisma.applicationDraft.findFirst({
            where: { contactId: contact.id, resumeId: currentResume.id },
            select: { id: true },
          });

          const draft = await prisma.applicationDraft.upsert({
            where: { id: existing?.id || "none" },
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

          return { contactId: contact.id, success: true, draftId: draft.id };
        } catch (err: any) {
          return { contactId: contact.id, success: false, error: err.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Brief delay between batches to stay under rate limits
      if (i + concurrency < contacts.length) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      total: contacts.length,
      generatedCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (err: any) {
    console.error("[Batch Generate Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

