import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/quotations/[id] - Fetch single quotation with items and author
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { itemIndex: "asc" },
        },
        author: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("Error fetching quotation:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: 500 }
    );
  }
}

// PUT /api/quotations/[id] - Update quotation and its items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
    }

    const existing = await prisma.quotation.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
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
      status,
      items = [],
    } = body;

    // Check quotationNo uniqueness if changed
    if (quotationNo && quotationNo.trim() !== existing.quotationNo) {
      const duplicate = await prisma.quotation.findUnique({
        where: { quotationNo: quotationNo.trim() },
      });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: `Quotation number "${quotationNo}" already in use.` },
          { status: 409 }
        );
      }
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
        quantity,
        unitPrice,
        totalPrice,
      };
    });

    const parsedAdvancePercent =
      paymentMethod === "ADVANCE_PAYMENT" && advancePercent != null
        ? Math.max(0, Math.min(100, parseFloat(advancePercent) || 0))
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.quotationItem.deleteMany({
        where: { quotationId: id },
      });

      // Update quotation with new items
      return await tx.quotation.update({
        where: { id },
        data: {
          quotationNo: quotationNo ? quotationNo.trim() : existing.quotationNo,
          preparedDate: preparedDate ? new Date(preparedDate) : existing.preparedDate,
          expireDate: expireDate ? new Date(expireDate) : existing.expireDate,
          paymentMethod: paymentMethod || existing.paymentMethod,
          advancePercent: parsedAdvancePercent,
          quotationTo: quotationTo ? quotationTo.trim() : existing.quotationTo,
          preparedBy: preparedBy ? preparedBy.trim() : existing.preparedBy,
          subtotal: calculatedSubtotal,
          totalAmount: calculatedSubtotal,
          notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
          status: status || existing.status,
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
    });

    return NextResponse.json({ quotation: updated });
  } catch (error: any) {
    console.error("Error updating quotation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update quotation" },
      { status: 500 }
    );
  }
}

// DELETE /api/quotations/[id] - Delete a quotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
    }

    const existing = await prisma.quotation.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    await prisma.quotation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    return NextResponse.json(
      { error: "Failed to delete quotation" },
      { status: 500 }
    );
  }
}
