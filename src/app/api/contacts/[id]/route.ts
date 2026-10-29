import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ContactRowSchema } from "@/lib/utils/validation";
import { normalizeEmail } from "@/lib/utils/sanitize";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    const validation = ContactRowSchema.safeParse({
      name: body.name,
      email: body.email,
      company: body.company,
      role: body.role || undefined,
      jobDescription: body.jobDescription || undefined,
      jobUrl: body.jobUrl || undefined,
    });

    const isValid = validation.success;
    const validationErrors = !validation.success
      ? validation.error.errors.map((e) => e.message).join("; ")
      : null;

    const normalizedEmail = normalizeEmail(body.email);

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        normalizedEmail,
        company: body.company,
        role: body.role || null,
        jobDescription: body.jobDescription || null,
        jobUrl: body.jobUrl || null,
        isValid,
        validationErrors,
      },
    });

    return NextResponse.json({ success: true, contact: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Contact deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
