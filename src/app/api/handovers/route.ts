import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getHandoverLetters,
  saveHandoverLetter,
  getNextHandoverRefNo,
} from "@/lib/handoverLetterServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    let items = await getHandoverLetters();

    if (query) {
      items = items.filter((h) => {
        const ref = (h.refNo || "").toLowerCase();
        const prod = (h.productName || "").toLowerCase();
        const model = (h.modelDescription || "").toLowerCase();
        const serial = (h.serialNumbers || "").toLowerCase();
        const collector = (h.collectorName || "").toLowerCase();
        return (
          ref.includes(query) ||
          prod.includes(query) ||
          model.includes(query) ||
          serial.includes(query) ||
          collector.includes(query)
        );
      });
    }

    return NextResponse.json({ success: true, handovers: items });
  } catch (err: any) {
    console.error("GET /api/handovers error:", err);
    return NextResponse.json(
      { error: "Failed to fetch handover letters", details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    let {
      id,
      refNo,
      productName,
      modelDescription,
      serialNumbers,
      quantity,
      additionalItems,
      collectorName,
      collectorDesignation,
      handoverDate,
      contactNumber,
      confirmationText,
    } = body;

    if (!refNo || refNo.trim() === "") {
      refNo = await getNextHandoverRefNo();
    }

    const saved = await saveHandoverLetter({
      id: id || undefined,
      refNo,
      productName: productName || "",
      modelDescription: modelDescription || "",
      serialNumbers: serialNumbers || "",
      quantity: quantity || "1 Unit",
      additionalItems: additionalItems || [],
      collectorName: collectorName || session?.user?.name || "",
      collectorDesignation: collectorDesignation || "Quality Control & Hardware Engineer",
      handoverDate: handoverDate || new Date().toISOString().split("T")[0],
      contactNumber: contactNumber || "+94 76 357 31 31",
      confirmationText: confirmationText || undefined,
    });

    return NextResponse.json({ success: true, handover: saved });
  } catch (err: any) {
    console.error("POST /api/handovers error:", err);
    return NextResponse.json(
      { error: "Failed to save handover letter", details: err?.message },
      { status: 500 }
    );
  }
}
