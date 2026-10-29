import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const approved = searchParams.get("approved");
    const query = searchParams.get("q")?.trim() || "";

    const where: any = {};
    if (approved === "true") where.isApproved = true;
    if (approved === "false") where.isApproved = false;

    if (query) {
      where.OR = [
        { subject: { contains: query } },
        { contact: { name: { contains: query } } },
        { contact: { company: { contains: query } } },
        { contact: { email: { contains: query } } },
      ];
    }

    const drafts = await prisma.applicationDraft.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        contact: true,
        resume: {
          select: {
            id: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
          },
        },
      },
    });

    return NextResponse.json({ drafts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
