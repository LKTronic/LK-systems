import { prisma } from "@/lib/prisma";
import { getCloudinaryClient, isCloudinaryConfigured } from "@/lib/cloudinary";
import { getChecklists } from "@/lib/productChecklistServer";
import { getHandoverLetters } from "@/lib/handoverLetterServer";
import crypto from "crypto";
import zlib from "zlib";
import { Readable } from "stream";

// Magic header to identify PMS encrypted backups (8 bytes)
const MAGIC_HEADER = Buffer.from("PMSENC01", "utf8");

/**
 * Resolves the backup encryption key:
 * 1. process.env.BACKUP_ENCRYPTION_KEY (user-configured custom secret)
 * 2. Fallback derived securely from process.env.AUTH_SECRET or process.env.DATABASE_URL
 */
export function getBackupEncryptionKey(): string {
  if (process.env.BACKUP_ENCRYPTION_KEY && process.env.BACKUP_ENCRYPTION_KEY.trim()) {
    return process.env.BACKUP_ENCRYPTION_KEY.trim();
  }
  const fallbackSource =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL ||
    "LK-Tronics-PMS-Secure-Default-Backup-Key-2026";
  // Derive a deterministic 32-byte key from available secret
  return crypto.createHash("sha256").update(`PMS_BACKUP_SALT:${fallbackSource}`).digest("hex");
}

/**
 * Encrypts a plain JSON string using AES-256-GCM + gzip compression
 * Binary Format: [MAGIC (8B)] + [SALT (16B)] + [IV (12B)] + [AUTHTAG (16B)] + [CIPHERTEXT]
 */
export function encryptBackupData(dataJson: string, passphrase?: string): Buffer {
  const secret = passphrase || getBackupEncryptionKey();
  const compressed = zlib.gzipSync(Buffer.from(dataJson, "utf8"), { level: 9 });

  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256");
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC_HEADER, salt, iv, authTag, ciphertext]);
}

/**
 * Decrypts a PMS encrypted backup buffer back to plain JSON
 */
export function decryptBackupData(encryptedBuffer: Buffer, passphrase?: string): any {
  const secret = passphrase || getBackupEncryptionKey();

  if (encryptedBuffer.length < 8 + 16 + 12 + 16) {
    throw new Error("Invalid backup file: File is too small or corrupted.");
  }

  const magic = encryptedBuffer.subarray(0, 8);
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error("Invalid backup file: Magic header does not match PMSENC01.");
  }

  const salt = encryptedBuffer.subarray(8, 24);
  const iv = encryptedBuffer.subarray(24, 36);
  const authTag = encryptedBuffer.subarray(36, 52);
  const ciphertext = encryptedBuffer.subarray(52);

  const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decompressed = zlib.gunzipSync(compressed);
    return JSON.parse(decompressed.toString("utf8"));
  } catch (err: any) {
    throw new Error(
      "Decryption failed: Incorrect encryption key or corrupted backup data (" +
        (err?.message || "Auth tag check failed") +
        ")."
    );
  }
}

export interface BackupMetadata {
  id: string;
  filename: string;
  publicId: string;
  type: "DAILY" | "WEEKLY" | "MANUAL";
  url: string;
  bytes: number;
  formattedSize: string;
  createdAt: string;
  recordCounts: Record<string, number>;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1.0) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1.0) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Collects complete snapshot of all PMS database tables
 */
export async function dumpDatabaseSnapshot(type: "DAILY" | "WEEKLY" | "MANUAL") {
  const [
    users,
    departments,
    categories,
    suppliers,
    products,
    productHistory,
    productPriceHistory,
    quotations,
    quotationItems,
    rdQuotations,
    rdQuotationItems,
    systemSettings,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.department.findMany(),
    prisma.category.findMany(),
    prisma.supplier.findMany(),
    prisma.product.findMany(),
    prisma.productHistory.findMany(),
    prisma.productPriceHistory.findMany(),
    prisma.quotation.findMany(),
    prisma.quotationItem.findMany(),
    prisma.rdQuotation.findMany(),
    prisma.rdQuotationItem.findMany(),
    prisma.systemSetting.findMany(),
  ]);

  const [checklists, handoverLetters] = await Promise.all([
    getChecklists().catch(() => []),
    getHandoverLetters().catch(() => []),
  ]);

  let imageBackupCount = 0;
  try {
    imageBackupCount = await prisma.productImageBackup.count();
  } catch (e) {
    // optional table
  }

  const recordCounts = {
    users: users.length,
    departments: departments.length,
    categories: categories.length,
    suppliers: suppliers.length,
    products: products.length,
    productHistory: productHistory.length,
    productPriceHistory: productPriceHistory.length,
    quotations: quotations.length,
    quotationItems: quotationItems.length,
    rdQuotations: rdQuotations.length,
    rdQuotationItems: rdQuotationItems.length,
    productChecklists: checklists.length,
    handoverLetters: handoverLetters.length,
    systemSettings: systemSettings.length,
    imageBackups: imageBackupCount,
  };

  const payload = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    backupType: type,
    app: "LK Tronics PMS Enterprise",
    recordCounts,
    data: {
      users,
      departments,
      categories,
      suppliers,
      products,
      productHistory,
      productPriceHistory,
      quotations,
      quotationItems,
      rdQuotations,
      rdQuotationItems,
      productChecklists: checklists,
      handoverLetters,
      systemSettings,
    },
  };

  return { payloadJson: JSON.stringify(payload), recordCounts };
}

/**
 * Creates an encrypted backup, uploads it to Cloudinary, and executes rotation
 */
export async function createEncryptedBackup(
  type: "DAILY" | "WEEKLY" | "MANUAL" = "MANUAL",
  customKey?: string
): Promise<BackupMetadata> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in your .env file."
    );
  }

  const { payloadJson, recordCounts } = await dumpDatabaseSnapshot(type);
  const encryptedBuffer = encryptBackupData(payloadJson, customKey);

  const client = getCloudinaryClient();
  const dateStr = new Date().toISOString().split("T")[0];
  const timestamp = Date.now();
  const folder = `pms_backups/${type.toLowerCase()}`;
  const filename = `pms_backup_${type.toLowerCase()}_${dateStr}_${timestamp}.enc`;
  const publicId = `${folder}/${filename.replace(/\.enc$/, "")}`;

  // Upload to Cloudinary as RAW asset
  const uploadResult = await new Promise<{ url: string; bytes: number }>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        tags: ["pms_backup", type.toLowerCase()],
        overwrite: true,
      },
      (err, res) => {
        if (err || !res) {
          console.error("Cloudinary backup upload error:", err);
          return reject(err || new Error("Failed to upload encrypted backup to Cloudinary"));
        }
        resolve({
          url: res.secure_url || res.url,
          bytes: res.bytes || encryptedBuffer.length,
        });
      }
    );

    const stream = new Readable();
    stream.push(encryptedBuffer);
    stream.push(null);
    stream.pipe(uploadStream);
  });

  const metadata: BackupMetadata = {
    id: `bk-${timestamp}`,
    filename,
    publicId,
    type,
    url: uploadResult.url,
    bytes: uploadResult.bytes,
    formattedSize: formatBytes(uploadResult.bytes),
    createdAt: new Date().toISOString(),
    recordCounts,
  };

  // Update backup history in SystemSetting
  await recordBackupHistory(metadata);

  // Rotate old backups (delete older than 7 for daily, older than 4 for weekly)
  await rotateCloudinaryBackups(type).catch((err) =>
    console.warn("Cloudinary rotation warning:", err?.message)
  );

  return metadata;
}

/**
 * Saves recent backup history to SystemSetting
 */
async function recordBackupHistory(newBackup: BackupMetadata) {
  try {
    const key = "pms_backup_history";
    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    let history: BackupMetadata[] = [];
    if (existing?.value) {
      try {
        history = JSON.parse(existing.value);
      } catch {}
    }
    // Prepend new backup, keep latest 30 records
    history = [newBackup, ...history.filter((b) => b.publicId !== newBackup.publicId)].slice(0, 30);

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(history) },
      create: { key, value: JSON.stringify(history) },
    });

    // Also update lastDaily/lastWeekly markers
    const markerKey = `pms_last_backup_${newBackup.type.toLowerCase()}`;
    await prisma.systemSetting.upsert({
      where: { key: markerKey },
      update: { value: new Date().toISOString() },
      create: { key: markerKey, value: new Date().toISOString() },
    });
  } catch (err) {
    console.warn("Failed to record backup history in SystemSetting:", err);
  }
}

/**
 * Gets recorded backup history
 */
export async function getBackupHistory(): Promise<BackupMetadata[]> {
  try {
    const key = "pms_backup_history";
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (setting?.value) {
      return JSON.parse(setting.value);
    }
  } catch {}
  return [];
}

/**
 * Rotates Cloudinary backups to keep storage clean:
 * - Daily: keep last 7
 * - Weekly: keep last 4
 */
export async function rotateCloudinaryBackups(type: "DAILY" | "WEEKLY" | "MANUAL") {
  if (type === "MANUAL") return;
  if (!isCloudinaryConfigured()) return;

  const maxKeep = type === "DAILY" ? 7 : 4;
  const folder = `pms_backups/${type.toLowerCase()}`;
  const client = getCloudinaryClient();

  try {
    const res = await client.api.resources({
      type: "upload",
      resource_type: "raw",
      prefix: folder,
      max_results: 100,
    });

    const resources = res.resources || [];
    if (resources.length > maxKeep) {
      // Sort oldest first
      resources.sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const toDelete = resources.slice(0, resources.length - maxKeep);
      for (const item of toDelete) {
        try {
          await client.uploader.destroy(item.public_id, { resource_type: "raw" });
          console.log(`Rotated and deleted old backup: ${item.public_id}`);
        } catch (e) {
          console.warn(`Failed to delete rotated backup ${item.public_id}:`, e);
        }
      }
    }
  } catch (err) {
    console.warn(`Could not rotate ${type} backups:`, err);
  }
}

export interface DetailedStorageBreakdown {
  cloudinary: {
    configured: boolean;
    plan: string;
    totalBytes: number;
    usedBytes: number;
    remainingBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
    remainingFormatted: string;
    // Breakdown by folder/category
    videos: {
      count: number;
      bytes: number;
      formatted: string;
    };
    backups: {
      count: number;
      bytes: number;
      formatted: string;
    };
    other: {
      count: number;
      bytes: number;
      formatted: string;
    };
  };
  database: {
    totalBytes: number;
    totalFormatted: string;
    totalRows: number;
    tables: Array<{
      name: string;
      rows: number;
      dataBytes: number;
      indexBytes: number;
      totalBytes: number;
      formattedSize: string;
    }>;
  };
  automation: {
    lastDailyBackup: string | null;
    lastWeeklyBackup: string | null;
    encryption: string;
  };
  backupsList: BackupMetadata[];
}

/**
 * Calculates complete storage breakdown across Cloudinary and MySQL
 */
export async function getCompleteStorageBreakdown(): Promise<DetailedStorageBreakdown> {
  const client = isCloudinaryConfigured() ? getCloudinaryClient() : null;

  // 1. Cloudinary base usage
  let plan = "Cloudinary Free (25 Credits)";
  let totalBytes = 25 * 1024 * 1024 * 1024; // 25 GB default
  let usedBytes = 0;
  let remainingBytes = totalBytes;
  let usedPercent = 0;

  if (client) {
    try {
      const usage = await client.api.usage();
      plan = usage.plan || plan;
      const totalCredits = Number(usage.credits?.limit) || 25;
      const usedCredits = Number(usage.credits?.usage) || 0;
      totalBytes = totalCredits * 1024 * 1024 * 1024;
      const usedStorageBytes = Number(usage.storage?.usage) || 0;
      usedBytes = Math.min(totalBytes, Math.max(usedStorageBytes, usedCredits * 1024 * 1024 * 1024));
      remainingBytes = Math.max(0, totalBytes - usedBytes);
      usedPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10);
    } catch (e) {
      console.warn("Could not fetch base usage:", e);
    }
  }

  // 2. Cloudinary QC Videos breakdown
  let videoCount = 0;
  let videoBytes = 0;
  if (client) {
    try {
      const videoRes = await client.api.resources({
        resource_type: "video",
        prefix: "pms_qc_videos",
        max_results: 500,
      });
      const vList = videoRes.resources || [];
      videoCount = vList.length;
      videoBytes = vList.reduce((acc: number, r: any) => acc + (Number(r.bytes) || 0), 0);
    } catch (e) {
      console.warn("Could not fetch video resources:", e);
    }
  }

  // 3. Cloudinary Backups breakdown
  let backupCount = 0;
  let backupBytes = 0;
  if (client) {
    try {
      const rawRes = await client.api.resources({
        resource_type: "raw",
        prefix: "pms_backups",
        max_results: 500,
      });
      const bList = rawRes.resources || [];
      backupCount = bList.length;
      backupBytes = bList.reduce((acc: number, r: any) => acc + (Number(r.bytes) || 0), 0);
    } catch (e) {
      console.warn("Could not fetch raw resources:", e);
    }
  }

  const otherBytes = Math.max(0, usedBytes - videoBytes - backupBytes);

  // 4. MySQL database storage details
  let dbTables: any[] = [];
  try {
    const rawTables: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        TABLE_NAME as name, 
        TABLE_ROWS as rowCount, 
        DATA_LENGTH as dataLength, 
        INDEX_LENGTH as indexLength 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
    `);

    dbTables = rawTables.map((t) => {
      const dataBytes = Number(t.dataLength) || 0;
      const indexBytes = Number(t.indexLength) || 0;
      const tTotal = dataBytes + indexBytes;
      return {
        name: String(t.name),
        rows: Number(t.rowCount) || 0,
        dataBytes,
        indexBytes,
        totalBytes: tTotal,
        formattedSize: formatBytes(tTotal),
      };
    });
  } catch (err) {
    console.warn("Could not query information_schema.TABLES:", err);
  }

  const dbTotalBytes = dbTables.reduce((acc, t) => acc + t.totalBytes, 0);
  const dbTotalRows = dbTables.reduce((acc, t) => acc + t.rows, 0);

  // 5. Automation markers
  let lastDailyBackup: string | null = null;
  let lastWeeklyBackup: string | null = null;
  try {
    const markers = await prisma.systemSetting.findMany({
      where: {
        key: { in: ["pms_last_backup_daily", "pms_last_backup_weekly"] },
      },
    });
    markers.forEach((m) => {
      if (m.key === "pms_last_backup_daily") lastDailyBackup = m.value;
      if (m.key === "pms_last_backup_weekly") lastWeeklyBackup = m.value;
    });
  } catch {}

  const history = await getBackupHistory();

  return {
    cloudinary: {
      configured: Boolean(client),
      plan,
      totalBytes,
      usedBytes,
      remainingBytes,
      usedPercent,
      totalFormatted: formatBytes(totalBytes),
      usedFormatted: formatBytes(usedBytes),
      remainingFormatted: formatBytes(remainingBytes),
      videos: {
        count: videoCount,
        bytes: videoBytes,
        formatted: formatBytes(videoBytes),
      },
      backups: {
        count: backupCount,
        bytes: backupBytes,
        formatted: formatBytes(backupBytes),
      },
      other: {
        count: 0,
        bytes: otherBytes,
        formatted: formatBytes(otherBytes),
      },
    },
    database: {
      totalBytes: dbTotalBytes,
      totalFormatted: formatBytes(dbTotalBytes),
      totalRows: dbTotalRows,
      tables: dbTables,
    },
    automation: {
      lastDailyBackup,
      lastWeeklyBackup,
      encryption: "AES-256-GCM (Authenticated)",
    },
    backupsList: history,
  };
}
