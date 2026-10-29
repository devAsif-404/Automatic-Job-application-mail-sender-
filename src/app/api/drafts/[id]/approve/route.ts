import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));

    const currentDraft = await prisma.applicationDraft.findUnique({ where: { id } });
    if (!currentDraft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    const newApprovalStatus = body.approved !== undefined ? Boolean(body.approved) : !currentDraft.isApproved;

    const updated = await prisma.applicationDraft.update({
      where: { id },
      data: {
        isApproved: newApprovalStatus,
        status: newApprovalStatus ? "APPROVED" : "DRAFT",
      },
    });

    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
