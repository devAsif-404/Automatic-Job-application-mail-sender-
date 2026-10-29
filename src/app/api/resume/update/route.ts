import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ResumeStructuredDataSchema } from "@/lib/utils/validation";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = ResumeStructuredDataSchema.parse(body.structuredData);

    const currentResume = await prisma.resume.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    if (!currentResume) {
      return NextResponse.json({ error: "No active resume found to update." }, { status: 404 });
    }

    const updated = await prisma.resume.update({
      where: { id: currentResume.id },
      data: {
        structuredData: JSON.stringify(validatedData),
      },
    });

    return NextResponse.json({
      success: true,
      resume: {
        ...updated,
        structuredData: validatedData,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
