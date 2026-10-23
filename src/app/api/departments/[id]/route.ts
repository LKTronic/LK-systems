import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdministrativeRole(role?: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

// DELETE /api/departments/[id] (Admin / SuperAdmin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserRole = (session?.user as any)?.role;

    if (!session || !session.user || !isAdministrativeRole(currentUserRole)) {
      return NextResponse.json(
        { error: "Forbidden: Admin or SuperAdmin privileges required." },
        { status: 403 }
      );
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });
    }

    // Check if department exists
    let existing: any = null;
    if (typeof (prisma as any)?.department?.findUnique === "function") {
      existing = await (prisma as any).department.findUnique({
        where: { id },
      });
    } else {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
        "SELECT id, name FROM Department WHERE id = ? LIMIT 1",
        id
      );
      existing = rows[0] || null;
    }

    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Unassign all users belonging to this department
    try {
      await prisma.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
      });
    } catch {
      await prisma.$executeRawUnsafe(
        "UPDATE User SET departmentId = NULL WHERE departmentId = ?",
        id
      );
    }

    // Delete the department
    if (typeof (prisma as any)?.department?.delete === "function") {
      await (prisma as any).department.delete({
        where: { id },
      });
    } else {
      await prisma.$executeRawUnsafe("DELETE FROM Department WHERE id = ?", id);
    }

    return NextResponse.json({
      success: true,
      message: `Department "${existing.name}" has been deleted.`,
    });
  } catch (error: any) {
    console.error("Error deleting department:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete department." },
      { status: 500 }
    );
  }
}
