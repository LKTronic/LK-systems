-- LK-TRONIC PRODUCT MANAGEMENT SYSTEM (PMS)

-- 0. Database Creation
CREATE DATABASE IF NOT EXISTS `pms` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pms`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- 1. Table: User
CREATE TABLE IF NOT EXISTS `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPERADMIN', 'ADMIN', 'STAFF', 'SHOP') NOT NULL DEFAULT 'STAFF',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Table: Category
CREATE TABLE IF NOT EXISTS `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Category_name_key`(`name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Table: Supplier
CREATE TABLE IF NOT EXISTS `Supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `contactInfo` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Supplier_name_key`(`name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Table: Product
CREATE TABLE IF NOT EXISTS `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recordNo` VARCHAR(191) NOT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `modelAndName` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `productDate` DATE NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `priceUSD` DECIMAL(12, 2) NULL,
    `priceLKR` DECIMAL(12, 2) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `weight` DECIMAL(10, 4) NULL,
    `description` TEXT NULL,
    `referenceLink` TEXT NULL,
    `additionalNote` TEXT NULL,
    `imagePath` TEXT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'PMS',
    `externalId` VARCHAR(191) NULL,
    `externalUrl` TEXT NULL,
    `stockStatus` VARCHAR(191) NULL,
    `shippingClass` VARCHAR(191) NULL,
    `categoryId` INTEGER NULL,
    `categoryNames` TEXT NULL,
    `supplierId` INTEGER NULL,
    `warrantyPeriod` VARCHAR(191) NULL,
    `priceValidity` VARCHAR(191) NULL,
    `leadTime` VARCHAR(191) NULL,
    `isBrandNewOriginal` VARCHAR(191) NULL,
    `supplierImage` VARCHAR(191) NULL,
    `supplierNote` TEXT NULL,
    `priceUpdatedAt` DATETIME(3) NULL,
    `createdBy` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'PRICE_NOT_AVAILABLE', 'NOT_REQUESTED', 'QUOTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Product_recordNo_key`(`recordNo`),
    UNIQUE INDEX `Product_referenceNo_key`(`referenceNo`),
    INDEX `Product_status_idx`(`status`),
    INDEX `Product_sku_idx`(`sku`),
    INDEX `Product_source_idx`(`source`),
    INDEX `Product_externalId_idx`(`externalId`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_supplierId_idx`(`supplierId`),
    INDEX `Product_createdBy_idx`(`createdBy`),
    INDEX `Product_productDate_idx`(`productDate`),
    INDEX `Product_createdAt_idx`(`createdAt`),
    INDEX `Product_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Product_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `Product_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Table: ProductPriceHistory
CREATE TABLE IF NOT EXISTS `ProductPriceHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `priceLKR` DECIMAL(12, 2) NOT NULL,
    `priceUSD` DECIMAL(12, 2) NULL,
    `supplierId` INTEGER NULL,
    `supplierName` VARCHAR(191) NULL,
    `warrantyPeriod` VARCHAR(191) NULL,
    `leadTime` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductPriceHistory_productId_idx`(`productId`),
    INDEX `ProductPriceHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ProductPriceHistory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ProductPriceHistory_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. Table: SystemSetting
CREATE TABLE IF NOT EXISTS `SystemSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. Table: ProductHistory (Audit Trail)
CREATE TABLE IF NOT EXISTS `ProductHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NULL,
    `userId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldData` JSON NULL,
    `newData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductHistory_productId_idx`(`productId`),
    INDEX `ProductHistory_userId_idx`(`userId`),
    INDEX `ProductHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ProductHistory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `ProductHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. Initial Seed Data
-- Initial Superadmin (Username: superadmin / Password: superadmin123)
-- Initial Admin (Username: admin / Password: admin123)
INSERT IGNORE INTO `User` (`id`, `name`, `username`, `passwordHash`, `role`, `status`, `createdAt`, `updatedAt`) VALUES
(1, 'Super Administrator', 'superadmin', '$2b$10$/mkdXsbsbslWXVNq3Hq1EeAArsuV43ZL77Yh.QqQW4VL8.6eByaXq', 'SUPERADMIN', 'ACTIVE', NOW(), NOW()),
(2, 'System Administrator', 'admin', '$2b$10$JX9yAGa9gALmnRmiPZc.fOI6zp7Q2cVV8wkrSt1oxVDU6Xv5PQ.pm', 'ADMIN', 'ACTIVE', NOW(), NOW());

-- Default System Settings
INSERT IGNORE INTO `SystemSetting` (`key`, `value`, `updatedAt`) VALUES
('priceValidityMonths', '6', NOW());

-- Default Suppliers
INSERT IGNORE INTO `Supplier` (`id`, `name`, `contactInfo`, `notes`, `createdAt`) VALUES
(1, 'DAN', 'Supplier Contact: DAN', 'Default Supplier', NOW()),
(2, 'Grace', 'Supplier Contact: Grace', 'Default Supplier', NOW()),
(3, 'Rainy', 'Supplier Contact: Rainy', 'Default Supplier', NOW());

-- Default Base Categories
INSERT IGNORE INTO `Category` (`name`, `createdAt`) VALUES
('Accessories', NOW()),
('ACREL PRODUCT', NOW()),
('PowMr product', NOW()),
('Samkoon Product', NOW()),
('Lumas', NOW()),
('General Automation items', NOW()),
('General Electronics items', NOW()),
('General Electrical items', NOW()),
('Cables', NOW()),
('Others', NOW());

SET FOREIGN_KEY_CHECKS = 1;