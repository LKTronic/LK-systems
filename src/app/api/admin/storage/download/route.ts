import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { decryptBackupData, getBackupEncryptionKey } from "@/lib/backupEngine";
import { getCloudinaryClient, isCloudinaryConfigured } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Superadmin can download backups." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const publicId = searchParams.get("publicId");
    const shouldDecrypt = searchParams.get("decrypt") === "true";
    const customPassphrase = searchParams.get("passphrase") || undefined;

    if (!publicId) {
      return NextResponse.json({ success: false, error: "Missing publicId parameter" }, { status: 400 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ success: false, error: "Cloudinary is not configured" }, { status: 500 });
    }

    const client = getCloudinaryClient();
    // Generate secure authenticated URL
    const fileUrl = client.url(publicId, { resource_type: "raw", secure: true });

    const fetchRes = await fetch(fileUrl);
    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch backup from Cloudinary: ${fetchRes.statusText}`);
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const encryptedBuffer = Buffer.from(arrayBuffer);

    const baseName = publicId.split("/").pop() || "pms_backup";

    if (shouldDecrypt) {
      const decryptedJson = decryptBackupData(encryptedBuffer, customPassphrase || getBackupEncryptionKey());
      const jsonString = JSON.stringify(decryptedJson, null, 2);

      return new NextResponse(jsonString, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${baseName.replace(/\.enc$/, "")}_decrypted.json"`,
        },
      });
    } else {
      return new NextResponse(encryptedBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${baseName}.enc"`,
        },
      });
    }
  } catch (err: any) {
    console.error("GET /api/admin/storage/download error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to download backup" },
      { status: 500 }
    );
  }
}
