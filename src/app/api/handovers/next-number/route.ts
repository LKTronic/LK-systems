import { NextRequest, NextResponse } from "next/server";
import { getNextHandoverRefNo } from "@/lib/handoverLetterServer";

export async function GET(req: NextRequest) {
  try {
    const nextNo = await getNextHandoverRefNo();
    return NextResponse.json({ success: true, nextNo });
  } catch (err: any) {
    console.error("GET /api/handovers/next-number error:", err);
    return NextResponse.json(
      { error: "Failed to generate next handover reference number", details: err?.message },
      { status: 500 }
    );
  }
}
