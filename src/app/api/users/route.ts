import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@/lib/validations/user";

// Helper check for admin privileges
function isAdministrativeRole(role?: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

// GET /api/users (Admin / SuperAdmin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const currentUserRole = (session?.user as any)?.role;

    if (!session || !session.user || !isAdministrativeRole(currentUserRole)) {
      return NextResponse.json(
        { error: "Forbidden: Admin or SuperAdmin privileges required." },
        { status: 403 }
      );
    }

    // Self-healing migration: Ensure MySQL User table schema supports 'SHOP' enum and fix any empty roles
    try {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE User MODIFY COLUMN role ENUM('SUPERADMIN', 'ADMIN', 'STAFF', 'SHOP') NOT NULL DEFAULT 'STAFF'"
      );
      await prisma.$executeRawUnsafe(
        "UPDATE User SET role = 'SHOP' WHERE (role = '' OR role IS NULL) AND (LOWER(username) LIKE '%shop%' OR LOWER(name) LIKE '%shop%')"
      );
    } catch {}

    let usersList: any[] = [];
    try {
      const where: any = {};
      if (currentUserRole !== "SUPERADMIN") {
        where.role = { not: "SUPERADMIN" };
      }

      usersList = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (prismaErr) {
      const rawUsers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT u.id, u.name, u.username, u.role, u.status, u.departmentId, d.name AS departmentName, u.createdAt, u.updatedAt 
         FROM User u 
         LEFT JOIN Department d ON u.departmentId = d.id 
         ${currentUserRole !== "SUPERADMIN" ? "WHERE u.role != 'SUPERADMIN'" : ""} 
         ORDER BY u.createdAt DESC`
      );
      usersList = rawUsers;
    }

    const sanitizedUsers = (usersList || []).map((u: any) => {
      const rawRole = String(u.role || "").trim().toUpperCase();
      const role =
        rawRole === "SUPERADMIN" || rawRole === "ADMIN" || rawRole === "SHOP" || rawRole === "STAFF"
          ? rawRole
          : u.username?.toLowerCase().includes("shop") || u.name?.toLowerCase().includes("shop")
          ? "SHOP"
          : "STAFF";
      return {
        ...u,
        role,
        department: u.department || (u.departmentName ? { id: u.departmentId, name: u.departmentName } : null),
      };
    });

    return NextResponse.json(sanitizedUsers);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users (Create user - Admin / SuperAdmin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserRole = (session?.user as any)?.role;

    if (!session || !session.user || !isAdministrativeRole(currentUserRole)) {
      return NextResponse.json(
        { error: "Forbidden: Admin or SuperAdmin privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = createUserSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: any) => e.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, username, password, role, status, departmentId } = parseResult.data;

    // Rule: There is only ONE SuperAdmin account in the system - new ones cannot be created
    if (role === "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Cannot create new SuperAdmin accounts. Only one SuperAdmin account is permitted." },
        { status: 400 }
      );
    }

    // Check unique username
    let existing: any = null;
    try {
      existing = await prisma.user.findUnique({
        where: { username },
      });
    } catch {
      const raw = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM User WHERE username = ? LIMIT 1`,
        username
      );
      existing = raw[0] || null;
    }

    if (existing) {
      return NextResponse.json(
        { error: "Username is already taken." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const newUser = await prisma.user.create({
        data: {
          name,
          username,
          passwordHash,
          role: role as any,
          status,
          departmentId: departmentId ? Number(departmentId) : null,
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
        },
      });

      return NextResponse.json(newUser, { status: 201 });
    } catch (createErr) {
      try {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE User MODIFY COLUMN role ENUM('SUPERADMIN', 'ADMIN', 'STAFF', 'SHOP') NOT NULL DEFAULT 'STAFF'"
        );
      } catch {}

      await prisma.$executeRawUnsafe(
        `INSERT INTO User (name, username, passwordHash, role, status, departmentId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        name,
        username,
        passwordHash,
        role,
        status,
        departmentId ? Number(departmentId) : null
      );
      const created = await prisma.$queryRawUnsafe<any[]>(
        `SELECT u.id, u.name, u.username, u.role, u.status, u.departmentId, d.name AS departmentName, u.createdAt 
         FROM User u 
         LEFT JOIN Department d ON u.departmentId = d.id 
         WHERE u.username = ? LIMIT 1`,
        username
      );
      const resItem = created[0] || { name, username, role, status, departmentId };
      if (!resItem.role || resItem.role === "") {
        resItem.role = role;
      }
      resItem.department = resItem.departmentName ? { id: resItem.departmentId, name: resItem.departmentName } : null;
      return NextResponse.json(resItem, { status: 201 });
    }
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user." },
      { status: 500 }
    );
  }
}
