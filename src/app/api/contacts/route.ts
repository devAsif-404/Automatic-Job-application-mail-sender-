import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const query = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query } },
        { email: { contains: query } },
        { company: { contains: query } },
        { role: { contains: query } },
      ];
    }

    if (filter === "valid") {
      where.isValid = true;
      where.isExcluded = false;
      where.isDuplicate = false;
    } else if (filter === "invalid") {
      where.isValid = false;
    } else if (filter === "duplicate") {
      where.isDuplicate = true;
    } else if (filter === "excluded") {
      where.isExcluded = true;
    }

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: [{ contactListId: "desc" }, { rowNumber: "asc" }],
        skip,
        take: limit,
        include: {
          drafts: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ]);

    return NextResponse.json({
      contacts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.contact.deleteMany({});
    await prisma.contactList.deleteMany({});
    return NextResponse.json({ success: true, message: "All contacts deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
