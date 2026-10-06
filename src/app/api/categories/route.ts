import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// In-memory cache for categories list (invalidated on POST)
let cachedCategories: { data: any; timestamp: number } | null = null;
const CATEGORIES_CACHE_TTL_MS = 60 * 1000; // 1 minute

function invalidateCategoriesCache() {
  cachedCategories = null;
}

// GET /api/categories - List all categories
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    if (cachedCategories && now - cachedCategories.timestamp < CATEGORIES_CACHE_TTL_MS) {
      return NextResponse.json(cachedCategories.data, {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
      });
    }

    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
    });

    // Sort categories alphabetically, but always place "Others" / "Other" at the bottom
    categories.sort((a, b) => {
      const aName = a.name.trim().toLowerCase();
      const bName = b.name.trim().toLowerCase();
      const aIsOther = aName === "others" || aName === "other";
      const bIsOther = bName === "others" || bName === "other";
      if (aIsOther && !bIsOther) return 1;
      if (!aIsOther && bIsOther) return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const data = { categories };
    cachedCategories = { data, timestamp: now };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create a new category (available to all users)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = body.name?.trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Category name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    // Check if category already exists (case-insensitive or exact)
    const existing = await prisma.category.findFirst({
      where: {
        name: {
          equals: name,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        category: existing,
        message: "Category already exists.",
      });
    }

    const category = await prisma.category.create({
      data: { name },
    });

    invalidateCategoriesCache();

    return NextResponse.json({ category, message: "Category created successfully." }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category." },
      { status: 500 }
    );
  }
}
