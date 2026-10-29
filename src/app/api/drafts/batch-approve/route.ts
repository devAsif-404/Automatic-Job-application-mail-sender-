import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { draftIds, approve = true } = body as { draftIds: string[]; approve?: boolean };

    if (!Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json({ error: "draftIds array is required." }, { status: 400 });
    }

    const result = await prisma.applicationDraft.updateMany({
      where: { id: { in: draftIds } },
      data: {
        isApproved: Boolean(approve),
        status: Boolean(approve) ? "APPROVED" : "DRAFT",
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
