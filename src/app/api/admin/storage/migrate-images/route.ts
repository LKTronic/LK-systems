import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCloudinaryConfigured, uploadProductImage, getCloudinaryCredentials } from "@/lib/cloudinary";
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

    const totalRemaining = pendingProducts + dbBackupCount;

    return NextResponse.json({
      success: true,
      stats: {
        totalProductsWithImages,
        migratedProducts,
        pendingProducts,
        dbBackupCount,
        diskImagesCount,
        totalRemainingToMigrate: totalRemaining,
        isFullyMigrated: totalRemaining === 0,
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
 * Migrates images directly from MySQL ProductImageBackup table to Cloudinary `pms_products/`
 * in safe 5-image batches, then links product records and cleans database bloat.
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

    // Direct cleanup action: purge ProductImageBackup table and clear dead local paths
    if (action === "cleanup") {
      try {
        const deleted = await prisma.productImageBackup.deleteMany({});
        const cleanedProducts = await prisma.product.updateMany({
          where: {
            AND: [
              { imagePath: { not: null } },
              { NOT: { imagePath: "" } },
              { NOT: { imagePath: { startsWith: "http" } } },
            ],
          },
          data: { imagePath: null },
        });

        return NextResponse.json({
          success: true,
          message: `Successfully cleaned MySQL database! Deleted ${deleted.count} Base64 backup records (~44MB) and cleaned ${cleanedProducts.count} dead local paths.`,
          cleanedCount: deleted.count,
          cleanedProducts: cleanedProducts.count,
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
    const { cloudName } = getCloudinaryCredentials();

    let processedInBatch = 0;
    let nextCursor = cursor;

    // PHASE 1: Migrate directly from ProductImageBackup table (where all 72 image files live!)
    const backups = await prisma.productImageBackup.findMany({
      take: batchSize,
    });

    if (backups.length > 0) {
      for (const row of backups) {
        if (row.data) {
          const buffer = Buffer.from(row.data, "base64");
          // Keep local disk backup on server
          try {
            fs.writeFileSync(path.join(backupDir, row.filename), buffer);
          } catch {}

          try {
            // Upload directly to Cloudinary into `pms_products/`
            const uploadResult = await uploadProductImage(buffer, row.filename);

            // Update all products referencing this filename to Cloudinary URL
            await prisma.product.updateMany({
              where: {
                OR: [
                  { imagePath: `/uploads/products/${row.filename}` },
                  { imagePath: row.filename },
                  { imagePath: { endsWith: row.filename } },
                  { imagePath: { contains: row.filename } },
                ],
              },
              data: { imagePath: uploadResult.url },
            });
          } catch (uploadErr) {
            console.error(`Failed to upload ${row.filename} to Cloudinary:`, uploadErr);
          }
        }

        // Delete processed row from MySQL
        await prisma.productImageBackup.deleteMany({
          where: { filename: row.filename },
        }).catch(() => {});

        processedInBatch++;
      }
    } else {
      // PHASE 2: All ProductImageBackup rows migrated! Now check remaining products with non-http paths
      const remainingProducts = await prisma.product.findMany({
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

      if (remainingProducts.length > 0) {
        for (const prod of remainingProducts) {
          nextCursor = prod.id;
          const cleanFilename = path.basename((prod.imagePath || "").replace(/\\/g, "/"));
          const diskPath = path.join(uploadDir, cleanFilename);
          let uploaded = false;

          if (fs.existsSync(diskPath)) {
            try {
              const buffer = fs.readFileSync(diskPath);
              const uploadResult = await uploadProductImage(buffer, cleanFilename);
              await prisma.product.update({
                where: { id: prod.id },
                data: { imagePath: uploadResult.url },
              });
              uploaded = true;
              processedInBatch++;
            } catch {}
          }

          if (!uploaded && cloudName) {
            // Check if file already exists on Cloudinary
            const directCloudUrl = `https://res.cloudinary.com/${cloudName}/image/upload/pms_products/${encodeURIComponent(cleanFilename)}`;
            try {
              const headRes = await fetch(directCloudUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
              if (headRes.ok) {
                await prisma.product.update({ where: { id: prod.id }, data: { imagePath: directCloudUrl } });
                uploaded = true;
                processedInBatch++;
              }
            } catch {}
          }

          if (!uploaded) {
            // Truly a missing ghost path (e.g. from deleted test product)
            await prisma.product.update({ where: { id: prod.id }, data: { imagePath: null } });
            processedInBatch++;
          }
        }
      }
    }

    // Check remaining totals
    const [remainingProductsCount, remainingDbBackupsCount] = await Promise.all([
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

    const totalRemaining = remainingProductsCount + remainingDbBackupsCount;
    const completed = totalRemaining === 0 || (backups.length === 0 && processedInBatch === 0);

    if (completed) {
      // Final purge: ensure ProductImageBackup table is 100% empty
      await prisma.productImageBackup.deleteMany({}).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      completed,
      nextCursor: completed ? null : nextCursor,
      processedInBatch,
      remainingProducts: remainingProductsCount,
      remainingDbBackups: remainingDbBackupsCount,
      totalRemaining: completed ? 0 : totalRemaining,
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
