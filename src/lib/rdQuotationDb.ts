import { prisma } from "@/lib/prisma";

let isReady = false;

/**
 * Ensures the RdQuotation and RdQuotationItem tables exist in MySQL.
 * Runs automatically upon first access to prevent Error 1146 (Table doesn't exist).
 */
export async function ensureRdQuotationTables(): Promise<void> {
  if (isReady) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`RdQuotation\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`type\` VARCHAR(64) NOT NULL DEFAULT 'THREE_D_PRINT',
        \`quotationNo\` VARCHAR(191) NOT NULL,
        \`registrationNo\` VARCHAR(64) DEFAULT 'P-V 00336036',
        \`projectTitle\` VARCHAR(255) NULL,
        \`preparedDate\` DATE NOT NULL,
        \`expireDate\` DATE NOT NULL,
        \`validityDays\` INT DEFAULT 14,
        \`paymentMethod\` VARCHAR(128) NOT NULL DEFAULT '100% payment',
        \`preparedBy\` VARCHAR(191) NOT NULL,
        \`quotationTo\` TEXT NOT NULL,
        \`leadTime\` VARCHAR(128) NULL,
        \`warranty\` VARCHAR(128) NULL,
        \`hardwareTotal\` DECIMAL(12, 2) DEFAULT 0.00,
        \`servicesTotal\` DECIMAL(12, 2) DEFAULT 0.00,
        \`totalAmount\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`overview\` LONGTEXT NULL,
        \`technicalSpecs\` LONGTEXT NULL,
        \`termsAndConditions\` LONGTEXT NULL,
        \`status\` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
        \`createdBy\` INT NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`RdQuotation_quotationNo_key\` (\`quotationNo\`),
        INDEX \`RdQuotation_type_idx\` (\`type\`),
        INDEX \`RdQuotation_preparedDate_idx\` (\`preparedDate\`),
        INDEX \`RdQuotation_createdBy_idx\` (\`createdBy\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`RdQuotationItem\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`rdQuotationId\` INT NOT NULL,
        \`itemIndex\` INT NOT NULL,
        \`itemType\` VARCHAR(64) DEFAULT 'HARDWARE',
        \`productOrService\` TEXT NOT NULL,
        \`quantity\` INT NOT NULL DEFAULT 1,
        \`unitPrice\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`totalPrice\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`notes\` TEXT NULL,
        INDEX \`RdQuotationItem_rdQuotationId_idx\` (\`rdQuotationId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`RdQuotationItem_rdQuotationId_fkey\` FOREIGN KEY (\`rdQuotationId\`) REFERENCES \`RdQuotation\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    isReady = true;
  } catch (err) {
    console.warn("Could not verify RdQuotation tables:", err);
  }
}

