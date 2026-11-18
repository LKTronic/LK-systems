import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRdQuotationTables } from "@/lib/rdQuotationDb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureRdQuotationTables();

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
    }

    const quotation = await prisma.rdQuotation.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, username: true },
        },
        items: {
          orderBy: { itemIndex: "asc" },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    return NextResponse.json({ quotation });
  } catch (error) {
    console.error("Error fetching R&D quotation:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureRdQuotationTables();

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
    }

    const existing = await prisma.rdQuotation.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const userId = parseInt((session.user as any).id, 10);
    const userRole = (session.user as any).role;
    const isOwner = existing.createdBy === userId;
    const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      type,
      quotationNo,
      registrationNo,
      projectTitle,
      preparedDate,
      expireDate,
      validityDays,
      paymentMethod,
      preparedBy,
      quotationTo,
      leadTime,
      warranty,
      hardwareTotal,
      servicesTotal,
      totalAmount,
      overview,
      technicalSpecs,
      termsAndConditions,
      status,
      items,
    } = body;

    const isDraft = status === "DRAFT";
    const finalStatus = isDraft ? "DRAFT" : "COMPLETED";

    if (!isDraft) {
      if (preparedDate && expireDate && new Date(expireDate) < new Date(preparedDate)) {
        return NextResponse.json(
          { error: "Quotation Expire Date must be on or after Prepared Date." },
          { status: 400 }
        );
      }

      if (type === "PROJECT_PROPOSAL" && projectTitle !== undefined && !projectTitle?.trim()) {
        return NextResponse.json(
          { error: "Project Title is required for Project Proposals." },
          { status: 400 }
        );
      }

      if (Array.isArray(items)) {
        if (items.length === 0) {
          return NextResponse.json(
            { error: "Quotation must contain at least one line item." },
            { status: 400 }
          );
        }
        if (items.some((i: any) => !i.productOrService || !i.productOrService.trim())) {
          return NextResponse.json(
            { error: "All line items must have a valid description or service title." },
            { status: 400 }
          );
        }
        if (items.some((i: any) => Number(i.quantity) < 1)) {
          return NextResponse.json(
            { error: "All line item quantities must be at least 1." },
            { status: 400 }
          );
        }
        if (items.some((i: any) => Number(i.unitPrice) < 0 || Number(i.totalPrice) < 0)) {
          return NextResponse.json(
            { error: "Line item prices cannot be negative." },
            { status: 400 }
          );
        }
      }
    }

    let calculatedTotal = Number(totalAmount) || 0;
    if (!calculatedTotal && Array.isArray(items) && items.length > 0) {
      calculatedTotal = items.reduce((sum: number, it: any) => {
        const q = Number(it.quantity) || 1;
        const p = Number(it.unitPrice) || 0;
        return sum + q * p;
      }, 0);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If items provided, recreate them
      if (Array.isArray(items)) {
        await tx.rdQuotationItem.deleteMany({
          where: { rdQuotationId: id },
        });

        await tx.rdQuotationItem.createMany({
          data: items.map((it: any, idx: number) => {
            const qty = Number(it.quantity) || 1;
            const price = Number(it.unitPrice) || 0;
            return {
              rdQuotationId: id,
              itemIndex: idx + 1,
              itemType: it.itemType || "HARDWARE",
              productOrService: it.productOrService || `Item ${idx + 1}`,
              quantity: qty,
              unitPrice: price,
              totalPrice: Number(it.totalPrice) || qty * price,
              notes: it.notes || null,
            };
          }),
        });
      }

      return await tx.rdQuotation.update({
        where: { id },
        data: {
          ...(type ? { type } : {}),
          ...(quotationNo ? { quotationNo: quotationNo.trim() } : {}),
          ...(registrationNo ? { registrationNo: registrationNo.trim() } : {}),
          projectTitle: projectTitle !== undefined ? (projectTitle ? projectTitle.trim() : null) : undefined,
          ...(preparedDate ? { preparedDate: new Date(preparedDate) } : {}),
          ...(expireDate ? { expireDate: new Date(expireDate) } : {}),
          ...(validityDays !== undefined ? { validityDays: Number(validityDays) } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(preparedBy ? { preparedBy: preparedBy.trim() } : {}),
          ...(quotationTo ? { quotationTo: quotationTo.trim() } : {}),
          leadTime: leadTime !== undefined ? (leadTime ? leadTime.trim() : null) : undefined,
          warranty: warranty !== undefined ? (warranty ? warranty.trim() : null) : undefined,
          hardwareTotal: hardwareTotal !== undefined ? Number(hardwareTotal) : undefined,
          servicesTotal: servicesTotal !== undefined ? Number(servicesTotal) : undefined,
          totalAmount: calculatedTotal || undefined,
          overview: overview !== undefined ? (overview ? overview.trim() : null) : undefined,
          technicalSpecs: technicalSpecs !== undefined ? (typeof technicalSpecs === "object" ? JSON.stringify(technicalSpecs) : technicalSpecs) : undefined,
          termsAndConditions: termsAndConditions !== undefined ? (termsAndConditions ? termsAndConditions.trim() : null) : undefined,
          ...(status ? { status: finalStatus } : {}),
        },
        include: {
          items: {
            orderBy: { itemIndex: "asc" },
          },
        },
      });
    });

    return NextResponse.json({ success: true, quotation: updated });
  } catch (error) {
    console.error("Error updating R&D quotation:", error);
    return NextResponse.json(
      { error: "Failed to update quotation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureRdQuotationTables();

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid quotation ID" }, { status: 400 });
    }

    const existing = await prisma.rdQuotation.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const userId = parseInt((session.user as any).id, 10);
    const userRole = (session.user as any).role;
    const isOwner = existing.createdBy === userId;
    const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    await prisma.rdQuotation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Error deleting R&D quotation:", error);
    return NextResponse.json(
      { error: "Failed to delete quotation" },
      { status: 500 }
    );
  }
}

