import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRdQuotationTables } from "@/lib/rdQuotationDb";
import { getNextRdQuotationNo } from "@/lib/rdQuotationNo";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureRdQuotationTables();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type"); // PROJECT_PROPOSAL, THREE_D_PRINT, PCB, or ALL
    const status = searchParams.get("status") || "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    const andConditions: any[] = [];

    if (type && type !== "ALL") {
      andConditions.push({ type });
    }

    if (status && status !== "ALL") {
      andConditions.push({ status });
    }

    if (search) {
      andConditions.push({
        OR: [
          { quotationNo: { contains: search } },
          { projectTitle: { contains: search } },
          { quotationTo: { contains: search } },
          { preparedBy: { contains: search } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [quotations, total] = await Promise.all([
      prisma.rdQuotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: "desc" },
        include: {
          author: {
            select: { id: true, name: true, username: true },
          },
          items: {
            orderBy: { itemIndex: "asc" },
          },
        },
      }),
      prisma.rdQuotation.count({ where }),
    ]);

    return NextResponse.json({
      quotations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing R&D quotations:", error);
    return NextResponse.json(
      { error: "Failed to list R&D quotations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureRdQuotationTables();

    const userId = parseInt((session.user as any).id, 10);
    const body = await request.json();

    const {
      type = "THREE_D_PRINT",
      quotationNo,
      registrationNo = "P-V 00336036",
      projectTitle,
      preparedDate,
      expireDate,
      validityDays = 5,
      paymentMethod = "100% payment",
      preparedBy,
      quotationTo,
      leadTime,
      warranty,
      hardwareTotal = 0,
      servicesTotal = 0,
      totalAmount,
      overview,
      technicalSpecs,
      termsAndConditions,
      status: requestedStatus,
      items = [],
    } = body;

    const isDraft = requestedStatus === "DRAFT";
    const finalStatus = isDraft ? "DRAFT" : "COMPLETED";

    if (!isDraft) {
      if (!preparedDate || !expireDate || !quotationTo || !preparedBy) {
        return NextResponse.json(
          { error: "Required fields missing: preparedDate, expireDate, quotationTo, or preparedBy." },
          { status: 400 }
        );
      }

      if (new Date(expireDate) < new Date(preparedDate)) {
        return NextResponse.json(
          { error: "Quotation Expire Date must be on or after Prepared Date." },
          { status: 400 }
        );
      }

      if (type === "PROJECT_PROPOSAL" && (!projectTitle || !projectTitle.trim())) {
        return NextResponse.json(
          { error: "Project Title is required for Project Proposals." },
          { status: 400 }
        );
      }

      if (!Array.isArray(items) || items.length === 0) {
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

    // Determine final dates and strings with draft fallbacks
    const fallbackPreparedDate = preparedDate ? new Date(preparedDate) : new Date();
    const fallbackExpireDate = expireDate
      ? new Date(expireDate)
      : new Date(fallbackPreparedDate.getTime() + (Number(validityDays) || 5) * 86400000);
    const finalQuotationTo = quotationTo?.trim() || (isDraft ? "Draft Customer" : "Customer");
    const finalPreparedBy = preparedBy?.trim() || (session.user as any)?.name || "LK Tronics";
    const finalProjectTitle = projectTitle?.trim() || (type === "PROJECT_PROPOSAL" && isDraft ? "Draft Project" : null);

    // Determine final quotation number
    const finalQuotationNo = quotationNo?.trim() || (await getNextRdQuotationNo(prisma, type));

    // Check uniqueness
    const existing = await prisma.rdQuotation.findUnique({
      where: { quotationNo: finalQuotationNo },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Quotation number '${finalQuotationNo}' already exists.` },
        { status: 400 }
      );
    }

    // Calculate total amount if not explicitly provided
    let calculatedTotal = Number(totalAmount) || 0;
    if (!calculatedTotal && Array.isArray(items) && items.length > 0) {
      calculatedTotal = items.reduce((sum: number, it: any) => {
        const q = Number(it.quantity) || 1;
        const p = Number(it.unitPrice) || 0;
        return sum + q * p;
      }, 0);
    }

    // Create R&D quotation with line items in transaction
    const newRdQuotation = await prisma.rdQuotation.create({
      data: {
        type,
        quotationNo: finalQuotationNo,
        registrationNo,
        projectTitle: finalProjectTitle,
        preparedDate: fallbackPreparedDate,
        expireDate: fallbackExpireDate,
        validityDays: Number(validityDays) || 5,
        paymentMethod,
        preparedBy: finalPreparedBy,
        quotationTo: finalQuotationTo,
        leadTime: leadTime ? leadTime.trim() : null,
        warranty: warranty ? warranty.trim() : null,
        hardwareTotal: Number(hardwareTotal) || 0,
        servicesTotal: Number(servicesTotal) || 0,
        totalAmount: calculatedTotal,
        overview: overview ? overview.trim() : null,
        technicalSpecs: typeof technicalSpecs === "object" ? JSON.stringify(technicalSpecs) : technicalSpecs || null,
        termsAndConditions: termsAndConditions ? termsAndConditions.trim() : null,
        status: finalStatus,
        createdBy: userId,
        items: {
          create: Array.isArray(items)
            ? items.map((it: any, idx: number) => {
                const qty = Number(it.quantity) || 1;
                const price = Number(it.unitPrice) || 0;
                return {
                  itemIndex: idx + 1,
                  itemType: it.itemType || "HARDWARE",
                  productOrService: it.productOrService?.trim() || `Item ${idx + 1}`,
                  quantity: Math.max(1, qty),
                  unitPrice: Math.max(0, price),
                  totalPrice: Number(it.totalPrice) || qty * price,
                  notes: it.notes || null,
                };
              })
            : [],
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      quotation: newRdQuotation,
    });
  } catch (error) {
    console.error("Error creating R&D quotation:", error);
    return NextResponse.json(
      { error: "Failed to create R&D quotation" },
      { status: 500 }
    );
  }
}

