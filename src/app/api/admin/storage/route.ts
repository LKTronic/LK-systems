import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCompleteStorageBreakdown, createEncryptedBackup } from "@/lib/backupEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Superadmin can view storage breakdown." },
        { status: 403 }
      );
    }

    const breakdown = await getCompleteStorageBreakdown();
    return NextResponse.json({ success: true, ...breakdown });
  } catch (err: any) {
    console.error("GET /api/admin/storage error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load storage breakdown" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Superadmin can trigger backups." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const type = body.type === "DAILY" ? "DAILY" : body.type === "WEEKLY" ? "WEEKLY" : "MANUAL";
    const customKey = body.customKey && typeof body.customKey === "string" ? body.customKey.trim() : undefined;

    const backup = await createEncryptedBackup(type, customKey);
    return NextResponse.json({
      success: true,
      message: `Encrypted ${type.toLowerCase()} backup successfully created and uploaded to Cloudinary.`,
      backup,
    });
  } catch (err: any) {
    console.error("POST /api/admin/storage error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to create encrypted backup" },
      { status: 500 }
    );
  }
}
