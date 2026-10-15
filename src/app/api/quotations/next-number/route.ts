import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextQuotationNo } from "@/lib/quotationNo";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nextQuotationNo = await getNextQuotationNo(prisma);
    return NextResponse.json({ nextQuotationNo });
  } catch (error) {
    console.error("Error generating next quotation number:", error);
    return NextResponse.json(
      { error: "Failed to generate quotation number" },
      { status: 500 }
    );
  }
}
