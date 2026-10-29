import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { createdAt: "asc" },
          include: {
            contact: true,
            draft: {
              select: {
                subject: true,
                targetRole: true,
              },
            },
            attemptsList: {
              orderBy: { createdAt: "desc" },
              take: 2,
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
