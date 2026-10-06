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

    let existingUser: any = null;
    try {
      existingUser = await prisma.user.findUnique({
        where: { id },
      });
    } catch {
      const raw = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM User WHERE id = ? LIMIT 1`,
        id
      );
      existingUser = raw[0] || null;
    }

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

    // Rule 1: Default Root SuperAdmin (@superadmin) - Only password can be updated
    if (existingUser.username === "superadmin") {
      if (username && username !== "superadmin") {
        return NextResponse.json(
          { error: "Forbidden: The default SuperAdmin username cannot be changed." },
          { status: 400 }
        );
      }
      if (role && role !== "SUPERADMIN") {
        return NextResponse.json(
          { error: "Forbidden: The default SuperAdmin role cannot be changed." },
          { status: 400 }
        );
      }
      if (status && status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Forbidden: The default SuperAdmin account cannot be deactivated." },
          { status: 400 }
        );
      }
    }

    // Rule 2: Only a SUPERADMIN can modify another SUPERADMIN account
    if (existingUser.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only a SuperAdmin can modify SuperAdmin accounts." },
        { status: 403 }
      );
    }

    // Check unique username if changing
    if (username && username !== existingUser.username) {
      if (existingUser.username === "superadmin") {
        return NextResponse.json(
          { error: "Username of default root superadmin cannot be changed." },
          { status: 400 }
        );
      }

      let duplicate: any = null;
      try {
        duplicate = await prisma.user.findUnique({
          where: { username },
        });
      } catch {
        const raw = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM User WHERE username = ? LIMIT 1`,
          username
        );
        duplicate = raw[0] || null;
      }

      if (duplicate) {
        return NextResponse.json(
          { error: "Username already in use." },
          { status: 409 }
        );
      }
    }

    // In edit mode: Only username and password can be updated (Name, Role, and Status are locked)
    const updateData: any = {};
    if (username && existingUser.username !== "superadmin") {
      updateData.username = username;
    }
    if (password && password.trim().length >= 6) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        id: existingUser.id,
        name: existingUser.name,
        username: existingUser.username,
        role: existingUser.role,
        status: existingUser.status,
        updatedAt: existingUser.updatedAt,
      });
    }

    try {
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
    } catch (updateErr) {
      const fields: string[] = [];
      const values: any[] = [];
      if (updateData.username) {
        fields.push("username = ?");
        values.push(updateData.username);
      }
      if (updateData.passwordHash) {
        fields.push("passwordHash = ?");
        values.push(updateData.passwordHash);
      }
      fields.push("updatedAt = NOW(3)");
      values.push(id);

      if (fields.length > 1) {
        await prisma.$executeRawUnsafe(
          `UPDATE User SET ${fields.join(", ")} WHERE id = ?`,
          ...values
        );
      }
      const updatedRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, username, role, status, updatedAt FROM User WHERE id = ? LIMIT 1`,
        id
      );
      return NextResponse.json(updatedRows[0] || existingUser);
    }
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update user." },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id (Permanently delete user - Admin / SuperAdmin)
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

    let existingUser: any = null;
    try {
      existingUser = await prisma.user.findUnique({
        where: { id },
      });
    } catch {
      const raw = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM User WHERE id = ? LIMIT 1`,
        id
      );
      existingUser = raw[0] || null;
    }

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rule 1: Default Root SuperAdmin (@superadmin) cannot be deleted or deactivated by anyone
    if (existingUser.username === "superadmin") {
      return NextResponse.json(
        { error: "Forbidden: The default root SuperAdmin account (@superadmin) cannot be deleted." },
        { status: 403 }
      );
    }

    // Rule 2: Only a SUPERADMIN can delete another SUPERADMIN account
    if (existingUser.role === "SUPERADMIN" && currentUserRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only SuperAdmin can delete SuperAdmin accounts." },
        { status: 403 }
      );
    }

    // Rule 3: Protect against self-deletion
    const currentUserId = parseInt((session.user as any).id, 10);
    if (currentUserId === id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "toggle") {
      // Toggle Active / Inactive (if explicitly requested)
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

    // Default or mode === "delete": Permanent Hard Deletion from DB (Never soft-delete or set to INACTIVE)
    let fallbackAdminId = currentUserId;
    if (!fallbackAdminId || fallbackAdminId === id) {
      try {
        const rootAdmin = await prisma.user.findFirst({
          where: { role: "SUPERADMIN" },
          select: { id: true },
        });
        fallbackAdminId = rootAdmin ? rootAdmin.id : 1;
      } catch {
        fallbackAdminId = 1;
      }
    }

    try {
      // Step A: Reassign any Product records created by this user so FK constraint does not fail
      await prisma.product.updateMany({
        where: { createdBy: id },
        data: { createdBy: fallbackAdminId },
      });

      // Step B: Nullify userId in ProductHistory
      await prisma.productHistory.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      // Step C: Permanently delete user row from MySQL
      await prisma.user.delete({
        where: { id },
      });

      return NextResponse.json({
        message: `User @${existingUser.username} permanently deleted.`,
      });
    } catch (dbError: any) {
      console.warn("Prisma user delete encountered issue, attempting direct SQL hard delete:", dbError);
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE Product SET createdBy = ? WHERE createdBy = ?`,
          fallbackAdminId,
          id
        );
        await prisma.$executeRawUnsafe(
          `UPDATE ProductHistory SET userId = NULL WHERE userId = ?`,
          id
        );
        await prisma.$executeRawUnsafe(`DELETE FROM User WHERE id = ?`, id);

        return NextResponse.json({
          message: `User @${existingUser.username} permanently deleted.`,
        });
      } catch (rawError: any) {
        console.error("Hard delete completely failed:", rawError);
        return NextResponse.json(
          { error: rawError?.message || "Failed to permanently delete user from database." },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete user." },
      { status: 500 }
    );
  }
}
