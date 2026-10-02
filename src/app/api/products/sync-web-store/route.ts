import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncWebStoreBatch, getWooCommerceConfig } from "@/lib/webStoreAutoSync";

// GET /api/products/sync-web-store (Get sync status and store info)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let config;
    try {
      config = getWooCommerceConfig();
    } catch (cfgErr: any) {
      return NextResponse.json(
        { error: cfgErr?.message || "WooCommerce configuration missing." },
        { status: 503 }
      );
    }

    const { storeUrl, authHeader } = config;

    let totalStoreProducts = 0;
    let totalPages = 0;
    let isConnected = false;

    // Gracefully check WooCommerce connectivity with timeout for offline support
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(
        `${storeUrl}/wp-json/wc/v3/products?per_page=1&status=publish`,
        {
          headers: { Authorization: authHeader },
          cache: "no-store",
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        isConnected = true;
        totalStoreProducts = parseInt(res.headers.get("x-wp-total") || "0", 10);
        totalPages = parseInt(res.headers.get("x-wp-totalpages") || "0", 10);
      }
    } catch {
      // Offline mode: gracefully continue using local PMS database
      isConnected = false;
    }

    // Get count of products already synced in PMS as ONLINE_WEB / LK_TRONICS
    const [syncedCount, pmsTotalCount, lastSyncedProduct] = await Promise.all([
      prisma.product.count({
        where: {
          OR: [
            { source: "ONLINE_WEB" },
            { source: "LK_TRONICS" },
            { externalId: { not: null } },
          ],
        },
      }),
      prisma.product.count(),
      prisma.product.findFirst({
        where: {
          OR: [
            { source: "ONLINE_WEB" },
            { source: "LK_TRONICS" },
            { externalId: { not: null } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return NextResponse.json({
      connected: isConnected,
      storeUrl,
      totalStoreProducts,
      totalPages,
      syncedInPms: syncedCount,
      pmsTotalCount,
      lastSyncedAt: lastSyncedProduct?.updatedAt || null,
    });
  } catch (error: any) {
    console.error("Error getting web store status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch store status" },
      { status: 500 }
    );
  }
}

// POST /api/products/sync-web-store (Sync / import products from lk-tronics.com - Admin/Superadmin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only administrators can trigger web store synchronization." },
        { status: 403 }
      );
    }

    const userId = parseInt((session.user as any).id, 10);
    const body = await request.json().catch(() => ({}));

    const page = Math.max(1, parseInt(body.page || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(body.perPage || "50", 10)));
    const maxPages = Math.min(20, Math.max(1, parseInt(body.maxPages || "15", 10)));

    const result = await syncWebStoreBatch({
      page,
      perPage,
      syncAll: Boolean(body.syncAll),
      maxPages,
      userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in sync-web-store:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync products from web store" },
      { status: 500 }
    );
  }
}
