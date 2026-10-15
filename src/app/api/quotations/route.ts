import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/quotations - List quotations with search, date filtering, and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL";
    const paymentMethod = searchParams.get("paymentMethod") || "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    const andConditions: any[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { quotationNo: { contains: search } },
          { quotationTo: { contains: search } },
          { preparedBy: { contains: search } },
        ],
      });
    }

    if (status && status !== "ALL") {
      andConditions.push({ status });
    }

    if (paymentMethod && paymentMethod !== "ALL") {
      andConditions.push({ paymentMethod });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [total, quotations] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ preparedDate: "desc" }, { id: "desc" }],
        include: {
          items: {
            orderBy: { itemIndex: "asc" },
          },
          author: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      quotations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotations" },
      { status: 500 }
    );
  }
}

// POST /api/quotations - Create and save new quotation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      quotationNo,
      preparedDate,
      expireDate,
      paymentMethod,
      advancePercent,
      quotationTo,
      preparedBy,
      notes,
      status = "DRAFT",
      items = [],
    } = body;

    if (!quotationNo || !quotationNo.trim()) {
      return NextResponse.json({ error: "Quotation number is required" }, { status: 400 });
    }

    if (!preparedDate || !expireDate) {
      return NextResponse.json({ error: "Prepared date and expiry date are required" }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    if (!quotationTo || !quotationTo.trim()) {
      return NextResponse.json({ error: "Quotation To (Client Details) is required" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required in the quotation" }, { status: 400 });
    }

    // Check quotationNo uniqueness
    const existing = await prisma.quotation.findUnique({
      where: { quotationNo: quotationNo.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Quotation number "${quotationNo}" already exists. Please choose another.` },
        { status: 409 }
      );
    }

    // Calculate subtotal from items
    let calculatedSubtotal = 0;
    const validatedItems = items.map((item: any, idx: number) => {
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const unitPrice = Math.max(0, parseFloat(item.unitPrice) || 0);
      const totalPrice = quantity * unitPrice;
      calculatedSubtotal += totalPrice;

      return {
        itemIndex: idx + 1,
        productId: item.productId ? parseInt(item.productId, 10) : null,
        description: (item.description || "").trim() || "Item",
        imagePath: item.imagePath ? String(item.imagePath).trim() : null,
        stockStatus: item.stockStatus === "OVERSEAS" ? "OVERSEAS" : "IN_STOCK",
        leadTime: item.stockStatus === "OVERSEAS" ? (item.leadTime?.trim() || "12-21 working days") : null,
        warranty: (item.warranty || "No Warranty").trim(),
        quantity,
        unitPrice,
        totalPrice,
      };
    });

    const parsedAdvancePercent =
      paymentMethod === "ADVANCE_PAYMENT" && advancePercent != null
        ? Math.max(0, Math.min(100, parseFloat(advancePercent) || 0))
        : null;

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as any;
    const createdBy = parseInt(sessionUser.id, 10);

    const newQuotation = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quotationNo: quotationNo.trim(),
          preparedDate: new Date(preparedDate),
          expireDate: new Date(expireDate),
          paymentMethod,
          advancePercent: parsedAdvancePercent,
          quotationTo: quotationTo.trim(),
          preparedBy: (preparedBy || sessionUser.name || sessionUser.username || "Staff").trim(),
          subtotal: calculatedSubtotal,
          totalAmount: calculatedSubtotal,
          notes: notes?.trim() || null,
          status,
          createdBy,
          items: {
            create: validatedItems,
          },
        },
        include: {
          items: {
            orderBy: { itemIndex: "asc" },
          },
          author: {
            select: { id: true, name: true, username: true },
          },
        },
      });

      return quotation;
    });

    return NextResponse.json({ quotation: newQuotation }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quotation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create quotation" },
      { status: 500 }
    );
  }
}
