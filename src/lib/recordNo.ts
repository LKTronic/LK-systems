import { PrismaClient } from "@prisma/client";

/**
 * Generate the next record number formatted with 6 digits padding (e.g., 000001, 000125)
 * Uses a locking read (FOR UPDATE) to prevent concurrency collisions.
 */
export async function getNextRecordNo(tx: any): Promise<string> {
  let lastProduct: { id: number; recordNo: string } | null = null;

  try {
    const rows = await tx.$queryRawUnsafe(
      "SELECT id, recordNo FROM Product ORDER BY id DESC LIMIT 1 FOR UPDATE"
    );
    if (rows && rows.length > 0) {
      lastProduct = rows[0];
    }
  } catch (e) {
    lastProduct = await tx.product.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, recordNo: true },
    });
  }

  if (!lastProduct) {
    return "000001";
  }

  const recordNum = parseInt(lastProduct.recordNo, 10);
  const nextNum = isNaN(recordNum)
    ? lastProduct.id + 1
    : Math.max(recordNum + 1, lastProduct.id + 1);
  return nextNum.toString().padStart(6, "0");
}

/**
 * Generate the next SKU formatted with prefix LKREQ and 5 digits padding (e.g., LKREQ00001, LKREQ00002)
 * Uses a locking read (FOR UPDATE) to ensure concurrent transactions always see the latest committed SKU.
 */
export async function getNextSku(tx: any): Promise<string> {
  let maxNum = 0;

  try {
    const rows = await tx.$queryRawUnsafe(
      "SELECT MAX(CAST(SUBSTRING(sku, 6) AS UNSIGNED)) as maxSku FROM Product WHERE sku LIKE 'LKREQ%' FOR UPDATE"
    );
    if (rows && rows.length > 0 && rows[0]?.maxSku != null) {
      maxNum = Number(rows[0].maxSku) || 0;
    }
  } catch (e) {
    const productsWithSku = await tx.product.findMany({
      where: { sku: { startsWith: "LKREQ" } },
      select: { sku: true },
    });
    for (const p of productsWithSku) {
      if (!p.sku) continue;
      const numPart = p.sku.replace(/^LKREQ/i, "").trim();
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `LKREQ${nextNum.toString().padStart(5, "0")}`;
}

/**
 * Executes a callback with an exclusive MySQL named lock ('pms_sku_sequence_lock').
 * This ensures that concurrent requests from multiple users queue up sequentially
 * and never generate duplicate SKUs or Record numbers.
 */
export async function withSequenceLock<T>(tx: any, fn: () => Promise<T>): Promise<T> {
  let lockAcquired = false;
  try {
    const res = await tx.$queryRawUnsafe("SELECT GET_LOCK('pms_sku_sequence_lock', 10) as locked");
    lockAcquired = Boolean(res && res[0] && Number(res[0].locked) === 1);
  } catch (e) {
    // If named lock query fails, proceed with row-level FOR UPDATE
  }

  try {
    return await fn();
  } finally {
    if (lockAcquired) {
      try {
        await tx.$queryRawUnsafe("SELECT RELEASE_LOCK('pms_sku_sequence_lock')");
      } catch (e) {
        // ignore
      }
    }
  }
}

