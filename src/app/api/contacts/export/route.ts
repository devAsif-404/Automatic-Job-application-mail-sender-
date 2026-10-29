import { NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { prisma } from "@/lib/db/prisma";
import { sanitizeForSpreadsheet } from "@/lib/utils/sanitize";

export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({
      orderBy: [{ contactListId: "desc" }, { rowNumber: "asc" }],
    });

    const rows = contacts.map((c) => ({
      "Row Number": c.rowNumber,
      Name: sanitizeForSpreadsheet(c.name),
      Email: sanitizeForSpreadsheet(c.email),
      Company: sanitizeForSpreadsheet(c.company),
      Role: sanitizeForSpreadsheet(c.role || ""),
      "Valid Status": c.isValid ? "Valid" : "Invalid",
      "Duplicate Status": c.isDuplicate ? "Duplicate" : "Unique",
      "Excluded Status": c.isExcluded ? "Excluded" : "Active",
      "Validation Errors": sanitizeForSpreadsheet(c.validationErrors || ""),
    }));

    const csvOutput = stringify(rows, { header: true });

    return new NextResponse(csvOutput, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts_validation_report_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
