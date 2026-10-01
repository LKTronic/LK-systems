import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPriceValidityMonths,
  setPriceValidityMonths,
  autoExpireOutdatedProducts,
} from "@/lib/settings";

// GET /api/settings - Read system settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const priceValidityMonths = await getPriceValidityMonths();

    return NextResponse.json({
      priceValidityMonths,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update price validity period (Admin or SuperAdmin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Admin or SuperAdmin role required to change settings." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const months = parseInt(body.priceValidityMonths, 10);

    if (isNaN(months) || months < 1 || months > 60) {
      return NextResponse.json(
        { error: "Price validity period must be between 1 and 60 months." },
        { status: 400 }
      );
    }

    const updatedMonths = await setPriceValidityMonths(months);
    const expiredCount = await autoExpireOutdatedProducts(updatedMonths);

    return NextResponse.json({
      success: true,
      priceValidityMonths: updatedMonths,
      message: `Price validity period set to ${updatedMonths} month(s). ${expiredCount} outdated products marked as Expired.`,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
