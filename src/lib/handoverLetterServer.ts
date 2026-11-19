import { prisma } from "@/lib/prisma";
import { ProductHandoverData } from "./handoverPdfGenerator";

const SETTING_KEY = "productHandoverLetters";
let cachedHandovers: { data: ProductHandoverData[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 3 * 1000; // 3 seconds

function safeParseJson(val: any, fallback: any = null) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function formatDate(val: any): string {
  if (!val) return new Date().toISOString().split("T")[0];
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val);
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

function mapDbToHandover(r: any): ProductHandoverData {
  return {
    id: String(r.id),
    refNo: String(r.refNo),
    productName: String(r.productName || ""),
    modelDescription: r.modelDescription ? String(r.modelDescription) : "",
    serialNumbers: r.serialNumbers ? String(r.serialNumbers) : "",
    quantity: String(r.quantity || "1 Unit"),
    additionalItems: safeParseJson(r.additionalItems, []),
    collectorName: String(r.collectorName || ""),
    collectorDesignation: r.collectorDesignation ? String(r.collectorDesignation) : undefined,
    handoverDate: formatDate(r.handoverDate),
    contactNumber: r.contactNumber ? String(r.contactNumber) : undefined,
    confirmationText: r.confirmationText ? String(r.confirmationText) : undefined,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
  };
}

/**
 * Generate default auto-reference number for Handover Letter
 */
export function formatAutoHandoverRefNo(dateOverride?: Date): string {
  const d = dateOverride || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `HL-${yyyy}${mm}${dd}-01`;
}

/**
 * Fetch all saved handover letters from HandoverLetter table (with SystemSetting fallback)
 */
export async function getHandoverLetters(): Promise<ProductHandoverData[]> {
  const now = Date.now();
  if (cachedHandovers && now - cachedHandovers.timestamp < CACHE_TTL_MS) {
    return cachedHandovers.data;
  }

  // 1. Try querying dedicated HandoverLetter table
  try {
    if ((prisma as any).handoverLetter?.findMany) {
      const records = await (prisma as any).handoverLetter.findMany({
        orderBy: { createdAt: "desc" },
      });
      if (Array.isArray(records) && records.length > 0) {
        const parsed = records.map(mapDbToHandover);
        cachedHandovers = { data: parsed, timestamp: now };
        return parsed;
      }
    }

    const rows = await (prisma as any).$queryRawUnsafe(`
      SELECT \`id\`, \`refNo\`, \`productName\`, \`modelDescription\`, \`serialNumbers\`, \`quantity\`,
             \`additionalItems\`, \`collectorName\`, \`collectorDesignation\`, \`handoverDate\`,
             \`contactNumber\`, \`confirmationText\`, \`createdAt\`, \`updatedAt\`
      FROM \`HandoverLetter\`
      ORDER BY \`createdAt\` DESC
    `);

    if (Array.isArray(rows) && rows.length > 0) {
      const parsed = rows.map(mapDbToHandover);
      cachedHandovers = { data: parsed, timestamp: now };
      return parsed;
    }
  } catch (err: any) {
    // HandoverLetter table might not exist yet; will fallback below
  }

  // 2. Fallback to SystemSetting JSON storage
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        cachedHandovers = { data: parsed, timestamp: now };
        return parsed;
      }
    }
  } catch (err) {
    console.error("Database error in getHandoverLetters:", err);
  }

  return [];
}

/**
 * Generate sequential handover reference number: e.g. HL-20261117-01
 */
export async function getNextHandoverRefNo(dateOverride?: Date): Promise<string> {
  const all = await getHandoverLetters();
  const now = dateOverride || new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `HL-${dateStr}`;

  const matching = all
    .map((h) => h.refNo || "")
    .filter((no) => no.startsWith(prefix));

  if (matching.length === 0) {
    return `${prefix}-01`;
  }

  let maxSeq = 0;
  for (const no of matching) {
    const parts = no.split("-");
    const suffix = parts[parts.length - 1];
    const seq = parseInt(suffix, 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(2, "0");
  return `${prefix}-${nextSeq}`;
}

/**
 * Save or update a product handover letter record (in HandoverLetter table and backup to SystemSetting)
 */
export async function saveHandoverLetter(item: ProductHandoverData): Promise<ProductHandoverData> {
  const now = new Date();
  const handoverDateObj = item.handoverDate ? new Date(item.handoverDate) : now;
  const itemsJson = item.additionalItems ? JSON.stringify(item.additionalItems) : null;
  const entryId = item.id || `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Save directly to HandoverLetter table
  try {
    if ((prisma as any).handoverLetter?.upsert) {
      await (prisma as any).handoverLetter.upsert({
        where: { refNo: item.refNo },
        update: {
          productName: item.productName || "",
          modelDescription: item.modelDescription || null,
          serialNumbers: item.serialNumbers || null,
          quantity: item.quantity || "1 Unit",
          additionalItems: itemsJson,
          collectorName: item.collectorName || "",
          collectorDesignation: item.collectorDesignation || "Quality Control & Hardware Engineer",
          handoverDate: handoverDateObj,
          contactNumber: item.contactNumber || "+94 76 357 31 31",
          confirmationText: item.confirmationText || null,
          updatedAt: now,
        },
        create: {
          id: entryId,
          refNo: item.refNo,
          productName: item.productName || "",
          modelDescription: item.modelDescription || null,
          serialNumbers: item.serialNumbers || null,
          quantity: item.quantity || "1 Unit",
          additionalItems: itemsJson,
          collectorName: item.collectorName || "",
          collectorDesignation: item.collectorDesignation || "Quality Control & Hardware Engineer",
          handoverDate: handoverDateObj,
          contactNumber: item.contactNumber || "+94 76 357 31 31",
          confirmationText: item.confirmationText || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : now,
          updatedAt: now,
        },
      });
    } else {
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO \`HandoverLetter\`
          (\`id\`, \`refNo\`, \`productName\`, \`modelDescription\`, \`serialNumbers\`, \`quantity\`,
           \`additionalItems\`, \`collectorName\`, \`collectorDesignation\`, \`handoverDate\`,
           \`contactNumber\`, \`confirmationText\`, \`createdAt\`, \`updatedAt\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          \`productName\` = VALUES(\`productName\`),
          \`modelDescription\` = VALUES(\`modelDescription\`),
          \`serialNumbers\` = VALUES(\`serialNumbers\`),
          \`quantity\` = VALUES(\`quantity\`),
          \`additionalItems\` = VALUES(\`additionalItems\`),
          \`collectorName\` = VALUES(\`collectorName\`),
          \`collectorDesignation\` = VALUES(\`collectorDesignation\`),
          \`handoverDate\` = VALUES(\`handoverDate\`),
          \`contactNumber\` = VALUES(\`contactNumber\`),
          \`confirmationText\` = VALUES(\`confirmationText\`),
          \`updatedAt\` = VALUES(\`updatedAt\`)`,
        entryId,
        item.refNo,
        item.productName || "",
        item.modelDescription || null,
        item.serialNumbers || null,
        item.quantity || "1 Unit",
        itemsJson,
        item.collectorName || "",
        item.collectorDesignation || "Quality Control & Hardware Engineer",
        item.handoverDate || now.toISOString().split("T")[0],
        item.contactNumber || "+94 76 357 31 31",
        item.confirmationText || null,
        item.createdAt ? new Date(item.createdAt) : now,
        now
      );
    }
  } catch (err: any) {
    console.warn("HandoverLetter table direct write error:", err?.message);
  }

  // 2. Also sync to SystemSetting as backup
  try {
    let currentInSetting: ProductHandoverData[] = [];
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
      if (setting?.value) {
        currentInSetting = JSON.parse(setting.value);
        if (!Array.isArray(currentInSetting)) currentInSetting = [];
      }
    } catch {}

    const nowIso = now.toISOString();
    const existingIdx = currentInSetting.findIndex((h) => h.refNo === item.refNo || (item.id && h.id === item.id));
    const itemToStore: ProductHandoverData = {
      ...item,
      id: entryId,
      createdAt: item.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      currentInSetting[existingIdx] = itemToStore;
    } else {
      currentInSetting = [itemToStore, ...currentInSetting];
    }

    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(currentInSetting) },
      create: { key: SETTING_KEY, value: JSON.stringify(currentInSetting) },
    });
  } catch (err: any) {
    console.warn("SystemSetting handover backup error:", err?.message);
  }

  cachedHandovers = null; // Invalidate cache immediately

  return {
    ...item,
    id: entryId,
    updatedAt: now.toISOString(),
  };
}

/**
 * Delete a product handover letter record
 */
export async function deleteHandoverLetter(id: string): Promise<boolean> {
  // 1. Delete from HandoverLetter table
  try {
    if ((prisma as any).handoverLetter?.deleteMany) {
      await (prisma as any).handoverLetter.deleteMany({
        where: { OR: [{ id }, { refNo: id }] },
      });
    } else {
      await (prisma as any).$executeRawUnsafe(
        "DELETE FROM `HandoverLetter` WHERE `id` = ? OR `refNo` = ?",
        id,
        id
      );
    }
  } catch (err: any) {
    console.warn("HandoverLetter table delete error:", err?.message);
  }

  // 2. Also remove from SystemSetting backup
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((h: any) => h.id !== id && h.refNo !== id);
        await prisma.systemSetting.upsert({
          where: { key: SETTING_KEY },
          update: { value: JSON.stringify(filtered) },
          create: { key: SETTING_KEY, value: JSON.stringify(filtered) },
        });
      }
    }
  } catch (err: any) {
    console.warn("SystemSetting handover delete error:", err?.message);
  }

  cachedHandovers = null;
  return true;
}
