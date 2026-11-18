import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ProductChecklist } from "@/lib/productChecklist";
import {
  getChecklists,
  saveChecklist,
  getNextChecklistNo,
} from "@/lib/productChecklistServer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // BATTERY | INVERTER
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    let items = await getChecklists();

    if (type && (type === "BATTERY" || type === "INVERTER")) {
      items = items.filter((c) => c.type === type);
    }

    if (query) {
      items = items.filter((c) => {
        const no = (c.checklistNo || "").toLowerCase();
        const model = c.type === "BATTERY"
          ? (c.batteryInfo?.modelNumber || "").toLowerCase()
          : (c.inverterInfo?.modelNumber || "").toLowerCase();
        const serial = c.type === "BATTERY"
          ? ((c.batteryInfo?.serialNumberBox || "") + " " + (c.batteryInfo?.serialNumberBattery || "")).toLowerCase()
          : ((c.inverterInfo?.serialNumberBox || "") + " " + (c.inverterInfo?.serialNumberInverter || "") + " " + (c.inverterInfo?.serialNumber || "")).toLowerCase();
        const checker = (c.checkedByName || "").toLowerCase();

        return no.includes(query) || model.includes(query) || serial.includes(query) || checker.includes(query);
      });
    }

    return NextResponse.json({ success: true, checklists: items });
  } catch (err: any) {
    console.error("GET /api/checklists error:", err);
    return NextResponse.json(
      { error: "Failed to fetch checklists", details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const {
      id,
      checklistNo,
      type,
      batteryInfo,
      inverterInfo,
      checkedDate,
      tests,
      checkedByName,
      checkedByDesignation,
      additionalNotes,
      overallQcPassed,
    } = body;

    if (!type || (type !== "BATTERY" && type !== "INVERTER")) {
      return NextResponse.json(
        { error: "Invalid product type. Must be BATTERY or INVERTER" },
        { status: 400 }
      );
    }

    const assignedNo = checklistNo || (await getNextChecklistNo(type));
    const entryId = id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const assignedStatus = body.status === "DRAFT" ? "DRAFT" : "COMPLETED";

    const checklistToSave: ProductChecklist = {
      id: entryId,
      checklistNo: assignedNo,
      type,
      status: assignedStatus,
      batteryInfo: type === "BATTERY" ? batteryInfo : undefined,
      inverterInfo: type === "INVERTER" ? inverterInfo : undefined,
      checkedDate: checkedDate || new Date().toISOString().split("T")[0],
      tests: tests || [],
      checkedByName: checkedByName || (session?.user?.name as string) || "QC Engineer",
      checkedByDesignation: checkedByDesignation || "Quality Control & Hardware Engineer",
      additionalNotes: additionalNotes || [],
      overallQcPassed: overallQcPassed !== undefined ? Boolean(overallQcPassed) : true,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveChecklist(checklistToSave);

    return NextResponse.json({ success: true, checklist: saved });
  } catch (err: any) {
    console.error("POST /api/checklists error:", err);
    return NextResponse.json(
      { error: "Failed to save checklist", details: err?.message },
      { status: 500 }
    );
  }
}

