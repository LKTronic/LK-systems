import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations/product";

// GET /api/products/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true, contactInfo: true },
        },
        author: {
          select: {
            name: true,
            username: true,
          },
        },
        priceHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

// PUT /api/products/:id (Update product)
export async function PUT(
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

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const isPrivileged = userRole === "ADMIN" || userRole === "SUPERADMIN";

    const body = await request.json();
    const parseResult = productSchema.partial().safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: any) => e.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parseResult.data;

    // SEC-03 Remediation: Prevent IDOR - Staff can only modify their own products (or assign supplier/quantity/description during pending export)
    const isPendingExportUpdate = Object.keys(data).every((k) =>
      ["supplierId", "quantity", "description"].includes(k)
    );

    if (!isPrivileged && existingProduct.createdBy !== userId && !isPendingExportUpdate) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to modify products created by other users." },
        { status: 403 }
      );
    }

    // SEC-04 Remediation: Only Admins can manually modify product status
    let targetStatus = existingProduct.status;
    if (data.status && data.status !== existingProduct.status) {
      if (!isPrivileged) {
        return NextResponse.json(
          { error: "Forbidden: Only administrators can manually change product status." },
          { status: 403 }
        );
      }
      targetStatus = data.status;
    }

    const modelAndName = data.modelAndName !== undefined ? data.modelAndName : existingProduct.modelAndName;
    const productName = data.productName !== undefined ? data.productName : (data.modelAndName || existingProduct.productName);
    const productDate = data.productDate ? new Date(data.productDate) : existingProduct.productDate;

    // Check duplicate referenceNo if changed
    if (data.referenceNo && data.referenceNo !== existingProduct.referenceNo) {
      const duplicateRef = await prisma.product.findFirst({
        where: {
          referenceNo: { equals: data.referenceNo.trim() },
          NOT: { id },
        },
      });
      if (duplicateRef) {
        return NextResponse.json(
          { error: `Reference number '${data.referenceNo}' already exists on another product.` },
          { status: 409 }
        );
      }
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          referenceNo: existingProduct.referenceNo, // Reference number is immutable
          productName,
          modelAndName,
          sku: data.sku !== undefined ? data.sku : existingProduct.sku,
          productDate,
          price: data.priceLKR !== undefined && data.priceLKR !== null ? data.priceLKR : data.price !== undefined ? data.price : existingProduct.price,
          priceUSD: data.priceUSD !== undefined ? data.priceUSD : existingProduct.priceUSD,
          priceLKR: data.priceLKR !== undefined ? data.priceLKR : existingProduct.priceLKR,
          description: data.description !== undefined ? data.description : existingProduct.description,
          quantity: data.quantity !== undefined ? (data.quantity || 1) : existingProduct.quantity,
          weight: data.weight !== undefined ? data.weight : existingProduct.weight,
          referenceLink: data.referenceLink !== undefined ? data.referenceLink : existingProduct.referenceLink,
          additionalNote: data.additionalNote !== undefined ? data.additionalNote : existingProduct.additionalNote,
          imagePath: data.imagePath !== undefined ? data.imagePath : existingProduct.imagePath,
          categoryId: data.categoryId !== undefined ? data.categoryId : existingProduct.categoryId,
          supplierId: data.supplierId !== undefined ? (data.supplierId ? Number(data.supplierId) : null) : existingProduct.supplierId,
          status: targetStatus,
        },
        include: {
          category: true,
          supplier: true,
        },
      });

      // Record audit history
      await tx.productHistory.create({
        data: {
          productId: id,
          userId,
          action: "UPDATED",
          oldData: {
            modelAndName: existingProduct.modelAndName,
            price: Number(existingProduct.price),
            status: existingProduct.status,
          },
          newData: {
            modelAndName: updated.modelAndName,
            price: Number(updated.price),
            status: updated.status,
          },
        },
      });

      return updated;
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error("Error updating product:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A unique constraint violation occurred (Reference Number or SKU)." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/:id (Delete Product - Staff, Admin, or SuperAdmin)
export async function DELETE(
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

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Record audit history
      await tx.productHistory.create({
        data: {
          productId: null,
          userId,
          action: "DELETED",
          oldData: {
            id: existingProduct.id,
            sku: existingProduct.sku,
            modelAndName: existingProduct.modelAndName,
            recordNo: existingProduct.recordNo,
          },
        },
      });

      // Delete product (cascades to priceHistory)
      await tx.product.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

