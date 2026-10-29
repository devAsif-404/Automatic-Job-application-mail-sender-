import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, confirmation } = body;

    if (confirmation !== "CONFIRM_DELETE") {
      return NextResponse.json(
        { error: "Confirmation code 'CONFIRM_DELETE' is required to perform data cleanup." },
        { status: 400 }
      );
    }

    if (target === "contacts") {
      await prisma.sendingJob.deleteMany({});
      await prisma.applicationDraft.deleteMany({});
      await prisma.contact.deleteMany({});
      await prisma.contactList.deleteMany({});
      return NextResponse.json({ success: true, message: "All imported contacts and drafts cleared." });
    }

    if (target === "resumes") {
      const resumes = await prisma.resume.findMany();
      for (const r of resumes) {
        if (fs.existsSync(r.filePath)) {
          try {
            fs.unlinkSync(r.filePath);
          } catch {}
        }
      }
      await prisma.resume.deleteMany({});
      return NextResponse.json({ success: true, message: "All uploaded resumes deleted." });
    }

    if (target === "campaigns") {
      await prisma.smtpAttempt.deleteMany({});
      await prisma.sendingJob.deleteMany({});
      await prisma.campaign.deleteMany({});
      return NextResponse.json({ success: true, message: "All campaign and sending history cleared." });
    }

    if (target === "all") {
      await prisma.smtpAttempt.deleteMany({});
      await prisma.sendingJob.deleteMany({});
      await prisma.campaign.deleteMany({});
      await prisma.applicationDraft.deleteMany({});
      await prisma.contact.deleteMany({});
      await prisma.contactList.deleteMany({});

      const resumes = await prisma.resume.findMany();
      for (const r of resumes) {
        if (fs.existsSync(r.filePath)) {
          try {
            fs.unlinkSync(r.filePath);
          } catch {}
        }
      }
      await prisma.resume.deleteMany({});

      return NextResponse.json({ success: true, message: "Complete data reset executed successfully." });
    }

    return NextResponse.json({ error: "Invalid target specified." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

