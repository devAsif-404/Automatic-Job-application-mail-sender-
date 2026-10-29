import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [
      totalContacts,
      validContacts,
      invalidContacts,
      duplicateContacts,
      draftsGenerated,
      approvedDrafts,
      sentEmails,
      failedEmails,
      skippedEmails,
      totalCampaigns,
      currentResume,
      recentJobs,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { isValid: true, isDuplicate: false, isExcluded: false } }),
      prisma.contact.count({ where: { isValid: false } }),
      prisma.contact.count({ where: { isDuplicate: true } }),
      prisma.applicationDraft.count(),
      prisma.applicationDraft.count({ where: { isApproved: true } }),
      prisma.sendingJob.count({ where: { status: "SENT" } }),
      prisma.sendingJob.count({ where: { status: "FAILED" } }),
      prisma.sendingJob.count({ where: { status: "SKIPPED" } }),
      prisma.campaign.count(),
      prisma.resume.findFirst({
        where: { isCurrent: true },
        select: {
          id: true,
          originalName: true,
          fileSize: true,
          createdAt: true,
          structuredData: true,
        },
      }),
      prisma.sendingJob.findMany({
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: {
          contact: { select: { name: true, email: true, company: true } },
          draft: { select: { subject: true } },
          campaign: { select: { name: true } },
        },
      }),
    ]);

    let candidateName = "";
    if (currentResume?.structuredData) {
      try {
        const parsed = typeof currentResume.structuredData === "string"
          ? JSON.parse(currentResume.structuredData)
          : currentResume.structuredData;
        candidateName = parsed.fullName || "";
      } catch {}
    }

    return NextResponse.json({
      contacts: {
        total: totalContacts,
        valid: validContacts,
        invalid: invalidContacts,
        duplicates: duplicateContacts,
      },
      drafts: {
        generated: draftsGenerated,
        approved: approvedDrafts,
      },
      sending: {
        sent: sentEmails,
        failed: failedEmails,
        skipped: skippedEmails,
      },
      campaignsCount: totalCampaigns,
      currentResume: currentResume
        ? {
            id: currentResume.id,
            originalName: currentResume.originalName,
            fileSize: currentResume.fileSize,
            createdAt: currentResume.createdAt,
            candidateName,
          }
        : null,
      recentActivity: recentJobs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

