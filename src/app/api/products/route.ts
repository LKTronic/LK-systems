import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations/product";
import { getDynamicVocabulary, getFuzzySuggestion } from "@/lib/fuzzySearch";
import { getNextRecordNo, getNextSku, withSequenceLock } from "@/lib/recordNo";

// GET /api/products (List products with search, pagination, category, supplier, and status filters)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL"; // ALL, PENDING, ACTIVE, EXPIRED, PRICE_NOT_AVAILABLE, NOT_REQUESTED
    const source = searchParams.get("source") || "ALL"; // ALL, PMS, ONLINE_WEB
    const categoryId = searchParams.get("categoryId");
    const supplierId = searchParams.get("supplierId");
    const createdBy = searchParams.get("createdBy") || searchParams.get("addedBy");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(1000, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    const andConditions: any[] = [];

    // Filter by source: ALL, PMS, ONLINE_WEB (or LK_TRONICS)
    if (source && source !== "ALL") {
      if (source === "PMS") {
        andConditions.push({
          source: { notIn: ["ONLINE_WEB", "LK_TRONICS"] },
          externalId: null,
        });
      } else {
        andConditions.push({
          OR: [
            { source: "ONLINE_WEB" },
            { source: "LK_TRONICS" },
            { externalId: { not: null } },
          ],
        });
      }
    }

    // Filter by status unless "ALL" is specified
    if (status && status !== "ALL") {
      if (status === "PRICE_NOT_AVAILABLE") {
        andConditions.push({
          OR: [
            { status: "PRICE_NOT_AVAILABLE" },
            { price: 0 },
            { priceLKR: 0 },
          ],
        });
      } else if (status === "ACTIVE") {
        andConditions.push({
          status: "ACTIVE",
          price: { gt: 0 },
        });
      } else {
        andConditions.push({ status });
      }
    }

    // Filter by category (matches primary categoryId or secondary categories in categoryNames)
    if (categoryId && categoryId !== "ALL") {
      const parsedCatId = parseInt(categoryId, 10);
      if (!isNaN(parsedCatId)) {
        const catRecord = await prisma.category.findUnique({
          where: { id: parsedCatId },
          select: { name: true },
        });
        if (catRecord) {
          andConditions.push({
            OR: [
              { categoryId: parsedCatId },
              { categoryNames: { contains: `"${catRecord.name}"` } },
              { categoryNames: { contains: catRecord.name } },
            ],
          });
        } else {
          andConditions.push({ categoryId: parsedCatId });
        }
      }
    }

    // Filter by supplier ("ALL", "NONE", "UNASSIGNED", or supplier ID)
    if (supplierId === "NONE" || supplierId === "UNASSIGNED") {
      andConditions.push({ supplierId: null });
    } else if (supplierId && supplierId !== "ALL") {
      const parsedSup = parseInt(supplierId, 10);
      if (!isNaN(parsedSup)) {
        andConditions.push({ supplierId: parsedSup });
      }
    }

    // Filter by user who added the product
    if (createdBy && createdBy !== "ALL") {
      const parsedCreator = parseInt(createdBy, 10);
      if (!isNaN(parsedCreator)) {
        andConditions.push({ createdBy: parsedCreator });
      }
    }

    // Search matches on modelAndName, productName, referenceNo, sku, recordNo, or description
    if (search) {
      const searchWords = search.split(/\s+/).filter(Boolean);
      if (searchWords.length === 1) {
        andConditions.push({
          OR: [
            { modelAndName: { contains: search } },
            { productName: { contains: search } },
            { sku: { contains: search } },
            { referenceNo: { contains: search } },
            { recordNo: { contains: search } },
            { description: { contains: search } },
          ],
        });
      } else {
        // Multi-word search: all keywords must match within product metadata
        for (const word of searchWords) {
          andConditions.push({
            OR: [
              { modelAndName: { contains: word } },
              { productName: { contains: word } },
              { sku: { contains: word } },
              { referenceNo: { contains: word } },
              { recordNo: { contains: word } },
              { description: { contains: word } },
            ],
          });
        }
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      const dateCond: any = {};
      if (fromDate) dateCond.gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        dateCond.lte = endDate;
      }
      andConditions.push({ productDate: dateCond });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const includeRelations = {
      category: {
        select: { id: true, name: true },
      },
      supplier: {
        select: { id: true, name: true },
      },
      author: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    };

    let [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: "desc" },
        include: includeRelations,
      }),
      prisma.product.count({ where }),
    ]);

    let didYouMean: string | null = null;

    // Fuzzy search fallback when exact search yields 0 results (e.g. "pluse" -> "pulse")
    if (total === 0 && search) {
      const vocab = await getDynamicVocabulary(prisma);
      const fuzzy = getFuzzySuggestion(search, vocab);

      if (fuzzy.hasCorrection) {
        // Construct fuzzy search condition with the corrected query
        const fuzzyAndConditions = andConditions.filter(
          (c) =>
            !c.OR ||
            !c.OR.some(
              (sub: any) =>
                sub.productName?.contains === search ||
                sub.modelAndName?.contains === search
            )
        );

        fuzzyAndConditions.push({
          OR: [
            { modelAndName: { contains: fuzzy.correctedQuery } },
            { productName: { contains: fuzzy.correctedQuery } },
            { referenceNo: { contains: fuzzy.correctedQuery } },
            { sku: { contains: fuzzy.correctedQuery } },
            { recordNo: { contains: fuzzy.correctedQuery } },
          ],
        });

        const fuzzyWhere = { ...where, AND: fuzzyAndConditions };

        const [fuzzyProducts, fuzzyTotal] = await Promise.all([
          prisma.product.findMany({
            where: fuzzyWhere,
            skip,
            take: limit,
            orderBy: { id: "desc" },
            include: includeRelations,
          }),
          prisma.product.count({ where: fuzzyWhere }),
        ]);

        if (fuzzyTotal > 0) {
          products = fuzzyProducts;
          total = fuzzyTotal;
          didYouMean = fuzzy.correctedQuery;
        }
      }
    }

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      didYouMean,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/products (Create product / PMS Data Adding request)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id, 10);
    const userRole = (session.user as any).role;
    const isPrivileged = userRole === "ADMIN" || userRole === "SUPERADMIN";

    const body = await request.json();
    const parseResult = productSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: any) => e.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parseResult.data;
    const modelAndName = data.modelAndName;
    const productName = data.productName || modelAndName;
    const productDate = data.productDate ? new Date(data.productDate) : new Date();

    // Check duplicate referenceNo if provided
    if (data.referenceNo) {
      const existingRef = await prisma.product.findFirst({
        where: { referenceNo: { equals: data.referenceNo.trim() } },
      });
      if (existingRef) {
        return NextResponse.json(
          { error: `Reference number '${data.referenceNo}' already exists.` },
          { status: 409 }
        );
      }
    }

    // Create product inside transaction with sequence lock to prevent race conditions & duplicate SKUs
    const newProduct = await prisma.$transaction(
      async (tx) => {
        return await withSequenceLock(tx, async () => {
          const recordNo = await getNextRecordNo(tx);
          const referenceNo = data.referenceNo ? data.referenceNo.trim() : `REF-${recordNo}`;
          const sku = await getNextSku(tx);

          const created = await tx.product.create({
            data: {
              recordNo,
              referenceNo,
              productName,
              modelAndName,
              sku,
              productDate,
              price: data.priceLKR || data.price || 0,
              priceUSD: data.priceUSD || null,
              priceLKR: data.priceLKR || null,
              description: data.description || null,
              quantity: data.quantity || 1,
              weight: data.weight || null,
              referenceLink: data.referenceLink || null,
              additionalNote: data.additionalNote || null,
              imagePath: data.imagePath || null,
              categoryId: data.categoryId || null,
              supplierId: data.supplierId ? Number(data.supplierId) : null,
              createdBy: userId,
              status: isPrivileged && data.status ? data.status : "PENDING",
            },
            include: {
              category: true,
              author: {
                select: { name: true, username: true },
              },
            },
          });

          // Record audit history
          await tx.productHistory.create({
            data: {
              productId: created.id,
              userId,
              action: "CREATED",
              newData: {
                recordNo,
                referenceNo,
                modelAndName,
                quantity: created.quantity,
                status: created.status,
              },
            },
          });

          return created;
        });
      },
      {
        maxWait: 15000,
        timeout: 15000,
      }
    );


    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    console.error("Error creating product:", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (typeof target === "string" && target.includes("referenceNo")) {
        return NextResponse.json({ error: "Reference number already exists." }, { status: 409 });
      }
      return NextResponse.json(
        { error: "A unique constraint violation occurred." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create product request. Please try again." },
      { status: 500 }
    );
  }
}
