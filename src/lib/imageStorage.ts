import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

let isTableReady = false;

/**
 * Ensures the persistent image backup table exists in MySQL.
 * Runs once upon first invocation.
 */
export async function ensureImageBackupTable(): Promise<void> {
  if (isTableReady) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`ProductImageBackup\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`filename\` VARCHAR(191) NOT NULL,
        \`mimeType\` VARCHAR(64) NOT NULL DEFAULT 'image/png',
        \`data\` LONGTEXT NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`ProductImageBackup_filename_key\`(\`filename\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    isTableReady = true;
  } catch (err) {
    console.warn("Could not verify ProductImageBackup table:", err);
  }
}

/**
 * Backs up an image binary buffer directly into the persistent MySQL database.
 * This guarantees the image survives any server redeployments, container rebuilds,
 * or git clean/pull operations.
 */
export async function backupImageToDatabase(
  filename: string,
  buffer: Buffer,
  mimeType = "image/png"
): Promise<void> {
  try {
    await ensureImageBackupTable();
    const cleanFilename = path.basename(filename.replace(/\\/g, "/"));
    const base64Data = buffer.toString("base64");

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`ProductImageBackup\` (\`filename\`, \`mimeType\`, \`data\`, \`updatedAt\`)
       VALUES (?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`), \`mimeType\` = VALUES(\`mimeType\`), \`updatedAt\` = NOW(3)`,
      cleanFilename,
      mimeType,
      base64Data
    );
  } catch (err) {
    console.error(`Failed to backup image ${filename} to database:`, err);
  }
}

/**
 * Retrieves an image from MySQL database backup.
 */
export async function getImageFromDatabase(
  filename: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    await ensureImageBackupTable();
    const cleanFilename = path.basename(filename.replace(/\\/g, "/"));

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT \`data\`, \`mimeType\` FROM \`ProductImageBackup\` WHERE \`filename\` = ? LIMIT 1`,
      cleanFilename
    )) as Array<{ data: string; mimeType: string }>;

    if (rows && rows.length > 0 && rows[0].data) {
      const buffer = Buffer.from(rows[0].data, "base64");
      return { buffer, mimeType: rows[0].mimeType || "image/png" };
    }
  } catch (err) {
    console.error(`Failed to retrieve image ${filename} from database:`, err);
  }
  return null;
}

/**
 * Restores a missing file on disk from the database backup if available.
 */
export async function restoreFileToDiskFromDatabase(filename: string): Promise<boolean> {
  const cleanFilename = path.basename(filename.replace(/\\/g, "/"));
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  const diskPath = path.join(uploadDir, cleanFilename);

  if (fs.existsSync(diskPath)) {
    return true;
  }

  const record = await getImageFromDatabase(cleanFilename);
  if (record) {
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(diskPath, record.buffer);
      return true;
    } catch (err) {
      console.error(`Failed to write restored image ${cleanFilename} to disk:`, err);
    }
  }
  return false;
}

/**
 * Synchronizes all existing files in public/uploads/products/ to the database.
 */
export async function syncAllUploadsToDatabase(): Promise<number> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  if (!fs.existsSync(uploadDir)) return 0;

  let count = 0;
  const files = fs.readdirSync(uploadDir);
  for (const file of files) {
    if (file === ".gitkeep") continue;
    const fullPath = path.join(uploadDir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && stat.size > 0 && stat.size < 8 * 1024 * 1024) {
        const ext = path.extname(file).toLowerCase();
        let mimeType = "image/png";
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".webp") mimeType = "image/webp";

        const buffer = fs.readFileSync(fullPath);
        await backupImageToDatabase(file, buffer, mimeType);
        count++;
      }
    } catch (e) {
      // skip unreadable
    }
  }
  return count;
}
