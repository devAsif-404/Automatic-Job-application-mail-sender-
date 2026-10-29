import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { extractTextFromFileBuffer, extractStructuredInfoHeuristic } from "@/lib/parsers/resume";
import { sanitizeFileName } from "@/lib/utils/sanitize";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No resume file uploaded." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit. Please upload a smaller resume." },
        { status: 400 }
      );
    }

    const originalName = file.name || "resume.pdf";
    const ext = originalName.split(".").pop()?.toLowerCase();

    if (!["pdf", "docx"].includes(ext || "")) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF (.pdf) or Word (.docx) document." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate SHA-256 for integrity
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Extract text
    let parsedRawText = "";
    try {
      parsedRawText = await extractTextFromFileBuffer(buffer, file.type, originalName);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: `Resume text extraction failed: ${parseErr.message}` },
        { status: 422 }
      );
    }

    // Heuristic structured data extraction
    const structuredData = extractStructuredInfoHeuristic(parsedRawText);

    // Save to private uploads directory
    const uploadsDir = path.join(process.cwd(), "uploads", "resumes");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeBaseName = sanitizeFileName(originalName);
    const uniqueFileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeBaseName}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    fs.writeFileSync(destinationPath, buffer);

    // Unset previous active resumes
    await prisma.resume.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });

    // Save resume to database
    // Notice: For SQLite schema compatibility, structuredData is stored as JSON string
    const resume = await prisma.resume.create({
      data: {
        fileName: uniqueFileName,
        originalName,
        mimeType: ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: file.size,
        filePath: destinationPath,
        fileHash,
        parsedRawText,
        structuredData: JSON.stringify(structuredData),
        isCurrent: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        action: "RESUME_UPLOADED",
        entityType: "Resume",
        entityId: resume.id,
        details: JSON.stringify({
          originalName,
          fileSize: file.size,
          candidateName: structuredData.fullName,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      resume: {
        ...resume,
        structuredData,
      },
    });
  } catch (err: any) {
    console.error("[Resume Upload Error]", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while processing the resume." },
      { status: 500 }
    );
  }
}

