import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// In-memory cache for suppliers list (invalidated on POST)
let cachedSuppliers: { data: any; timestamp: number } | null = null;
const SUPPLIERS_CACHE_TTL_MS = 60 * 1000; // 1 minute

function invalidateSuppliersCache() {
  cachedSuppliers = null;
}

// GET /api/suppliers - List all suppliers
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    if (cachedSuppliers && now - cachedSuppliers.timestamp < SUPPLIERS_CACHE_TTL_MS) {
      return NextResponse.json(cachedSuppliers.data, {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
      });
    }

    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        contactInfo: true,
        notes: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
    });

    const data = { suppliers };
    cachedSuppliers = { data, timestamp: now };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - Add new supplier (available to all users)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = body.name?.trim();
    const contactInfo = body.contactInfo?.trim() || null;
    const notes = body.notes?.trim() || null;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Supplier name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    // Check if supplier already exists
    const existing = await prisma.supplier.findFirst({
      where: {
        name: {
          equals: name,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        supplier: existing,
        message: "Supplier already exists.",
      });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactInfo,
        notes,
      },
    });

    invalidateSuppliersCache();

    return NextResponse.json({ supplier, message: "Supplier added successfully." }, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Failed to create supplier." },
      { status: 500 }
    );
  }
}
