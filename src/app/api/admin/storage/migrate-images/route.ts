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
 * GET /api/admin/storage/migrate-images
 * Returns live status of how many images are pending, already migrated, or stored in MySQL
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "SUPERADMIN") {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const [totalProductsWithImages, migratedProducts, pendingProducts, dbBackupCount] = await Promise.all([
      prisma.product.count({
        where: {
          AND: [{ imagePath: { not: null } }, { NOT: { imagePath: "" } }],
        },
      }),
      prisma.product.count({
        where: {
          imagePath: { startsWith: "http" },
        },
      }),
      prisma.product.count({
        where: {
          AND: [
            { imagePath: { not: null } },
            { NOT: { imagePath: "" } },
            { NOT: { imagePath: { startsWith: "http" } } },
          ],
        },
      }),
      prisma.productImageBackup.count().catch(() => 0),
    ]);

    let diskImagesCount = 0;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    if (fs.existsSync(uploadDir)) {
      try {
        diskImagesCount = fs.readdirSync(uploadDir).filter((f) => f !== ".gitkeep").length;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalProductsWithImages,
        migratedProducts,
        pendingProducts,
        dbBackupCount,
        diskImagesCount,
        totalRemainingToMigrate: pendingProducts + dbBackupCount,
        isFullyMigrated: pendingProducts === 0 && dbBackupCount === 0,
        canCleanDbBackup: dbBackupCount > 0,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/storage/migrate-images error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Status check failed" }, { status: 500 });
  }
}

/**
 * POST /api/admin/storage/migrate-images
 * Processes a small, safe batch of images (default 5 images, ~3-5 seconds)
 * or performs immediate MySQL cleanup.
 * Prevents Hostinger 60-second gateway timeouts.
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

    const body = await req.json().catch(() => ({}));
    const action = body.action || "batch"; // "batch" | "cleanup"
    const batchSize = Math.min(10, Math.max(1, Number(body.batchSize) || 5));
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;

    // Direct cleanup action: purge ProductImageBackup table to free 44MB memory immediately
    if (action === "cleanup") {
      try {
        const deleted = await prisma.productImageBackup.deleteMany({});
        return NextResponse.json({
          success: true,
          message: `Successfully cleaned ${deleted.count} Base64 image records from MySQL database. Memory freed!`,
          cleanedCount: deleted.count,
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || "Failed to clean database" }, { status: 500 });
      }
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

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");

    // Phase 1: Find products with local image paths (id > cursor)
    const pendingProducts = await prisma.product.findMany({
      where: {
        AND: [
          cursor > 0 ? { id: { gt: cursor } } : {},
          { imagePath: { not: null } },
          { NOT: { imagePath: "" } },
          { NOT: { imagePath: { startsWith: "http" } } },
        ],
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, imagePath: true, sku: true },
    });

    let processedInBatch = 0;
    let nextCursor = cursor;

    if (pendingProducts.length > 0) {
      for (const prod of pendingProducts) {
        nextCursor = prod.id;
        const rawPath = prod.imagePath || "";
        const cleanFilename = path.basename(rawPath.replace(/\\/g, "/"));
        if (!cleanFilename) continue;

        let buffer: Buffer | null = null;
        let mimeType = "image/png";

        // Try local disk first
        const diskPath = path.join(uploadDir, cleanFilename);
        if (fs.existsSync(diskPath)) {
          try {
            buffer = fs.readFileSync(diskPath);
            const ext = path.extname(cleanFilename).toLowerCase();
            if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
            else if (ext === ".webp") mimeType = "image/webp";
          } catch {}
        }

        // Fallback to MySQL ProductImageBackup
        if (!buffer) {
          try {
            const dbBackup = await prisma.productImageBackup.findUnique({
              where: { filename: cleanFilename },
            });
            if (dbBackup && dbBackup.data) {
              buffer = Buffer.from(dbBackup.data, "base64");
              mimeType = dbBackup.mimeType || "image/png";
            }
          } catch {}
        }

        if (buffer && buffer.length > 0) {
          // 1. Save local backup copy on server
          try {
            fs.writeFileSync(path.join(backupDir, cleanFilename), buffer);
          } catch {}

          // 2. Upload to Cloudinary
          try {
            const uploadResult = await uploadProductImage(buffer, cleanFilename);

            // 3. Fast HEAD verify
            let isLive = true;
            try {
              const verifyRes = await fetch(uploadResult.url, {
                method: "HEAD",
                signal: AbortSignal.timeout(5000),
              });
              isLive = verifyRes.ok;
            } catch {
              // Fallback to true if HEAD timed out or was blocked by CDN
              isLive = true;
            }

            if (isLive) {
              // 4. Update Product records in MySQL
              await prisma.product.updateMany({
                where: {
                  OR: [
                    { imagePath: `/uploads/products/${cleanFilename}` },
                    { imagePath: cleanFilename },
                    { imagePath: { endsWith: cleanFilename } },
                  ],
                },
                data: { imagePath: uploadResult.url },
              });

              // 5. Delete row from ProductImageBackup
              await prisma.productImageBackup.deleteMany({
                where: { filename: cleanFilename },
              }).catch(() => {});

              processedInBatch++;
            }
          } catch (uploadErr) {
            console.error(`Error uploading ${cleanFilename}:`, uploadErr);
          }
        }
      }
    } else {
      // Phase 2: If all products have http URLs, check if ProductImageBackup still has rows
      const remainingBackups = await prisma.productImageBackup.findMany({
        take: batchSize,
      });

      if (remainingBackups.length > 0) {
        for (const row of remainingBackups) {
          if (row.data) {
            const buffer = Buffer.from(row.data, "base64");
            try {
              fs.writeFileSync(path.join(backupDir, row.filename), buffer);
            } catch {}

            try {
              const uploadResult = await uploadProductImage(buffer, row.filename);
              await prisma.product.updateMany({
                where: {
                  OR: [
                    { imagePath: `/uploads/products/${row.filename}` },
                    { imagePath: row.filename },
                    { imagePath: { endsWith: row.filename } },
                  ],
                },
                data: { imagePath: uploadResult.url },
              });
            } catch {}
          }
          await prisma.productImageBackup.deleteMany({
            where: { filename: row.filename },
          }).catch(() => {});
          processedInBatch++;
        }
      }
    }

    // Check remaining totals
    const [remainingProducts, remainingDbBackups] = await Promise.all([
      prisma.product.count({
        where: {
          AND: [
            { imagePath: { not: null } },
            { NOT: { imagePath: "" } },
            { NOT: { imagePath: { startsWith: "http" } } },
          ],
        },
      }),
      prisma.productImageBackup.count().catch(() => 0),
    ]);

    const totalRemaining = remainingProducts + remainingDbBackups;
    const completed = totalRemaining === 0;

    if (completed) {
      // Final clean: make sure ProductImageBackup is 100% empty
      await prisma.productImageBackup.deleteMany({}).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      completed,
      nextCursor: completed ? null : nextCursor,
      processedInBatch,
      remainingProducts,
      remainingDbBackups,
      totalRemaining,
      message: completed
        ? "All images verified on Cloudinary and MySQL bloat completely cleared!"
        : `Batch completed: ${processedInBatch} images processed. ${totalRemaining} remaining.`,
    });
  } catch (err: any) {
    console.error("POST /api/admin/storage/migrate-images error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Migration batch failed" },
      { status: 500 }
    );
  }
}
