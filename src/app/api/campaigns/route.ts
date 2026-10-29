import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { enqueueCampaign } from "@/lib/queue/bullmq";
import { getActiveSmtpConfig } from "@/lib/settings/config";

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    });

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignName, contactIds, delayMs = 3000, concurrency = 2 } = body;

    // Verify SMTP is configured before starting
    const smtpConfig = await getActiveSmtpConfig();
    if (!smtpConfig) {
      return NextResponse.json(
        { error: "SMTP settings are missing. Please configure and test SMTP before starting a batch." },
        { status: 400 }
      );
    }

    // Verify current resume exists
    const currentResume = await prisma.resume.findFirst({
      where: { isCurrent: true },
    });
    if (!currentResume) {
      return NextResponse.json(
        { error: "No active resume found. Please upload your resume first." },
        { status: 400 }
      );
    }

    // Fetch approved drafts for selected contacts
    const drafts = await prisma.applicationDraft.findMany({
      where: {
        contactId: { in: contactIds },
        isApproved: true,
        contact: {
          isValid: true,
          isExcluded: false,
        },
      },
      include: {
        contact: true,
      },
    });

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "No approved applications found for the selected contacts. Please approve applications first." },
        { status: 400 }
      );
    }

    // Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: campaignName || `Batch Campaign - ${new Date().toLocaleDateString()}`,
        status: "PENDING",
        totalCount: drafts.length,
        pendingCount: drafts.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        delayMs: Number(delayMs) || 3000,
        concurrency: Number(concurrency) || 2,
      },
    });

    // Create individual sending jobs
    await prisma.sendingJob.createMany({
      data: drafts.map((d) => ({
        campaignId: campaign.id,
        contactId: d.contactId,
        draftId: d.id,
        status: "PENDING",
      })),
    });

    // Enqueue sending
    await enqueueCampaign(campaign.id);

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      totalQueued: drafts.length,
    });
  } catch (err: any) {
    console.error("[Create Campaign Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

