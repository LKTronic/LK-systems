import { prisma } from "@/lib/prisma";
import {
  ProductChecklist,
  ProductChecklistType,
} from "./productChecklist";

const SETTING_KEY = "productChecklists";
let cachedChecklists: { data: ProductChecklist[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 1000; // 10 seconds

/**
 * Fetch all saved checklists from SystemSetting
 */
export async function getChecklists(): Promise<ProductChecklist[]> {
  const now = Date.now();
  if (cachedChecklists && now - cachedChecklists.timestamp < CACHE_TTL_MS) {
    return cachedChecklists.data;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (setting && setting.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) {
          cachedChecklists = { data: parsed, timestamp: now };
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse productChecklists JSON:", e);
      }
    }
  } catch (err) {
    console.error("Database error in getChecklists:", err);
  }

  return [];
}

/**
 * Generate sequential checklist number: e.g. QC-BAT-20261117-01 or QC-INV-20261117-01
 */
export async function getNextChecklistNo(type: ProductChecklistType, dateOverride?: Date): Promise<string> {
  const all = await getChecklists();
  const now = dateOverride || new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = type === "BATTERY" ? `QC-BAT-${dateStr}` : `QC-INV-${dateStr}`;

  const matching = all
    .map((c) => c.checklistNo || "")
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
 * Save or update a product checklist record
 */
export async function saveChecklist(checklist: ProductChecklist): Promise<ProductChecklist> {
  const current = await getChecklists();
  const nowIso = new Date().toISOString();

  let updatedList: ProductChecklist[];
  const existingIdx = current.findIndex((c) => c.id === checklist.id);

  if (existingIdx >= 0) {
    const updated = {
      ...checklist,
      updatedAt: nowIso,
    };
    updatedList = [...current];
    updatedList[existingIdx] = updated;
  } else {
    const newEntry = {
      ...checklist,
      createdAt: checklist.createdAt || nowIso,
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

  cachedChecklists = { data: updatedList, timestamp: Date.now() };
  return existingIdx >= 0 ? updatedList[existingIdx] : updatedList[0];
}

/**
 * Delete a product checklist record
 */
export async function deleteChecklist(id: string): Promise<boolean> {
  const current = await getChecklists();
  const filtered = current.filter((c) => c.id !== id);

  const jsonValue = JSON.stringify(filtered);

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: jsonValue },
    create: { key: SETTING_KEY, value: jsonValue },
  });

  cachedChecklists = { data: filtered, timestamp: Date.now() };
  return true;
}

