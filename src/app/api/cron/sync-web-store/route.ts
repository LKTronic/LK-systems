import { NextRequest, NextResponse } from "next/server";
import { syncWebStoreBatch, triggerAutoSyncIfStale, getWooCommerceConfig } from "@/lib/webStoreAutoSync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return handleCronSync(req);
}

export async function POST(req: NextRequest) {
  return handleCronSync(req);
}

async function handleCronSync(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyParam = searchParams.get("key") || searchParams.get("token");
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");

    const expectedSecret =
      process.env.CRON_SECRET ||
      process.env.BACKUP_CRON_SECRET ||
      process.env.AUTH_SECRET ||
      "pms-auto-backup-default-cron-key-2026";

    const provided = keyParam || bearerToken;
    if (provided !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized cron trigger." },
        { status: 401 }
      );
    }

    // Verify WooCommerce config is available
    getWooCommerceConfig();

    const isFull = searchParams.get("full") === "true";
    if (isFull) {
      // Full sync across multiple pages
      const result = await syncWebStoreBatch({
        page: 1,
        perPage: 100,
        syncAll: true,
        maxPages: 15,
      });
      return NextResponse.json({ success: true, mode: "full", result });
    }

    // Normal hourly sync (latest updates & new products)
    const result = await syncWebStoreBatch({
      page: 1,
      perPage: 50,
      syncAll: false,
    });

    return NextResponse.json({ success: true, mode: "hourly", result });
  } catch (err: any) {
    console.error("[CronSync] Execution error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "WooCommerce cron sync execution failed" },
      { status: 500 }
    );
  }
}
