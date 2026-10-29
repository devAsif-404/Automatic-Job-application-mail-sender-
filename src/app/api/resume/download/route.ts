import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const resume = await prisma.resume.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    if (!resume || !fs.existsSync(resume.filePath)) {
      return NextResponse.json({ error: "Resume file not found on server." }, { status: 404 });
    }

    // Path traversal check
    const allowedDir = path.resolve(process.cwd(), "uploads", "resumes");
    const resolvedPath = path.resolve(resume.filePath);
    if (!resolvedPath.startsWith(allowedDir)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const fileBuffer = fs.readFileSync(resolvedPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": resume.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(resume.originalName)}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

