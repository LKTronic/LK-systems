import { NextRequest, NextResponse } from "next/server";
import { createEncryptedBackup } from "@/lib/backupEngine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
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
      return NextResponse.json({ success: false, error: "Unauthorized cron trigger." }, { status: 401 });
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const isSunday = now.getUTCDay() === 0;

    const markers = await prisma.systemSetting.findMany({
      where: {
        key: { in: ["pms_last_backup_daily", "pms_last_backup_weekly"] },
      },
    });

    let lastDailyDate: string | null = null;
    let lastWeeklyDate: string | null = null;
    markers.forEach((m) => {
      if (m.key === "pms_last_backup_daily") lastDailyDate = m.value.split("T")[0];
      if (m.key === "pms_last_backup_weekly") lastWeeklyDate = m.value.split("T")[0];
    });

    const results: any[] = [];

    // 1. Run daily backup if not executed today
    if (lastDailyDate !== todayStr) {
      const dailyRes = await createEncryptedBackup("DAILY");
      results.push({ type: "DAILY", status: "created", id: dailyRes.id });
    } else {
      results.push({ type: "DAILY", status: "already_executed_today", date: todayStr });
    }

    // 2. Run weekly backup if Sunday and not executed this week
    if (isSunday && lastWeeklyDate !== todayStr) {
      const weeklyRes = await createEncryptedBackup("WEEKLY");
      results.push({ type: "WEEKLY", status: "created", id: weeklyRes.id });
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (err: any) {
    console.error("Cron backup error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Backup cron execution failed" },
      { status: 500 }
    );
  }
}
