import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  parseSpreadsheetBuffer,
  autoDetectColumnMapping,
  processRawRowsWithMapping,
} from "@/lib/parsers/csv-excel";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No spreadsheet file uploaded." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 15MB limit." }, { status: 400 });
    }

    const fileName = file.name || "contacts.csv";
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (!["csv", "xlsx", "xls", "txt"].includes(ext || "")) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload .xlsx, .xls, or .csv." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse raw rows and headers
    const { headers, rawRows } = await parseSpreadsheetBuffer(buffer, fileName);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "No data rows found in the uploaded file." }, { status: 400 });
    }

    // Auto-detect column mapping
    const { mapping, isAmbiguous } = autoDetectColumnMapping(headers);

    // Get existing emails in DB for duplicate cross-referencing
    const existingContacts = await prisma.contact.findMany({
      select: { normalizedEmail: true },
    });
    const existingEmailSet = new Set(existingContacts.map((c) => c.normalizedEmail));

    // Process rows
    const { contacts, stats } = processRawRowsWithMapping(rawRows, mapping, existingEmailSet);

    // Persist ContactList
    const contactList = await prisma.contactList.create({
      data: {
        fileName,
        fileType: ext || "csv",
        totalRows: stats.totalRows,
        validCount: stats.validCount,
        invalidCount: stats.invalidCount,
        duplicateCount: stats.duplicateCount,
        columnMapping: JSON.stringify({ mapping, rawRowsSummary: rawRows.slice(0, 50) }),
      },
    });

    // Bulk insert contacts
    await prisma.contact.createMany({
      data: contacts.map((c) => ({
        contactListId: contactList.id,
        rowNumber: c.rowNumber,
        name: c.name || "Hiring Manager",
        email: c.email,
        normalizedEmail: c.normalizedEmail,
        company: c.company || "Company",
        role: c.role || null,
        jobDescription: c.jobDescription || null,
        jobUrl: c.jobUrl || null,
        isValid: c.isValid,
        validationErrors: c.validationErrors,
        isDuplicate: c.isDuplicate,
        isExcluded: c.isExcluded,
      })),
    });

    await prisma.auditEvent.create({
      data: {
        action: "CONTACTS_IMPORTED",
        entityType: "ContactList",
        entityId: contactList.id,
        details: JSON.stringify({
          fileName,
          stats,
          isAmbiguous,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      contactListId: contactList.id,
      headers,
      suggestedMapping: mapping,
      isAmbiguous,
      stats,
      sampleRows: contacts.slice(0, 10),
    });
  } catch (err: any) {
    console.error("[Spreadsheet Upload Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to parse contact spreadsheet." },
      { status: 500 }
    );
  }
}

