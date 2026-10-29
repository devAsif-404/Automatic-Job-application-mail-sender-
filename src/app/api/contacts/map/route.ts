import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { processRawRowsWithMapping, ColumnMapping } from "@/lib/parsers/csv-excel";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactListId, mapping } = body as { contactListId: string; mapping: ColumnMapping };

    if (!contactListId || !mapping) {
      return NextResponse.json({ error: "contactListId and mapping are required." }, { status: 400 });
    }

    const contactList = await prisma.contactList.findUnique({
      where: { id: contactListId },
    });

    if (!contactList) {
      return NextResponse.json({ error: "Contact list not found." }, { status: 404 });
    }

    let parsedMeta: any = {};
    if (contactList.columnMapping) {
      try {
        parsedMeta = JSON.parse(contactList.columnMapping);
      } catch {}
    }

    const rawRows = parsedMeta.rawRowsSummary || [];
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "No raw rows available for re-mapping." }, { status: 400 });
    }

    const existingContacts = await prisma.contact.findMany({
      where: { contactListId: { not: contactListId } },
      select: { normalizedEmail: true },
    });
    const existingEmailSet = new Set(existingContacts.map((c) => c.normalizedEmail));

    const { contacts, stats } = processRawRowsWithMapping(rawRows, mapping, existingEmailSet);

    // Delete previous contacts for this list
    await prisma.contact.deleteMany({
      where: { contactListId },
    });

    // Insert re-mapped contacts
    await prisma.contact.createMany({
      data: contacts.map((c) => ({
        contactListId,
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

    // Update list stats
    await prisma.contactList.update({
      where: { id: contactListId },
      data: {
        totalRows: stats.totalRows,
        validCount: stats.validCount,
        invalidCount: stats.invalidCount,
        duplicateCount: stats.duplicateCount,
        columnMapping: JSON.stringify({ mapping, rawRowsSummary: rawRows }),
      },
    });

    return NextResponse.json({
      success: true,
      stats,
      contacts: contacts.slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
