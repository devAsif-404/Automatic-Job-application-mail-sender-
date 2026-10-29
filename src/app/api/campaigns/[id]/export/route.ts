import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { prisma } from "@/lib/db/prisma";
import { sanitizeForSpreadsheet } from "@/lib/utils/sanitize";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        jobs: {
          include: {
            contact: true,
            draft: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const rows = campaign.jobs.map((j) => ({
      "Recipient Name": sanitizeForSpreadsheet(j.contact.name),
      "Recipient Email": sanitizeForSpreadsheet(j.contact.email),
      Company: sanitizeForSpreadsheet(j.contact.company),
      "Subject Line": sanitizeForSpreadsheet(j.draft.subject),
      Status: j.status,
      "SMTP Message ID": sanitizeForSpreadsheet(j.smtpMessageId || ""),
      "Accepted Timestamp": j.acceptedAt ? j.acceptedAt.toISOString() : "",
      "Error Details": sanitizeForSpreadsheet(j.lastError || ""),
    }));

    const csvOutput = stringify(rows, { header: true });

    return new NextResponse(csvOutput, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="campaign_${campaign.name.replace(/[^a-zA-Z0-9]/g, "_")}_history.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
