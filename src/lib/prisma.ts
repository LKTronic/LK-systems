import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion?: number;
};

// Increment to invalidate stale in-memory Prisma client on schema/enum changes
const SCHEMA_VERSION = 4;

export const prisma =
  globalForPrisma.prisma &&
  globalForPrisma.prismaVersion === SCHEMA_VERSION &&
  Boolean((globalForPrisma.prisma as any)?.department)
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: ["error", "warn"],
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaVersion = SCHEMA_VERSION;
}

// Fallback polyfill for long-running dev servers that loaded @prisma/client before Department was added
if (!(prisma as any).department) {
  (prisma as any).department = {
    findMany: async () => {
      const rows = await (prisma as any).$queryRawUnsafe(
        `SELECT d.id, d.name, d.createdAt, d.updatedAt,
           (SELECT COUNT(*) FROM User u WHERE u.departmentId = d.id) as userCount
         FROM Department d
         ORDER BY d.name ASC`
      );
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        _count: { users: Number(r.userCount) || 0 },
      }));
    },
    findFirst: async (args?: any) => {
      const name = args?.where?.name;
      if (!name) return null;
      const val = typeof name === "string" ? name : name?.equals;
      const rows = await (prisma as any).$queryRawUnsafe(
        "SELECT id, name, createdAt, updatedAt FROM Department WHERE name = ? LIMIT 1",
        val
      );
      return rows[0] || null;
    },
    findUnique: async (args?: any) => {
      if (args?.where?.id) {
        const rows = await (prisma as any).$queryRawUnsafe(
          "SELECT id, name, createdAt, updatedAt FROM Department WHERE id = ? LIMIT 1",
          args.where.id
        );
        return rows[0] || null;
      }
      if (args?.where?.name) {
        const rows = await (prisma as any).$queryRawUnsafe(
          "SELECT id, name, createdAt, updatedAt FROM Department WHERE name = ? LIMIT 1",
          args.where.name
        );
        return rows[0] || null;
      }
      return null;
    },
    create: async (args: any) => {
      const name = args.data.name;
      await (prisma as any).$executeRawUnsafe(
        "INSERT INTO Department (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())",
        name
      );
      const rows = await (prisma as any).$queryRawUnsafe(
        "SELECT id, name, createdAt, updatedAt FROM Department WHERE name = ? ORDER BY id DESC LIMIT 1",
        name
      );
      return rows[0];
    },
  };
}
