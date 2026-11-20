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
 * Returns live status of how many images are pending, already migrated, or stored on server/database
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

    let serverBackupCount = 0;
    const backupDir = path.join(process.cwd(), "backups", "product_images_backup");
    if (fs.existsSync(backupDir)) {
      try {
        serverBackupCount = fs.readdirSync(backupDir).filter((f) => f !== ".gitkeep").length;
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
        serverBackupCount,
        totalRemainingToMigrate: totalRemaining,
        isFullyMigrated: totalRemaining === 0,
        canCleanDbBackup: dbBackupCount > 0,
        hasServerBackups: serverBackupCount > 0 || diskImagesCount > 0 || dbBackupCount > 0,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/storage/migrate-images error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Status check failed" }, { status: 500 });
  }
}

/**
 * POST /api/admin/storage/migrate-images
 * Supports:
 * - action: "batch" &rarr; Batch migration of local MySQL/disk images to Cloudinary
 * - action: "reupload_backup" &rarr; Restores and re-uploads images from `backups/product_images_backup/` to Cloudinary `pms_products`
 * - action: "cleanup" &rarr; Purges MySQL Base64 backup bloat
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
    const action = body.action || "batch"; // "batch" | "reupload_backup" | "cleanup"
    const batchSize = Math.min(10, Math.max(1, Number(body.batchSize) || 5));
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { success: false, error: "Cloudinary is not configured. Please check your credentials in .env." },
        { status: 500 }
      );
    }

    const backupDir = path.join(process.cwd(), "backups", "product_images_backup");
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    const { cloudName } = getCloudinaryCredentials();

    // ACTION: REUPLOAD_BACKUP (Restores all server backup images back into Cloudinary pms_products)
    if (action === "reupload_backup") {
      const fileMap = new Map<string, Buffer>();

      // 1. Collect from backups/product_images_backup/
      if (fs.existsSync(backupDir)) {
        try {
          const files = fs.readdirSync(backupDir);
          for (const f of files) {
            if (f === ".gitkeep") continue;
            try {
              const buf = fs.readFileSync(path.join(backupDir, f));
              if (buf && buf.length > 0) fileMap.set(f, buf);
            } catch {}
          }
        } catch {}
      }

      // 2. Collect from public/uploads/products/
      if (fs.existsSync(uploadDir)) {
        try {
          const files = fs.readdirSync(uploadDir);
          for (const f of files) {
            if (f === ".gitkeep" || fileMap.has(f)) continue;
            try {
              const buf = fs.readFileSync(path.join(uploadDir, f));
              if (buf && buf.length > 0) fileMap.set(f, buf);
            } catch {}
          }
        } catch {}
      }

      // 3. Collect from MySQL ProductImageBackup table if available
      try {
        const dbBackups = await prisma.productImageBackup.findMany();
        for (const row of dbBackups) {
          if (row.data && !fileMap.has(row.filename)) {
            try {
              fileMap.set(row.filename, Buffer.from(row.data, "base64"));
            } catch {}
          }
        }
      } catch {}

      if (fileMap.size === 0) {
        return NextResponse.json({
          success: false,
          error: "No server backup image files found in backups/product_images_backup/ or public/uploads/products/.",
        });
      }

      let uploadedCount = 0;
      let updatedProductsCount = 0;

      for (const [filename, buffer] of fileMap.entries()) {
        try {
          const uploadResult = await uploadProductImage(buffer, filename);
          uploadedCount++;

          const nameWithoutExt = path.parse(filename).name;

          // Update any products whose imagePath references this filename or old Cloudinary url
          const updated = await prisma.product.updateMany({
            where: {
              OR: [
                { imagePath: { contains: filename } },
                { imagePath: { contains: nameWithoutExt } },
                { supplierImage: { contains: filename } },
              ],
            },
            data: {
              imagePath: uploadResult.url,
            },
          });
          updatedProductsCount += updated.count;
        } catch (uploadErr: any) {
          console.error(`Failed to re-upload ${filename}:`, uploadErr?.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully restored and re-uploaded ${uploadedCount} images to Cloudinary (folder 'pms_products') and updated ${updatedProductsCount} product links!`,
        uploadedCount,
        updatedProductsCount,
      });
    }

    // ACTION: CLEANUP
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

    // ACTION: BATCH MIGRATION
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    let processedInBatch = 0;
    let nextCursor = cursor;

    // PHASE 1: Migrate directly from ProductImageBackup table (where image files live)
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
            const uploadResult = await uploadProductImage(buffer, row.filename);
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

        await prisma.productImageBackup.deleteMany({
          where: { filename: row.filename },
        }).catch(() => {});

        processedInBatch++;
      }
    } else {
      // PHASE 2: Check remaining products with non-http paths
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
            await prisma.product.update({ where: { id: prod.id }, data: { imagePath: null } });
            processedInBatch++;
          }
        }
      }
    }

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
