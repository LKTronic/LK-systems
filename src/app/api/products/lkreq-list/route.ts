import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        sku: { startsWith: "LKREQ" },
      },
      select: {
        id: true,
        sku: true,
        productName: true,
        modelAndName: true,
        imagePath: true,
      },
      orderBy: { sku: "asc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
