import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Short in-memory cache (3 seconds) to speed up repeated page navigations
let cachedStats: { data: any; timestamp: number } | null = null;
const STATS_CACHE_TTL_MS = 3000;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    if (cachedStats && now - cachedStats.timestamp < STATS_CACHE_TTL_MS) {
      return NextResponse.json(cachedStats.data, {
        headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=5" },
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Run parallel aggregated queries instead of multiple individual count queries
    const [statusGroups, totalSuppliers, addedToday, recentProducts] = await Promise.all([
      prisma.product.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.supplier.count(),
      prisma.product.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.product.findMany({
        take: 6,
        orderBy: { id: "desc" },
        select: {
          id: true,
          recordNo: true,
          referenceNo: true,
          productName: true,
          modelAndName: true,
          price: true,
          priceLKR: true,
          status: true,
          createdAt: true,
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          author: { select: { name: true, username: true } },
        },
      }),
    ]);

    let totalProducts = 0;
    let pendingRequests = 0;
    let quotedProducts = 0;
    let priceNotAvailable = 0;
    let activeProducts = 0;
    let notRequestedProducts = 0;

    for (const group of statusGroups) {
      const count = group._count.id;
      totalProducts += count;
      if (group.status === "PENDING") pendingRequests = count;
      else if (group.status === "QUOTED") quotedProducts = count;
      else if (group.status === "PRICE_NOT_AVAILABLE") priceNotAvailable = count;
      else if (group.status === "ACTIVE") activeProducts = count;
      else if (group.status === "NOT_REQUESTED") notRequestedProducts = count;
    }

    const data = {
      totalProducts,
      pendingRequests,
      quotedProducts,
      priceNotAvailable,
      activeProducts,
      notRequestedProducts,
      totalSuppliers,
      addedToday,
      recentProducts,
    };

    cachedStats = { data, timestamp: now };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=5" },
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
