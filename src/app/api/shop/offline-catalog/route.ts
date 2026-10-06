import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/shop/offline-catalog (Fast compressed product catalog snapshot for Shop counter offline IndexedDB)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    // Accessible to SHOP, ADMIN, SUPERADMIN
    if (role !== "SHOP" && role !== "ADMIN" && role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Offline catalog is for shop counter and administrators" },
        { status: 403 }
      );
    }

    const products = await prisma.product.findMany({
      select: {
        id: true,
        recordNo: true,
        referenceNo: true,
        productName: true,
        modelAndName: true,
        sku: true,
        productDate: true,
        price: true,
        priceLKR: true,
        quantity: true,
        imagePath: true,
        source: true,
        externalId: true,
        externalUrl: true,
        referenceLink: true,
        description: true,
        additionalNote: true,
        stockStatus: true,
        shippingClass: true,
        status: true,
        categoryNames: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    const latestUpdate = products.length > 0 ? products[0].updatedAt : new Date();

    return NextResponse.json(
      {
        version: latestUpdate ? new Date(latestUpdate).getTime() : Date.now(),
        count: products.length,
        timestamp: new Date().toISOString(),
        products,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (error: any) {
    console.error("Failed to fetch offline shop catalog:", error);
    return NextResponse.json(
      { error: "Failed to generate offline catalog" },
      { status: 500 }
    );
  }
}
