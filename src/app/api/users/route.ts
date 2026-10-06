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

    try {
      const where: any = {};
      if (currentUserRole !== "SUPERADMIN") {
        where.role = { not: "SUPERADMIN" };
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(users);
    } catch (prismaErr) {
      const rawUsers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, username, role, status, createdAt, updatedAt FROM User ${
          currentUserRole !== "SUPERADMIN" ? "WHERE role != 'SUPERADMIN'" : ""
        } ORDER BY createdAt DESC`
      );
      return NextResponse.json(rawUsers);
    }
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

    const { name, username, password, role, status } = parseResult.data;

    // Rule: Only SUPERADMIN can create another SUPERADMIN account
    if (role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only SuperAdmin can create SuperAdmin accounts." },
        { status: 403 }
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
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      return NextResponse.json(newUser, { status: 201 });
    } catch (createErr) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO User (name, username, passwordHash, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        name,
        username,
        passwordHash,
        role,
        status
      );
      const created = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, username, role, status, createdAt FROM User WHERE username = ? LIMIT 1`,
        username
      );
      return NextResponse.json(created[0] || { name, username, role, status }, { status: 201 });
    }
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user." },
      { status: 500 }
    );
  }
}
