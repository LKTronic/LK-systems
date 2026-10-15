import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdministrativeRole(role?: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

// GET /api/departments (Authenticated users)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let departments: any[] = [];
    if (typeof (prisma as any)?.department?.findMany === "function") {
      departments = await (prisma as any).department.findMany({
        include: {
          _count: {
            select: { users: true },
          },
        },
        orderBy: { name: "asc" },
      });
    } else {
      const rawRows = await prisma.$queryRawUnsafe<
        Array<{ id: number; name: string; createdAt: Date; updatedAt: Date; userCount: number | bigint }>
      >(
        `SELECT d.id, d.name, d.createdAt, d.updatedAt,
           (SELECT COUNT(*) FROM User u WHERE u.departmentId = d.id) as userCount
         FROM Department d
         ORDER BY d.name ASC`
      );
      departments = rawRows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        _count: { users: Number(r.userCount) || 0 },
      }));
    }

    return NextResponse.json(
      { departments },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

// POST /api/departments (Admin / SuperAdmin only)
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
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    if (!rawName || rawName.length < 2) {
      return NextResponse.json(
        { error: "Department name must be at least 2 characters." },
        { status: 400 }
      );
    }

    // Check duplicate department name
    let existing: any = null;
    if (typeof (prisma as any)?.department?.findFirst === "function") {
      existing = await (prisma as any).department.findFirst({
        where: {
          name: rawName,
        },
      });
    } else {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
        "SELECT id, name FROM Department WHERE name = ? LIMIT 1",
        rawName
      );
      existing = rows[0] || null;
    }

    if (existing) {
      return NextResponse.json(
        { error: `Department "${rawName}" already exists.` },
        { status: 409 }
      );
    }

    let newDept: any = null;
    if (typeof (prisma as any)?.department?.create === "function") {
      newDept = await (prisma as any).department.create({
        data: {
          name: rawName,
        },
      });
    } else {
      await prisma.$executeRawUnsafe(
        "INSERT INTO Department (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())",
        rawName
      );
      const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; createdAt: Date; updatedAt: Date }>>(
        "SELECT id, name, createdAt, updatedAt FROM Department WHERE name = ? ORDER BY id DESC LIMIT 1",
        rawName
      );
      newDept = rows[0];
    }

    return NextResponse.json({ department: newDept }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create department." },
      { status: 500 }
    );
  }
}
