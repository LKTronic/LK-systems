import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations/product";
import { fetchOriginalWebProduct } from "@/lib/webStoreAutoSync";

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

    const userRole = (session.user as any).role;
    const isPrivileged = userRole === "ADMIN" || userRole === "SUPERADMIN";

    const isOnlineWeb =
      existingProduct.source === "ONLINE_WEB" ||
      existingProduct.source === "LK_TRONICS" ||
      Boolean(existingProduct.externalId);

    // Business Rule: Do not allow deleting Online Web products.
    // If an Online Web product has PMS modifications, deleting it removes the PMS modified data only,
    // retaining the product in the PMS repository.
    if (isOnlineWeb) {
      // SEC-03 Authorization: Only ADMIN / SUPERADMIN can reverse Online Web product changes
      if (!isPrivileged) {
        return NextResponse.json(
          { error: "Forbidden: Only administrators can reverse online web product changes." },
          { status: 403 }
        );
      }

      const isPmsModified = Boolean(
        existingProduct.supplierId ||
        existingProduct.priceUpdatedAt ||
        existingProduct.status === "PENDING" ||
        existingProduct.supplierNote ||
        existingProduct.priceUSD ||
        existingProduct.additionalNote?.includes("PMS Updated")
      );

      if (!isPmsModified) {
        return NextResponse.json(
          { error: "Online Web products cannot be deleted." },
          { status: 400 }
        );
      }

      // Clean out PMS update note tag if present
      let cleanNote = existingProduct.additionalNote || "";
      cleanNote = cleanNote.replace(/\[PMS Updated Price[^\]]*\]\s*/g, "").trim();

      // Retrieve original web data directly from WooCommerce store if available
      let originalWebData: any = null;
      if (existingProduct.externalId) {
        originalWebData = await fetchOriginalWebProduct(existingProduct.externalId);
      }

      const originalPrice =
        originalWebData?.price !== undefined
          ? originalWebData.price
          : Number(existingProduct.price);

      const resetStatus =
        originalPrice === 0 ? "PRICE_NOT_AVAILABLE" : "ACTIVE";

      await prisma.$transaction(async (tx) => {
        // Clear supplier quotation price history
        await tx.productPriceHistory.deleteMany({
          where: { productId: id },
        });

        // Record audit history
        await tx.productHistory.create({
          data: {
            productId: id,
            userId,
            action: "PMS_DATA_REMOVED",
            oldData: {
              id: existingProduct.id,
              sku: existingProduct.sku,
              modelAndName: existingProduct.modelAndName,
              supplierId: existingProduct.supplierId,
              status: existingProduct.status,
              price: existingProduct.price,
              priceLKR: existingProduct.priceLKR,
              priceUpdatedAt: existingProduct.priceUpdatedAt,
              additionalNote: existingProduct.additionalNote,
            },
            newData: {
              status: resetStatus,
              price: originalPrice,
              message: "Removed all PMS modifications; restored original web store data",
            },
          },
        });

        // Reset PMS-specific quotation fields and restore original web data
        await tx.product.update({
          where: { id },
          data: {
            // Restore original web data from WooCommerce
            ...(originalWebData?.name
              ? {
                  productName: originalWebData.name,
                  modelAndName: originalWebData.name,
                }
              : {}),
            ...(originalWebData?.sku ? { sku: originalWebData.sku } : {}),
            ...(originalWebData?.price !== undefined
              ? {
                  price: originalWebData.price,
                  priceLKR: originalWebData.price,
                }
              : {}),
            ...(originalWebData?.quantity !== undefined
              ? { quantity: originalWebData.quantity }
              : {}),
            ...(originalWebData?.stockStatus
              ? { stockStatus: originalWebData.stockStatus }
              : {}),
            ...(originalWebData?.shippingClass !== undefined
              ? { shippingClass: originalWebData.shippingClass }
              : {}),
            ...(originalWebData?.imageUrl
              ? { imagePath: originalWebData.imageUrl }
              : {}),
            ...(originalWebData?.description
              ? { description: originalWebData.description }
              : {}),
            ...(originalWebData?.weight !== undefined
              ? { weight: originalWebData.weight }
              : {}),
            ...(originalWebData?.permalink
              ? {
                  referenceLink: originalWebData.permalink,
                  externalUrl: originalWebData.permalink,
                }
              : {}),

            // Remove all PMS-specific quotation data
            supplierId: null,
            priceUpdatedAt: null,
            priceUSD: null,
            warrantyPeriod: null,
            priceValidity: null,
            leadTime: null,
            isBrandNewOriginal: null,
            supplierImage: null,
            supplierNote: null,
            additionalNote: cleanNote || null,
            status: resetStatus,
          },
        });
      });

      return NextResponse.json({
        message: "Removed PMS modifications. Restored original web store data.",
        reverted: true,
      });
    }

    // Standard PMS Local Product: permanently delete
    // SEC-03 Authorization: STAFF can only delete products they created, and only while PENDING
    if (!isPrivileged) {
      if (existingProduct.createdBy !== userId) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to delete products created by other users." },
          { status: 403 }
        );
      }
      if (existingProduct.status !== "PENDING") {
        return NextResponse.json(
          { error: "Forbidden: Staff members can only delete pending products. Please contact an administrator." },
          { status: 403 }
        );
      }
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

