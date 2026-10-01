import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

// Neutralizes CSV / Excel formula injection (CWE-1236)
function escapeFormulaForExport(val: string): string {
  if (
    val.startsWith("=") ||
    val.startsWith("+") ||
    val.startsWith("-") ||
    val.startsWith("@") ||
    val.startsWith("\t") ||
    val.startsWith("\r")
  ) {
    return "'" + val;
  }
  return val;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const where: any = {
      status: "ACTIVE",
    };

    if (fromDate || toDate) {
      where.productDate = {};
      if (fromDate) {
        where.productDate.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        where.productDate.lte = endDate;
      }
    }

    // Strictly select only non-user identifying fields to guarantee privacy
    const products = await prisma.product.findMany({
      where,
      orderBy: { recordNo: "asc" },
      select: {
        recordNo: true,
        productName: true,
        sku: true,
        productDate: true,
        price: true,
        imagePath: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Product Management System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Products", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Define table columns
    worksheet.columns = [
      { header: "Record No", key: "recordNo", width: 15 },
      { header: "Product Name", key: "productName", width: 35 },
      { header: "SKU", key: "sku", width: 20 },
      { header: "Date", key: "productDate", width: 16 },
      { header: "Price", key: "price", width: 18 },
      { header: "Product Image", key: "imagePath", width: 30 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // Slate-800
      };
      cell.font = {
        name: "Segoe UI",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });

    // Populate data rows
    products.forEach((prod, index) => {
      const formattedDate = new Date(prod.productDate).toISOString().split("T")[0];
      const numericPrice = Number(prod.price);

      const row = worksheet.addRow({
        recordNo: prod.recordNo,
        productName: escapeFormulaForExport(prod.productName),
        sku: escapeFormulaForExport(prod.sku || ""),
        productDate: formattedDate,
        price: numericPrice,
        imagePath: prod.imagePath ? prod.imagePath : "N/A",
      });

      row.height = 22;

      // Row zebra styling & formatting
      const isEven = index % 2 === 0;
      const bg = isEven ? "FFF8FAFC" : "FFFFFFFF";

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bg },
        };
        cell.font = { name: "Segoe UI", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        // Alignments & formats
        if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "$#,##0.00;($#,##0.00);-";
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });
    });

    // Enable auto-filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 6 },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `products_export_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel export." },
      { status: 500 }
    );
  }
}
