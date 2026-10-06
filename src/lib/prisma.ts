import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion?: number;
};

// Increment to invalidate stale in-memory Prisma client on schema/enum changes
const SCHEMA_VERSION = 2;

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaVersion === SCHEMA_VERSION
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: ["error", "warn"],
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaVersion = SCHEMA_VERSION;
}
