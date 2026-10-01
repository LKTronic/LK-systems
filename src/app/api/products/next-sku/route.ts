import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextSku, getNextRecordNo } from "@/lib/recordNo";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nextSku = await getNextSku(prisma);
    const nextRecordNo = await getNextRecordNo(prisma);

    return NextResponse.json({
      nextSku,
      nextRecordNo,
    });
  } catch (error) {
    console.error("Error fetching next SKU:", error);
    return NextResponse.json(
      { error: "Failed to generate next SKU" },
      { status: 500 }
    );
  }
}
