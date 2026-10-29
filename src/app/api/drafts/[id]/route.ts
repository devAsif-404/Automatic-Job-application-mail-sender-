import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const draft = await prisma.applicationDraft.findUnique({
      where: { id },
      include: {
        contact: true,
        resume: true,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    const updated = await prisma.applicationDraft.update({
      where: { id },
      data: {
        subject: body.subject,
        greeting: body.greeting,
        emailBody: body.emailBody,
        coverLetter: body.coverLetter,
        isApproved: body.isApproved !== undefined ? body.isApproved : undefined,
        status: body.isApproved ? "APPROVED" : "DRAFT",
        version: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true, draft: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.applicationDraft.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Draft deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

