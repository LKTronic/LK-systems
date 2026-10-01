import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create Super Admin user
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { username: "superadmin" },
  });

  if (!existingSuperAdmin) {
    const passwordHash = await bcrypt.hash("superadmin123", 10);
    const superAdmin = await prisma.user.create({
      data: {
        name: "Super Administrator",
        username: "superadmin",
        passwordHash,
        role: "SUPERADMIN",
        status: "ACTIVE",
      },
    });
    console.log("Created initial Super Admin user:", superAdmin.username);
  } else {
    console.log("Super Admin user already exists.");
  }

  // Create standard Admin user
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    const admin = await prisma.user.create({
      data: {
        name: "System Administrator",
        username: "admin",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log("Created initial Admin user:", admin.username);
  } else {
    console.log("Admin user already exists.");
  }

  // Seed Default Categories
  const defaultCategories = [
    "Accessories",
    "ACREL PRODUCT",
    "PowMr product",
    "Samkoon Product",
    "Lumas",
    "General Automation items",
    "General Electronics items",
    "General Electrical items",
    "Cables",
    "Others",
  ];

  for (const catName of defaultCategories) {
    await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName },
    });
  }
  console.log("Seeded default categories.");

  // Seed Initial Suppliers
  const defaultSuppliers = ["DAN", "Grace", "Rainy"];
  for (const suppName of defaultSuppliers) {
    await prisma.supplier.upsert({
      where: { name: suppName },
      update: {},
      create: { name: suppName },
    });
  }
  console.log("Seeded default suppliers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
