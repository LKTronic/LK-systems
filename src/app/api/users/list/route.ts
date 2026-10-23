import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/list - Lightweight list of active users for dropdowns (any authenticated user)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let users: any[] = [];
    try {
      users = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          username: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    } catch {
      const rawUsers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT u.id, u.name, u.username, d.name AS departmentName 
         FROM User u 
         LEFT JOIN Department d ON u.departmentId = d.id 
         WHERE u.status = 'ACTIVE' 
         ORDER BY u.name ASC`
      );
      users = (rawUsers || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        department: u.departmentName ? { name: u.departmentName } : null,
      }));
    }

    return NextResponse.json(
      { users },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching users list:", error);
    return NextResponse.json(
      { error: "Failed to fetch users list" },
      { status: 500 }
    );
  }
}
