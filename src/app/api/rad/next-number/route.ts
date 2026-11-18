import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRdQuotationTables } from "@/lib/rdQuotationDb";
import { getNextRdQuotationNo } from "@/lib/rdQuotationNo";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureRdQuotationTables();

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "THREE_D_PRINT") as any;

    const nextNo = await getNextRdQuotationNo(prisma, type);
    return NextResponse.json({ nextQuotationNo: nextNo, quotationNo: nextNo });
  } catch (error) {
    console.error("Error generating next R&D quotation number:", error);
    return NextResponse.json(
      { error: "Failed to generate next quotation number" },
      { status: 500 }
    );
  }
}

