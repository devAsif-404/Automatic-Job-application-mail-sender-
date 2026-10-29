import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { enqueueCampaign } from "@/lib/queue/bullmq";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (campaign.status !== "PAUSED") {
      return NextResponse.json(
        { error: `Cannot resume campaign with status ${campaign.status}.` },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: "RUNNING" },
    });

    await enqueueCampaign(id);

    return NextResponse.json({ success: true, message: "Campaign resumed." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
