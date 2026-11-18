import { prisma } from "@/lib/prisma";
import { ProductHandoverData } from "./handoverPdfGenerator";

const SETTING_KEY = "productHandoverLetters";
let cachedHandovers: { data: ProductHandoverData[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 1000; // 10 seconds

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
 * Fetch all saved handover letters from SystemSetting
 */
export async function getHandoverLetters(): Promise<ProductHandoverData[]> {
  const now = Date.now();
  if (cachedHandovers && now - cachedHandovers.timestamp < CACHE_TTL_MS) {
    return cachedHandovers.data;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) {
          cachedHandovers = { data: parsed, timestamp: now };
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse productHandoverLetters JSON:", e);
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
 * Save or update a product handover letter record
 */
export async function saveHandoverLetter(item: ProductHandoverData): Promise<ProductHandoverData> {
  const current = await getHandoverLetters();
  const nowIso = new Date().toISOString();

  let updatedList: ProductHandoverData[];
  const existingIdx = item.id ? current.findIndex((h) => h.id === item.id) : -1;

  if (existingIdx >= 0) {
    const updated: ProductHandoverData = {
      ...current[existingIdx],
      ...item,
      updatedAt: nowIso,
    };
    updatedList = [...current];
    updatedList[existingIdx] = updated;
  } else {
    const newEntry: ProductHandoverData = {
      ...item,
      id: item.id || `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: item.createdAt || nowIso,
      updatedAt: nowIso,
    };
    updatedList = [newEntry, ...current];
  }

  const jsonValue = JSON.stringify(updatedList);

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: jsonValue },
    create: { key: SETTING_KEY, value: jsonValue },
  });

  cachedHandovers = { data: updatedList, timestamp: Date.now() };
  return existingIdx >= 0 ? updatedList[existingIdx] : updatedList[0];
}

/**
 * Delete a product handover letter record
 */
export async function deleteHandoverLetter(id: string): Promise<boolean> {
  const current = await getHandoverLetters();
  const filtered = current.filter((h) => h.id !== id);

  const jsonValue = JSON.stringify(filtered);

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: jsonValue },
    create: { key: SETTING_KEY, value: jsonValue },
  });

  cachedHandovers = { data: filtered, timestamp: Date.now() };
  return true;
}

