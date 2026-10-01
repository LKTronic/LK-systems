import { prisma } from "@/lib/prisma";

const DEFAULT_PRICE_VALIDITY_MONTHS = 6;

// In-memory cache for settings (avoids hitting DB on every read)
let cachedValidityMonths: { value: number; timestamp: number } | null = null;
const SETTING_CACHE_TTL_MS = 60 * 1000; // 1 minute

// Throttling for autoExpire to avoid executing write locks on every search/filter
let lastAutoExpireTimestamp = 0;
const AUTO_EXPIRE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function getPriceValidityMonths(): Promise<number> {
  const now = Date.now();
  if (cachedValidityMonths && now - cachedValidityMonths.timestamp < SETTING_CACHE_TTL_MS) {
    return cachedValidityMonths.value;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "priceValidityMonths" },
    });
    if (setting && !isNaN(parseInt(setting.value, 10))) {
      const val = parseInt(setting.value, 10);
      cachedValidityMonths = { value: val, timestamp: now };
      return val;
    }
  } catch (error) {
    console.error("Error reading priceValidityMonths setting:", error);
  }
  return DEFAULT_PRICE_VALIDITY_MONTHS;
}

export async function setPriceValidityMonths(months: number): Promise<number> {
  const sanitized = Math.max(1, Math.min(60, months));
  cachedValidityMonths = { value: sanitized, timestamp: Date.now() };
  await prisma.systemSetting.upsert({
    where: { key: "priceValidityMonths" },
    update: { value: sanitized.toString() },
    create: { key: "priceValidityMonths", value: sanitized.toString() },
  });
  return sanitized;
}

/**
 * Checks and updates any ACTIVE products whose price was set longer than validityMonths ago,
 * transitioning their status to EXPIRED.
 * Throttled to run at most once every 5 minutes unless forced.
 */
export async function autoExpireOutdatedProducts(validityMonths?: number, force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastAutoExpireTimestamp < AUTO_EXPIRE_INTERVAL_MS) {
    return 0;
  }
  lastAutoExpireTimestamp = now;

  try {
    const months = validityMonths || (await getPriceValidityMonths());
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    const result = await prisma.product.updateMany({
      where: {
        status: "ACTIVE",
        priceUpdatedAt: {
          lt: cutoffDate,
        },
        OR: [
          // Local PMS products expire after validity period
          { source: "PMS" },
          // Online web products ONLY expire if their price was requested & updated via PMS (has supplierId)
          {
            source: { not: "PMS" },
            supplierId: { not: null },
          },
        ],
      },
      data: {
        status: "EXPIRED",
      },
    });

    return result.count;
  } catch (error) {
    console.error("Error auto-expiring products:", error);
    return 0;
  }
}
