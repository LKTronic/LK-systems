import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { updateUserSchema } from "@/lib/validations/user";

function isAdministrativeRole(role?: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

// PUT /api/users/:id (Update user - Admin or SuperAdmin)
export async function PUT(
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

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = updateUserSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: any) => e.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, username, password, role, status } = parseResult.data;

    // Rule 1: SUPERADMIN cannot be deactivated by anyone
    if (existingUser.role === "SUPERADMIN" && status === "INACTIVE") {
      return NextResponse.json(
        { error: "Forbidden: SuperAdmin accounts cannot be deactivated by anyone." },
        { status: 403 }
      );
    }

    // Rule 2: Only a SUPERADMIN can assign or modify a SUPERADMIN role/account
    if (
      (existingUser.role === "SUPERADMIN" || role === "SUPERADMIN") &&
      currentUserRole !== "SUPERADMIN"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only a SuperAdmin can modify or assign SuperAdmin accounts." },
        { status: 403 }
      );
    }

    // Check unique username if changing
    if (username && username !== existingUser.username) {
      const duplicate = await prisma.user.findUnique({
        where: { username },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Username already in use." },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (password && password.trim().length >= 6) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update user." },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id (Delete or Deactivate user - Admin / SuperAdmin)
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

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rule 1: SUPERADMIN cannot be deleted or deactivated by anyone
    if (existingUser.role === "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: SuperAdmin accounts cannot be deleted or deactivated by anyone." },
        { status: 403 }
      );
    }

    // Rule 2: Protect against self-deletion/self-deactivation
    const currentUserId = parseInt((session.user as any).id, 10);
    if (currentUserId === id) {
      return NextResponse.json(
        { error: "You cannot delete or deactivate your own account." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "toggle") {
      // Toggle Active / Inactive
      const newStatus = existingUser.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const updated = await prisma.user.update({
        where: { id },
        data: { status: newStatus },
        select: { id: true, username: true, status: true },
      });
      return NextResponse.json({
        message: `User status changed to ${newStatus}.`,
        user: updated,
      });
    }

    // Default or mode === "delete": Delete user (or soft delete if FK exists)
    try {
      await prisma.user.delete({
        where: { id },
      });
      return NextResponse.json({
        message: `User @${existingUser.username} permanently deleted.`,
      });
    } catch (dbError: any) {
      // If FK constraint prevents hard deletion, set status to INACTIVE
      if (dbError.code === "P2003") {
        const updated = await prisma.user.update({
          where: { id },
          data: { status: "INACTIVE" },
          select: { id: true, username: true, status: true },
        });
        return NextResponse.json({
          message: `User @${existingUser.username} has linked product records, so account was deactivated instead of deleted.`,
          user: updated,
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
