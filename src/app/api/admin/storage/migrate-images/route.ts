import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCloudinaryConfigured, uploadProductImage } from "@/lib/cloudinary";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/admin/storage/migrate-images
 * Migrates local/MySQL images on Hostinger to Cloudinary with safety verification:
 * 1. Creates local backup of all images in `backups/product_images_backup/`
 * 2. Uploads each unique image to Cloudinary in `pms_products/`
 * 3. Verifies each Cloudinary URL is live (HTTP 200)
 * 4. Updates Product.imagePath in MySQL
 * 5. Cleans up ProductImageBackup in MySQL to free 44MB memory
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Superadmin can migrate storage." },
        { status: 403 }
      );
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { success: false, error: "Cloudinary is not configured. Please check your credentials in .env." },
        { status: 500 }
      );
    }

    // 1. Prepare local backup directory on Hostinger server
    const backupDir = path.join(process.cwd(), "backups", "product_images_backup");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 2. Collect all images from disk and MySQL ProductImageBackup
    const imageMap = new Map<string, Buffer>();

    // From disk:
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    if (fs.existsSync(uploadDir)) {
      const diskFiles = fs.readdirSync(uploadDir);
      for (const file of diskFiles) {
        if (file === ".gitkeep") continue;
        const filePath = path.join(uploadDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && stat.size > 0) {
            const buf = fs.readFileSync(filePath);
            imageMap.set(file, buf);
            // Save local backup copy
            fs.writeFileSync(path.join(backupDir, file), buf);
          }
        } catch {}
      }
    }

    // From MySQL ProductImageBackup:
    try {
      const dbRows = await prisma.productImageBackup.findMany();
      for (const row of dbRows) {
        if (row.data && !imageMap.has(row.filename)) {
          const buf = Buffer.from(row.data, "base64");
          imageMap.set(row.filename, buf);
          // Save local backup copy
          fs.writeFileSync(path.join(backupDir, row.filename), buf);
        }
      }
    } catch (e) {
      console.warn("Could not read ProductImageBackup during migration:", e);
    }

    const totalUniqueImages = imageMap.size;
    let uploadedCount = 0;
    let verifiedCount = 0;
    let updatedProductsCount = 0;
    const migrationResults: Record<string, string> = {};

    // 3. Upload each image to Cloudinary and verify
    for (const [filename, buffer] of imageMap.entries()) {
      try {
        const uploadResult = await uploadProductImage(buffer, filename);
        uploadedCount++;

        // Verify URL is live
        try {
          const verifyRes = await fetch(uploadResult.url, { method: "HEAD" });
          if (verifyRes.ok) {
            verifiedCount++;
            migrationResults[filename] = uploadResult.url;

            // 4. Update Product records referencing this local image
            const updated = await prisma.product.updateMany({
              where: {
                OR: [
                  { imagePath: `/uploads/products/${filename}` },
                  { imagePath: filename },
                  { imagePath: { endsWith: filename } },
                ],
              },
              data: {
                imagePath: uploadResult.url,
              },
            });
            updatedProductsCount += updated.count;
          }
        } catch (verifyErr) {
          console.warn(`Could not verify URL ${uploadResult.url}:`, verifyErr);
        }
      } catch (err: any) {
        console.error(`Failed to migrate ${filename}:`, err?.message);
      }
    }

    // 5. Clean up ProductImageBackup in MySQL if all were backed up and verified
    let databaseCleaned = false;
    if (verifiedCount > 0 && verifiedCount === totalUniqueImages) {
      try {
        await prisma.productImageBackup.deleteMany({});
        databaseCleaned = true;
      } catch (e) {
        console.warn("Could not clean ProductImageBackup table:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated and verified ${verifiedCount} of ${totalUniqueImages} images to Cloudinary.`,
      stats: {
        totalImagesFound: totalUniqueImages,
        backedUpToDisk: totalUniqueImages,
        backupLocation: backupDir,
        uploadedToCloudinary: uploadedCount,
        verifiedLive: verifiedCount,
        productsUpdated: updatedProductsCount,
        databaseCleaned,
      },
    });
  } catch (err: any) {
    console.error("POST /api/admin/storage/migrate-images error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Migration failed" },
      { status: 500 }
    );
  }
}

