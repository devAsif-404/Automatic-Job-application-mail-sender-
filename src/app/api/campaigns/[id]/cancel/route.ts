import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await prisma.sendingJob.updateMany({
      where: {
        campaignId: id,
        status: { in: ["PENDING", "QUEUED"] },
      },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true, message: "Campaign and pending jobs cancelled." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

