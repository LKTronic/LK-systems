import { NextResponse } from "next/server";
import { getCloudinaryStorageUsage } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const usage = await getCloudinaryStorageUsage();
    return NextResponse.json({
      success: true,
      isConfigured: usage.configured,
      ...usage,
    });
  } catch (err: any) {
    console.error("GET /api/checklists/storage error:", err);
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: err?.message || "Failed to fetch storage usage",
      },
      { status: 500 }
    );
  }
}

