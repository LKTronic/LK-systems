import { NextRequest, NextResponse } from "next/server";
import { ProductChecklistType } from "@/lib/productChecklist";
import { getNextChecklistNo } from "@/lib/productChecklistServer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");
    const type: ProductChecklistType = typeParam === "INVERTER" ? "INVERTER" : "BATTERY";

    const nextNo = await getNextChecklistNo(type);
    return NextResponse.json({ success: true, nextNo });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

