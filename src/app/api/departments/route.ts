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

    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    });

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
    const existing = await prisma.department.findFirst({
      where: {
        name: {
          equals: rawName,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Department "${rawName}" already exists.` },
        { status: 409 }
      );
    }

    const newDept = await prisma.department.create({
      data: {
        name: rawName,
      },
    });

    return NextResponse.json({ department: newDept }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create department." },
      { status: 500 }
    );
  }
}
