import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncWebStoreBatch } from "@/lib/webStoreAutoSync";

const STORE_URL = process.env.WC_STORE_URL || "https://lk-tronics.com";
const CONSUMER_KEY =
  process.env.WC_CONSUMER_KEY || "ck_22b402285407603fe1525f48e8bd6adcfb06f3a0";
const CONSUMER_SECRET =
  process.env.WC_CONSUMER_SECRET || "cs_2c1aa243a6bb144fa71c13072a7d067318ac90ac";

// GET /api/products/sync-web-store (Get sync status and store info)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader =
      "Basic " +
      Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

    // Fetch total products count from WooCommerce
    const res = await fetch(
      `${STORE_URL}/wp-json/wc/v3/products?per_page=1&status=publish`,
      {
        headers: {
          Authorization: authHeader,
        },
        cache: "no-store",
      }
    );

    const totalStoreProducts = parseInt(
      res.headers.get("x-wp-total") || "0",
      10
    );
    const totalPages = parseInt(
      res.headers.get("x-wp-totalpages") || "0",
      10
    );

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
      connected: res.ok,
      storeUrl: STORE_URL,
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

// POST /api/products/sync-web-store (Sync / import products from lk-tronics.com)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id, 10);
    const body = await request.json().catch(() => ({}));

    const result = await syncWebStoreBatch({
      page: body.page,
      perPage: body.perPage || 100,
      syncAll: Boolean(body.syncAll),
      maxPages: body.maxPages || 15,
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
