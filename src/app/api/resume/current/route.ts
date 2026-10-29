import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const resume = await prisma.resume.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    if (!resume) {
      return NextResponse.json({ resume: null });
    }

    let structured = resume.structuredData;
    if (typeof structured === "string") {
      try {
        structured = JSON.parse(structured);
      } catch {}
    }

    return NextResponse.json({
      resume: {
        ...resume,
        structuredData: structured,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
