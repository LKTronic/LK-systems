import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getThreeDPrintPricing, saveThreeDPrintPricing } from "@/lib/threeDPrintPricingServer";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pricing = await getThreeDPrintPricing();
    return NextResponse.json({ pricing });
  } catch (error: any) {
    console.error("GET /api/rad/3d-pricing error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve 3D print pricing: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { spoolLengthMeters, filamentPricePerSpool, costPerHour, markupPercent } = body;

    const saved = await saveThreeDPrintPricing({
      spoolLengthMeters,
      filamentPricePerSpool,
      costPerHour,
      markupPercent,
    });

    return NextResponse.json({ success: true, pricing: saved });
  } catch (error: any) {
    console.error("POST /api/rad/3d-pricing error:", error);
    return NextResponse.json(
      { error: "Failed to update 3D print pricing: " + (error?.message || String(error)) },
      { status: 500 }
    );
  }
}
