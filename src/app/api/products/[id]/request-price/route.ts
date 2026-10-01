import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/products/:id/request-price - Transition product back to PENDING for re-quotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id, 10);
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const previousStatus = product.status;

    const updated = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.update({
        where: { id },
        data: {
          status: "PENDING",
          priceUSD: null,
          warrantyPeriod: null,
          priceValidity: null,
          leadTime: null,
          isBrandNewOriginal: null,
          supplierImage: null,
          supplierNote: null,
        },
      });

      await tx.productHistory.create({
        data: {
          productId: id,
          userId,
          action: "PRICE_REQUESTED",
          oldData: { status: previousStatus },
          newData: { status: "PENDING" },
        },
      });

      return prod;
    });

    return NextResponse.json({
      success: true,
      message: `Product ${product.referenceNo || product.recordNo} status updated to Pending for price quotation.`,
      product: updated,
    });
  } catch (error) {
    console.error("Error requesting price:", error);
    return NextResponse.json(
      { error: "Failed to request price" },
      { status: 500 }
    );
  }
}
