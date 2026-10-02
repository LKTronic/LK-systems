import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDynamicVocabulary, getFuzzySuggestion } from "@/lib/fuzzySearch";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 1) {
      return NextResponse.json([]);
    }

    const selectFields = {
      id: true,
      productName: true,
      modelAndName: true,
      sku: true,
      referenceNo: true,
      price: true,
      priceLKR: true,
      priceUSD: true,
      status: true,
      weight: true,
      imagePath: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    };

    let products = await prisma.product.findMany({
      where: {
        OR: [
          { productName: { contains: query } },
          { modelAndName: { contains: query } },
          { sku: { contains: query } },
          { referenceNo: { contains: query } },
        ],
      },
      select: selectFields,
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fuzzy search fallback for typos (e.g., pluse -> pulse)
    if (products.length === 0) {
      const vocab = await getDynamicVocabulary(prisma);
      const fuzzy = getFuzzySuggestion(query, vocab);
      if (fuzzy.hasCorrection) {
        products = await prisma.product.findMany({
          where: {
            OR: [
              { productName: { contains: fuzzy.correctedQuery } },
              { modelAndName: { contains: fuzzy.correctedQuery } },
              { sku: { contains: fuzzy.correctedQuery } },
              { referenceNo: { contains: fuzzy.correctedQuery } },
            ],
          },
          select: selectFields,
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
        });
      }
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}

