import { prisma } from "@/lib/prisma";
import {
  ProductChecklist,
  ProductChecklistType,
  ChecklistVideoInfo,
} from "./productChecklist";
import { deleteQcVideo } from "./cloudinary";

const SETTING_KEY = "productChecklists";
let cachedChecklists: { data: ProductChecklist[]; timestamp: number } | null = null;
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

function mapDbToProductChecklist(r: any): ProductChecklist {
  const rawNotes = safeParseJson(r.additionalNotes, []);
  let notesArray: any[] = [];
  let videoInfoObj: ChecklistVideoInfo | null = null;

  if (Array.isArray(rawNotes)) {
    notesArray = rawNotes;
  } else if (rawNotes && typeof rawNotes === "object") {
    notesArray = Array.isArray(rawNotes.notes) ? rawNotes.notes : [];
    videoInfoObj = rawNotes.videoInfo || null;
  }

  if (!videoInfoObj && r.videoInfo) {
    videoInfoObj = safeParseJson(r.videoInfo, null);
  }

  return {
    id: String(r.id),
    checklistNo: String(r.checklistNo),
    type: (r.type === "INVERTER" ? "INVERTER" : "BATTERY") as ProductChecklistType,
    status: (r.status === "DRAFT" ? "DRAFT" : "COMPLETED") as "DRAFT" | "COMPLETED",
    batteryInfo: safeParseJson(r.batteryInfo, undefined),
    inverterInfo: safeParseJson(r.inverterInfo, undefined),
    checkedDate: formatDate(r.checkedDate),
    tests: safeParseJson(r.tests, []),
    checkedByName: String(r.checkedByName || "QC Inspector"),
    checkedByDesignation: r.checkedByDesignation ? String(r.checkedByDesignation) : undefined,
    additionalNotes: notesArray,
    videoInfo: videoInfoObj,
    overallQcPassed: Boolean(Number(r.overallQcPassed) === 1 || r.overallQcPassed === true),
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Fetch all saved checklists from ProductChecklist table (with SystemSetting fallback)
 */
export async function getChecklists(): Promise<ProductChecklist[]> {
  const now = Date.now();
  if (cachedChecklists && now - cachedChecklists.timestamp < CACHE_TTL_MS) {
    return cachedChecklists.data;
  }

  // 1. Try querying the dedicated ProductChecklist table
  try {
    if ((prisma as any).productChecklist?.findMany) {
      const records = await (prisma as any).productChecklist.findMany({
        orderBy: { createdAt: "desc" },
      });
      if (Array.isArray(records) && records.length > 0) {
        const parsed = records.map(mapDbToProductChecklist);
        cachedChecklists = { data: parsed, timestamp: now };
        return parsed;
      }
    }

    const rows = await (prisma as any).$queryRawUnsafe(`
      SELECT \`id\`, \`checklistNo\`, \`type\`, \`status\`, \`checkedDate\`, \`checkedByName\`, \`checkedByDesignation\`,
             \`overallQcPassed\`, \`batteryInfo\`, \`inverterInfo\`, \`tests\`, \`additionalNotes\`, \`createdAt\`, \`updatedAt\`
      FROM \`ProductChecklist\`
      ORDER BY \`createdAt\` DESC
    `);

    if (Array.isArray(rows) && rows.length > 0) {
      const parsed = rows.map(mapDbToProductChecklist);
      cachedChecklists = { data: parsed, timestamp: now };
      return parsed;
    }
  } catch (err: any) {
    // Table might not exist yet; will fallback to SystemSetting below
  }

  // 2. Fallback to SystemSetting JSON storage
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        cachedChecklists = { data: parsed, timestamp: now };
        return parsed;
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
 * Save or update a product checklist record (in ProductChecklist table and backup to SystemSetting)
 */
export async function saveChecklist(checklist: ProductChecklist): Promise<ProductChecklist> {
  const now = new Date();
  const checkedDateObj = checklist.checkedDate ? new Date(checklist.checkedDate) : now;
  const batteryJson = checklist.batteryInfo ? JSON.stringify(checklist.batteryInfo) : null;
  const inverterJson = checklist.inverterInfo ? JSON.stringify(checklist.inverterInfo) : null;
  const testsJson = JSON.stringify(checklist.tests || []);
  const notesJson = checklist.videoInfo
    ? JSON.stringify({
        notes: checklist.additionalNotes || [],
        videoInfo: checklist.videoInfo,
      })
    : JSON.stringify(checklist.additionalNotes || []);
  const overallPassedInt = checklist.overallQcPassed ? 1 : 0;
  const entryId = checklist.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Save directly into ProductChecklist table
  try {
    if ((prisma as any).productChecklist?.upsert) {
      await (prisma as any).productChecklist.upsert({
        where: { checklistNo: checklist.checklistNo },
        update: {
          type: checklist.type,
          status: checklist.status,
          checkedDate: checkedDateObj,
          checkedByName: checklist.checkedByName || "QC Inspector",
          checkedByDesignation: checklist.checkedByDesignation,
          overallQcPassed: Boolean(checklist.overallQcPassed),
          batteryInfo: batteryJson,
          inverterInfo: inverterJson,
          tests: testsJson,
          additionalNotes: notesJson,
          updatedAt: now,
        },
        create: {
          id: entryId,
          checklistNo: checklist.checklistNo,
          type: checklist.type,
          status: checklist.status,
          checkedDate: checkedDateObj,
          checkedByName: checklist.checkedByName || "QC Inspector",
          checkedByDesignation: checklist.checkedByDesignation,
          overallQcPassed: Boolean(checklist.overallQcPassed),
          batteryInfo: batteryJson,
          inverterInfo: inverterJson,
          tests: testsJson,
          additionalNotes: notesJson,
          createdAt: checklist.createdAt ? new Date(checklist.createdAt) : now,
          updatedAt: now,
        },
      });
    } else {
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO \`ProductChecklist\` 
          (\`id\`, \`checklistNo\`, \`type\`, \`status\`, \`checkedDate\`, \`checkedByName\`, \`checkedByDesignation\`, \`overallQcPassed\`, \`batteryInfo\`, \`inverterInfo\`, \`tests\`, \`additionalNotes\`, \`createdAt\`, \`updatedAt\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          \`type\` = VALUES(\`type\`),
          \`status\` = VALUES(\`status\`),
          \`checkedDate\` = VALUES(\`checkedDate\`),
          \`checkedByName\` = VALUES(\`checkedByName\`),
          \`checkedByDesignation\` = VALUES(\`checkedByDesignation\`),
          \`overallQcPassed\` = VALUES(\`overallQcPassed\`),
          \`batteryInfo\` = VALUES(\`batteryInfo\`),
          \`inverterInfo\` = VALUES(\`inverterInfo\`),
          \`tests\` = VALUES(\`tests\`),
          \`additionalNotes\` = VALUES(\`additionalNotes\`),
          \`updatedAt\` = VALUES(\`updatedAt\`)`,
        entryId,
        checklist.checklistNo,
        checklist.type,
        checklist.status,
        checklist.checkedDate || now.toISOString().split("T")[0],
        checklist.checkedByName || "QC Inspector",
        checklist.checkedByDesignation || null,
        overallPassedInt,
        batteryJson,
        inverterJson,
        testsJson,
        notesJson,
        checklist.createdAt ? new Date(checklist.createdAt) : now,
        now
      );
    }
  } catch (err: any) {
    console.warn("ProductChecklist table write error:", err?.message);
  }

  // 2. Also sync to SystemSetting as backup
  try {
    let currentInSetting: ProductChecklist[] = [];
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
      if (setting?.value) {
        currentInSetting = JSON.parse(setting.value);
        if (!Array.isArray(currentInSetting)) currentInSetting = [];
      }
    } catch {}

    const nowIso = now.toISOString();
    const existingIdx = currentInSetting.findIndex((c) => c.checklistNo === checklist.checklistNo || c.id === entryId);
    const itemToStore = {
      ...checklist,
      id: entryId,
      updatedAt: nowIso,
      createdAt: checklist.createdAt || nowIso,
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
    console.warn("SystemSetting backup write error:", err?.message);
  }

  cachedChecklists = null; // Invalidate cache immediately

  return {
    ...checklist,
    id: entryId,
    updatedAt: now.toISOString(),
  };
}

/**
 * Delete a product checklist record (and cleans up any attached Cloudinary video)
 */
export async function deleteChecklist(id: string): Promise<boolean> {
  // 0. Auto-delete attached video from Cloudinary if present
  try {
    const checklists = await getChecklists();
    const target = checklists.find((c) => c.id === id || c.checklistNo === id);
    if (target?.videoInfo?.publicId) {
      await deleteQcVideo(target.videoInfo.publicId);
    }
  } catch (err: any) {
    console.warn("Failed to delete video from Cloudinary during checklist deletion:", err?.message);
  }

  // 1. Delete from ProductChecklist table
  try {
    if ((prisma as any).productChecklist?.deleteMany) {
      await (prisma as any).productChecklist.deleteMany({
        where: { OR: [{ id }, { checklistNo: id }] },
      });
    } else {
      await (prisma as any).$executeRawUnsafe(
        "DELETE FROM `ProductChecklist` WHERE `id` = ? OR `checklistNo` = ?",
        id,
        id
      );
    }
  } catch (err: any) {
    console.warn("ProductChecklist table delete error:", err?.message);
  }

  // 2. Also remove from SystemSetting backup
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((c: any) => c.id !== id && c.checklistNo !== id);
        await prisma.systemSetting.upsert({
          where: { key: SETTING_KEY },
          update: { value: JSON.stringify(filtered) },
          create: { key: SETTING_KEY, value: JSON.stringify(filtered) },
        });
      }
    }
  } catch (err: any) {
    console.warn("SystemSetting delete error:", err?.message);
  }

  cachedChecklists = null;
  return true;
}

/**
 * Attach or update video on an existing checklist
 */
export async function attachChecklistVideo(
  id: string,
  videoInfo: ChecklistVideoInfo
): Promise<ProductChecklist | null> {
  const checklists = await getChecklists();
  const target = checklists.find((c) => c.id === id || c.checklistNo === id);
  if (!target) return null;

  // If previous video existed with different publicId, delete the old one
  if (target.videoInfo?.publicId && target.videoInfo.publicId !== videoInfo.publicId) {
    try {
      await deleteQcVideo(target.videoInfo.publicId);
    } catch {}
  }

  target.videoInfo = videoInfo;
  return await saveChecklist(target);
}

/**
 * Delete only the video from a checklist without deleting the checklist itself
 */
export async function deleteChecklistVideo(
  id: string
): Promise<{ success: boolean; checklist?: ProductChecklist; error?: string }> {
  const checklists = await getChecklists();
  const target = checklists.find((c) => c.id === id || c.checklistNo === id);
  if (!target) {
    return { success: false, error: "Checklist not found" };
  }

  if (target.videoInfo?.publicId) {
    try {
      await deleteQcVideo(target.videoInfo.publicId);
    } catch (err: any) {
      console.warn("Failed to delete video from Cloudinary:", err?.message);
    }
  }

  target.videoInfo = null;
  const updated = await saveChecklist(target);
  return { success: true, checklist: updated };
}
