import { NextRequest, NextResponse } from "next/server";
import {
  getHandoverLetters,
  deleteHandoverLetter,
} from "@/lib/handoverLetterServer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const all = await getHandoverLetters();
    const found = all.find((h) => h.id === id);

    if (!found) {
      return NextResponse.json({ error: "Handover letter not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, handover: found });
  } catch (err: any) {
    console.error("GET /api/handovers/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch handover letter", details: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteHandoverLetter(id);
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    console.error("DELETE /api/handovers/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete handover letter", details: err?.message },
      { status: 500 }
    );
  }
}
