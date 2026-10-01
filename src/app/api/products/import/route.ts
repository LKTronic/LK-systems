import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { getNextRecordNo } from "@/lib/recordNo";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

interface ExcelRowValidation {
  rowNumber: number;
  productName: string;
  sku: string;
  productDate: string;
  price: number;
  imagePath?: string;
  status: "NEW" | "DUPLICATE" | "INVALID" | "WARNING";
  errors: string[];
}

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10MB limit
const MAX_IMPORT_ROWS = 5000; // 5,000 rows limit to prevent DoS / timeouts

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Neutralizes Excel / CSV formula injection (CWE-1236)
function sanitizeFormula(val: string): string {
  const trimmed = val.trim();
  if (
    trimmed.startsWith("=") ||
    trimmed.startsWith("+") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("@") ||
    trimmed.startsWith("\t") ||
    trimmed.startsWith("\r")
  ) {
    return "'" + trimmed;
  }
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SEC-06 Remediation: Rate limit Excel imports (max 10 per minute per IP)
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`import:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.reset);
    }

    const userId = parseInt((session.user as any).id, 10);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const isDryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No Excel file provided (.xlsx)" },
        { status: 400 }
      );
    }

    // SEC-07 Remediation: Check file size upfront before reading into memory
    if (file.size > MAX_IMPORT_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 10MB limit. Please upload a smaller file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { error: "The Excel file contains no worksheets." },
        { status: 400 }
      );
    }

    // SEC-07 Remediation: Check maximum rows to avoid transaction timeouts & memory exhaustion
    if (worksheet.rowCount > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        {
          error: `The spreadsheet contains ${worksheet.rowCount} rows, exceeding the maximum limit of ${MAX_IMPORT_ROWS} rows.`,
        },
        { status: 400 }
      );
    }

    // Step 1: Detect header row and map columns
    let headerRowNumber = -1;
    let colMap: Record<string, number> = {};

    worksheet.eachRow((row, rowNumber) => {
      if (headerRowNumber !== -1) return;

      const headers: Record<string, number> = {};
      row.eachCell((cell, colNumber) => {
        const text = cell.text ? cell.text.trim() : "";
        const normalized = normalizeHeader(text);

        if (normalized.includes("productname") || normalized === "product" || normalized === "name") {
          headers["productName"] = colNumber;
        } else if (normalized.includes("sku") || normalized === "itemcode" || normalized === "code") {
          headers["sku"] = colNumber;
        } else if (normalized.includes("date") || normalized === "productdate") {
          headers["productDate"] = colNumber;
        } else if (normalized.includes("price") || normalized === "cost" || normalized === "unitprice") {
          headers["price"] = colNumber;
        } else if (normalized.includes("image") || normalized === "picture" || normalized === "photo") {
          headers["imagePath"] = colNumber;
        }
        // Strict Privacy Rule: Ignore User Name, Username, Created By, User ID if present!
      });

      if (headers["productName"] && headers["sku"]) {
        headerRowNumber = rowNumber;
        colMap = headers;
      }
    });

    if (headerRowNumber === -1) {
      return NextResponse.json(
        {
          error:
            "Could not identify valid headers. Please ensure the Excel contains 'Product Name' and 'SKU' columns.",
        },
        { status: 400 }
      );
    }

    // Pre-fetch all existing product names and SKUs from DB for fast duplicate detection
    const existingProducts = await prisma.product.findMany({
      select: { productName: true, sku: true },
    });

    const dbSkuSet = new Set(
      existingProducts.filter((p) => p.sku).map((p) => p.sku!.toLowerCase().trim())
    );
    const dbNameSet = new Set(existingProducts.map((p) => p.productName.toLowerCase().trim()));

    const seenFileSkus = new Set<string>();
    const seenFileNames = new Set<string>();

    const rowResults: ExcelRowValidation[] = [];
    const validRowsToInsert: Array<{
      productName: string;
      sku: string;
      productDate: Date;
      price: number;
      imagePath?: string;
    }> = [];

    // Parse each data row
    const rowCount = worksheet.rowCount;
    for (let r = headerRowNumber + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      if (!row.hasValues) continue;

      const rawName = colMap["productName"] ? row.getCell(colMap["productName"]).text : "";
      const rawSku = colMap["sku"] ? row.getCell(colMap["sku"]).text : "";
      const rawDate = colMap["productDate"] ? row.getCell(colMap["productDate"]).value : "";
      const rawPrice = colMap["price"] ? row.getCell(colMap["price"]).value : "";
      const rawImage = colMap["imagePath"] ? row.getCell(colMap["imagePath"]).text : "";

      const productName = sanitizeFormula((rawName || "").trim());
      const sku = sanitizeFormula((rawSku || "").trim().toUpperCase());
      const errors: string[] = [];

      if (!productName) {
        errors.push("Product Name is missing");
      }
      if (!sku) {
        errors.push("SKU is missing");
      }

      // Parse price
      let price = 0;
      if (typeof rawPrice === "number") {
        price = rawPrice;
      } else if (typeof rawPrice === "string") {
        const cleaned = rawPrice.replace(/[^0-9.-]+/g, "");
        price = parseFloat(cleaned) || 0;
      }
      if (isNaN(price) || price < 0) {
        errors.push("Price must be a valid non-negative number");
      }

      // Parse date
      let productDate = new Date();
      if (rawDate) {
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
          productDate = rawDate;
        } else {
          const parsed = new Date(String(rawDate));
          if (!isNaN(parsed.getTime())) {
            productDate = parsed;
          }
        }
      }

      const lowerSku = sku.toLowerCase();
      const lowerName = productName.toLowerCase();

      let status: "NEW" | "DUPLICATE" | "INVALID" | "WARNING" = "NEW";

      if (errors.length > 0) {
        status = "INVALID";
      } else if (dbSkuSet.has(lowerSku)) {
        status = "DUPLICATE";
        errors.push(`SKU '${sku}' already exists in database.`);
      } else if (dbNameSet.has(lowerName)) {
        status = "DUPLICATE";
        errors.push(`Product Name '${productName}' already exists in database.`);
      } else if (seenFileSkus.has(lowerSku)) {
        status = "DUPLICATE";
        errors.push(`Duplicate SKU '${sku}' found within this Excel file.`);
      } else if (seenFileNames.has(lowerName)) {
        status = "DUPLICATE";
        errors.push(`Duplicate Product Name '${productName}' found within this Excel file.`);
      }

      if (sku) seenFileSkus.add(lowerSku);
      if (productName) seenFileNames.add(lowerName);

      const validationEntry: ExcelRowValidation = {
        rowNumber: r,
        productName,
        sku,
        productDate: productDate.toISOString().split("T")[0],
        price,
        imagePath: (rawImage || "").trim() || undefined,
        status,
        errors,
      };

      rowResults.push(validationEntry);

      if (status === "NEW") {
        validRowsToInsert.push({
          productName,
          sku,
          productDate,
          price,
          imagePath: validationEntry.imagePath,
        });
      }
    }

    const summary = {
      totalRows: rowResults.length,
      valid: rowResults.filter((r) => r.status === "NEW").length,
      duplicates: rowResults.filter((r) => r.status === "DUPLICATE").length,
      invalid: rowResults.filter((r) => r.status === "INVALID").length,
    };

    // If dry run / preview mode, return summary and rows for user confirmation
    if (isDryRun) {
      return NextResponse.json({
        summary,
        rows: rowResults,
      });
    }

    // Actual bulk insert
    if (validRowsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid products found to import." },
        { status: 400 }
      );
    }

    const insertedCount = await prisma.$transaction(async (tx) => {
      // Find starting record number
      let currentRecordNo = await getNextRecordNo(tx);
      let numericRecord = parseInt(currentRecordNo, 10);

      for (const item of validRowsToInsert) {
        const recordNoStr = numericRecord.toString().padStart(6, "0");
        numericRecord++;

        const product = await tx.product.create({
          data: {
            recordNo: recordNoStr,
            productName: item.productName,
            sku: item.sku,
            productDate: item.productDate,
            price: item.price,
            imagePath: item.imagePath || null,
            createdBy: userId,
            status: "ACTIVE",
          },
        });

        await tx.productHistory.create({
          data: {
            productId: product.id,
            userId,
            action: "IMPORTED",
            newData: {
              recordNo: recordNoStr,
              productName: item.productName,
              sku: item.sku,
              price: item.price,
            },
          },
        });
      }

      return validRowsToInsert.length;
    });

    return NextResponse.json({
      message: `Successfully imported ${insertedCount} products.`,
      summary,
      rows: rowResults,
    });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json(
      { error: "Failed to process Excel file." },
      { status: 500 }
    );
  }
}
