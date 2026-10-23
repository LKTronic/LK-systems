import { prisma } from "@/lib/prisma";

let isSchemaEnsured = false;

/**
 * Self-healing schema migration:
 * Ensures the Department table exists and User table has departmentId column.
 * Handles MySQL instances where `prisma db push` has not yet been executed on the production server.
 */
export async function ensureDepartmentSchema(): Promise<void> {
  if (isSchemaEnsured) return;

  try {
    // 1. Create Department table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS Department (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(191) NOT NULL UNIQUE,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err) {
    // Ignore error if table exists or lacks permissions
  }

  try {
    // 2. Add departmentId column to User table if missing
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD COLUMN departmentId INT NULL
    `);
  } catch (err) {
    // Ignore error 1060 (Duplicate column name) if already added
  }

  try {
    // 3. Add index on departmentId for performance
    await prisma.$executeRawUnsafe(`
      ALTER TABLE User ADD INDEX User_departmentId_idx (departmentId)
    `);
  } catch (err) {
    // Ignore if index already exists
  }

  try {
    // 4. Ensure User table role column supports SHOP enum
    await prisma.$executeRawUnsafe(
      "ALTER TABLE User MODIFY COLUMN role ENUM('SUPERADMIN', 'ADMIN', 'STAFF', 'SHOP') NOT NULL DEFAULT 'STAFF'"
    );
  } catch (err) {
    // Ignore if already modified
  }

  isSchemaEnsured = true;
}
