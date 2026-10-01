import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/clear-data (Get counts for Superadmin data clearance)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Superadmin role required" },
        { status: 403 }
      );
    }

    const [total, webSyncCount, pmsCount] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({
        where: {
          OR: [
            { source: "ONLINE_WEB" },
            { source: "LK_TRONICS" },
            { externalId: { not: null } },
          ],
        },
      }),
      prisma.product.count({
        where: {
          AND: [
            { source: { notIn: ["ONLINE_WEB", "LK_TRONICS"] } },
            { externalId: null },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      total,
      webSyncCount,
      pmsCount,
    });
  } catch (error: any) {
    console.error("Error getting data counts for superadmin:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch counts" },
      { status: 500 }
    );
  }
}

// POST /api/admin/clear-data (Execute data clearance - Superadmin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Superadmin role required to perform data cleanup" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const target = body.target; // "WEB_SYNC" | "PMS" | "ALL"

    if (target !== "WEB_SYNC" && target !== "PMS" && target !== "ALL") {
      return NextResponse.json(
        { error: "Invalid target. Must be 'WEB_SYNC', 'PMS', or 'ALL'" },
        { status: 400 }
      );
    }

    let deletedCount = 0;
    let revertedCount = 0;

    if (target === "WEB_SYNC") {
      // Rule: Do not delete online web products; remove PMS modifications only
      const webProducts = await prisma.product.findMany({
        where: {
          OR: [
            { source: "ONLINE_WEB" },
            { source: "LK_TRONICS" },
            { externalId: { not: null } },
          ],
        },
        select: { id: true, price: true, additionalNote: true },
      });

      const ids = webProducts.map((p) => p.id);
      if (ids.length > 0) {
        await prisma.productPriceHistory.deleteMany({
          where: { productId: { in: ids } },
        });

        for (const wp of webProducts) {
          let cleanNote = wp.additionalNote || "";
          cleanNote = cleanNote.replace(/\[PMS Updated Price[^\]]*\]\s*/g, "").trim();
          const resetStatus = Number(wp.price) === 0 ? "PRICE_NOT_AVAILABLE" : "ACTIVE";

          await prisma.product.update({
            where: { id: wp.id },
            data: {
              supplierId: null,
              priceUpdatedAt: null,
              priceUSD: null,
              warrantyPeriod: null,
              priceValidity: null,
              leadTime: null,
              isBrandNewOriginal: null,
              supplierImage: null,
              supplierNote: null,
              additionalNote: cleanNote || null,
              status: resetStatus,
            },
          });
        }
        revertedCount = ids.length;
      }

      return NextResponse.json({
        success: true,
        target,
        deletedCount: 0,
        revertedCount,
        message: `Successfully removed PMS modifications from ${revertedCount} Online Web products. Products remain intact in PMS repository.`,
      });
    }

    if (target === "PMS") {
      const pmsProducts = await prisma.product.findMany({
        where: {
          AND: [
            { source: { notIn: ["ONLINE_WEB", "LK_TRONICS"] } },
            { externalId: null },
          ],
        },
        select: { id: true },
      });

      const ids = pmsProducts.map((p) => p.id);
      if (ids.length > 0) {
        await prisma.productPriceHistory.deleteMany({
          where: { productId: { in: ids } },
        });
        await prisma.productHistory.deleteMany({
          where: { productId: { in: ids } },
        });
        const res = await prisma.product.deleteMany({
          where: { id: { in: ids } },
        });
        deletedCount = res.count;
      }

      return NextResponse.json({
        success: true,
        target,
        deletedCount,
        message: `Successfully cleared all ${deletedCount} PMS local products. Online Web products remain untouched.`,
      });
    }

    if (target === "ALL") {
      // 1. Delete PMS local products
      const pmsProducts = await prisma.product.findMany({
        where: {
          AND: [
            { source: { notIn: ["ONLINE_WEB", "LK_TRONICS"] } },
            { externalId: null },
          ],
        },
        select: { id: true },
      });
      const pmsIds = pmsProducts.map((p) => p.id);

      if (pmsIds.length > 0) {
        await prisma.productPriceHistory.deleteMany({
          where: { productId: { in: pmsIds } },
        });
        await prisma.productHistory.deleteMany({
          where: { productId: { in: pmsIds } },
        });
        const res = await prisma.product.deleteMany({
          where: { id: { in: pmsIds } },
        });
        deletedCount = res.count;
      }

      // 2. Online Web products are NEVER deleted; remove PMS modifications only
      const webProducts = await prisma.product.findMany({
        where: {
          OR: [
            { source: "ONLINE_WEB" },
            { source: "LK_TRONICS" },
            { externalId: { not: null } },
          ],
        },
        select: { id: true, price: true, additionalNote: true },
      });

      const webIds = webProducts.map((p) => p.id);
      if (webIds.length > 0) {
        await prisma.productPriceHistory.deleteMany({
          where: { productId: { in: webIds } },
        });

        for (const wp of webProducts) {
          let cleanNote = wp.additionalNote || "";
          cleanNote = cleanNote.replace(/\[PMS Updated Price[^\]]*\]\s*/g, "").trim();
          const resetStatus = Number(wp.price) === 0 ? "PRICE_NOT_AVAILABLE" : "ACTIVE";

          await prisma.product.update({
            where: { id: wp.id },
            data: {
              supplierId: null,
              priceUpdatedAt: null,
              priceUSD: null,
              warrantyPeriod: null,
              priceValidity: null,
              leadTime: null,
              isBrandNewOriginal: null,
              supplierImage: null,
              supplierNote: null,
              additionalNote: cleanNote || null,
              status: resetStatus,
            },
          });
        }
        revertedCount = webIds.length;
      }

      return NextResponse.json({
        success: true,
        target,
        deletedCount,
        revertedCount,
        message: `Successfully deleted ${deletedCount} PMS local products and cleared PMS modifications from ${revertedCount} Online Web products (Online Web products are retained).`,
      });
    }
  } catch (error: any) {
    console.error("Error executing superadmin data cleanup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to clear data" },
      { status: 500 }
    );
  }
}
