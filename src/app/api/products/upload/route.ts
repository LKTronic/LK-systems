import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withSequenceLock } from "@/lib/recordNo";
import ExcelJS from "exceljs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_ROWS = 2000;

function normalize(str: string): string {
  if (!str) return "";
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : str.toLowerCase().trim();
}

function sanitizeFormula(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
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

export interface ParsedProductImportRow {
  rowNumber: number;
  productName: string;
  modelAndName: string;
  description?: string;
  quantity: number;
  weight?: number | null;
  referenceLink?: string;
  imagePath?: string;
  price: number;
  priceLKR?: number | null;
  priceUSD?: number | null;
  currency: "LKR" | "USD";
  warrantyPeriod?: string;
  priceValidity?: string;
  leadTime?: string;
  isBrandNewOriginal?: string;
  supplierImage?: string;
  supplierNote?: string;
  computedStatus: "ACTIVE" | "NOT_REQUESTED";
  alreadyExistsInDb: boolean;
  errors: string[];
}


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id, 10);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const isDryRun = formData.get("dryRun") === "true";
    const defaultCategoryIdStr = formData.get("categoryId") as string | null;
    const defaultSupplierIdStr = formData.get("supplierId") as string | null;

    const defaultCategoryId = defaultCategoryIdStr && defaultCategoryIdStr !== "ALL"
      ? parseInt(defaultCategoryIdStr, 10)
      : null;
    const defaultSupplierId = defaultSupplierIdStr && defaultSupplierIdStr !== "ALL"
      ? parseInt(defaultSupplierIdStr, 10)
      : null;

    if (!file) {
      return NextResponse.json(
        { error: "No Excel file provided (.xlsx)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 15MB limit." },
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

    if (worksheet.rowCount > MAX_ROWS) {
      return NextResponse.json(
        { error: `Spreadsheet exceeds maximum limit of ${MAX_ROWS} rows.` },
        { status: 400 }
      );
    }

    // Step 1: Detect header row
    let headerRowNumber = -1;
    let colMap: Record<string, number> = {};
    let isUSD = false;

    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const headers: string[] = [];
      row.eachCell((cell) => {
        headers.push(normalize(cell.text || ""));
      });

      const hasProductOrModel = headers.some(
        (h) =>
          h.includes("product") ||
          h.includes("model") ||
          h.includes("name") ||
          h.includes("description") ||
          h.includes("sku")
      );

      if (hasProductOrModel) {
        headerRowNumber = r;
        row.eachCell((cell, colNumber) => {
          const norm = normalize(cell.text || "");
          if (
            norm.includes("productname") ||
            norm.includes("modelno") ||
            norm.includes("model") ||
            norm === "name" ||
            norm === "sku"
          ) {
            colMap.model = colNumber;
          } else if (norm.includes("description") || norm === "desc") {
            colMap.description = colNumber;
          } else if (norm.includes("quantity") || norm === "qty") {
            colMap.quantity = colNumber;
          } else if (norm.includes("supplierimage")) {
            colMap.supplierImage = colNumber;
          } else if (
            norm.includes("productimage") ||
            norm.includes("image") ||
            norm.includes("photo") ||
            norm.includes("picture") ||
            norm.includes("img") ||
            norm.includes("thumbnail")
          ) {
            colMap.image = colNumber;
          } else if (norm.includes("reference") || norm.includes("ref") || norm.includes("link")) {
            colMap.referenceLink = colNumber;
          } else if (norm.includes("weight")) {
            colMap.weight = colNumber;
          } else if (norm.includes("validity")) {
            colMap.validity = colNumber;
          } else if (norm.includes("price")) {
            colMap.price = colNumber;
            if (norm.includes("usd")) {
              isUSD = true;
            }
          } else if (norm.includes("warranty")) {
            colMap.warranty = colNumber;
          } else if (norm.includes("leadtime") || norm.includes("preparation")) {
            colMap.leadTime = colNumber;
          } else if (norm.includes("brandnew") || norm.includes("original")) {
            colMap.brandNew = colNumber;
          } else if (norm.includes("specialnote") || norm.includes("note")) {
            colMap.note = colNumber;
          }
        });
        break;
      }
    }

    if (headerRowNumber === -1) {
      return NextResponse.json(
        {
          error:
            "Could not identify the header row. Expected columns include: 'Product name', 'Description', 'Quantity', 'Price', etc.",
        },
        { status: 400 }
      );
    }

    // Fallback: If colMap.model is missing, default to column 1
    if (!colMap.model) colMap.model = 1;
    if (!colMap.description) colMap.description = 2;
    if (!colMap.quantity) colMap.quantity = 3;

    // Extract any embedded pictures from the Excel worksheet
    const embeddedImagesByRow = new Map<number, string>();
    try {
      const embeddedImages = typeof worksheet.getImages === "function" ? worksheet.getImages() : [];
      if (embeddedImages && embeddedImages.length > 0) {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
        await mkdir(uploadDir, { recursive: true });

        for (const imgRef of embeddedImages) {
          if (!imgRef || !imgRef.range || !imgRef.range.tl) continue;
          const tl = imgRef.range.tl as any;
          const rowZero = tl.nativeRow != null ? tl.nativeRow : tl.row;
          if (rowZero == null) continue;
          const rowNumber = Math.floor(rowZero) + 1;

          const imgData = workbook.getImage(imgRef.imageId as any);
          if (imgData && imgData.buffer) {
            const ext = imgData.extension ? `.${imgData.extension}` : ".jpg";
            const uniqueName = `excel-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
            const filePath = path.join(uploadDir, uniqueName);
            await writeFile(filePath, Buffer.from(imgData.buffer));
            embeddedImagesByRow.set(rowNumber, `/uploads/products/${uniqueName}`);
          }
        }
      }
    } catch (imgErr) {
      console.warn("Could not extract embedded images from worksheet:", imgErr);
    }

    // Pre-fetch existing products to check for duplicates in DB
    const existingProducts = await prisma.product.findMany({
      select: {
        id: true,
        modelAndName: true,
        productName: true,
        sku: true,
        recordNo: true,
      },
    });

    const existingNamesSet = new Set<string>();
    for (const p of existingProducts) {
      const nModel = normalize(p.modelAndName || "");
      if (nModel) existingNamesSet.add(nModel);
      const nProduct = normalize(p.productName || "");
      if (nProduct) existingNamesSet.add(nProduct);
      const nSku = normalize(p.sku || "");
      if (nSku) existingNamesSet.add(nSku);
    }

    const parsedRows: ParsedProductImportRow[] = [];
    let activeCount = 0;
    let notRequestedCount = 0;
    let errorCount = 0;
    let alreadyExistsCount = 0;

    const seenInSheet = new Set<string>();

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      if (!row.hasValues) continue;

      const getCellText = (colIdx?: number): string => {
        if (!colIdx) return "";
        const cell = row.getCell(colIdx);
        if (cell.hyperlink) {
          return cell.hyperlink.trim();
        }
        return cell.text ? sanitizeFormula(cell.text.trim()) : "";
      };

      const rawModel = getCellText(colMap.model);
      const rawDesc = getCellText(colMap.description);
      const rawQty = getCellText(colMap.quantity);
      const rawRefLink = getCellText(colMap.referenceLink);
      const rawWeight = getCellText(colMap.weight);
      const rawPrice = getCellText(colMap.price);
      const rawWarranty = getCellText(colMap.warranty);
      const rawValidity = getCellText(colMap.validity);
      const rawLeadTime = getCellText(colMap.leadTime);
      const rawBrandNew = getCellText(colMap.brandNew);
      const rawSupplierImage = getCellText(colMap.supplierImage);
      const rawSupplierNote = getCellText(colMap.note);

      // Extract image: from cell text or hyperlink in image column, or embedded picture, or supplierImage
      let rawImage = "";
      if (colMap.image) {
        const imgCell = row.getCell(colMap.image);
        if (imgCell.hyperlink) {
          rawImage = imgCell.hyperlink.trim();
        } else if (imgCell.text) {
          rawImage = sanitizeFormula(imgCell.text.trim());
        }
      }

      const embeddedImgUrl = embeddedImagesByRow.get(r);
      const finalImagePath = rawImage || embeddedImgUrl || rawSupplierImage || undefined;


      // Skip completely blank rows
      if (!rawModel && !rawDesc && !rawPrice && !rawQty) {
        continue;
      }

      const rowErrors: string[] = [];

      if (!rawModel) {
        rowErrors.push("Product name / Model name is required.");
      }

      // Quantity parsing (default 1)
      let parsedQty = 1;
      if (rawQty) {
        const q = parseInt(rawQty, 10);
        if (!isNaN(q) && q > 0) {
          parsedQty = q;
        }
      }

      // Weight parsing
      let parsedWeight: number | null = null;
      if (rawWeight) {
        const w = parseFloat(rawWeight);
        if (!isNaN(w) && w >= 0) {
          parsedWeight = w;
        }
      }

      // Price parsing
      const cleanPriceStr = rawPrice.replace(/[^0-9.-]/g, "").trim();
      let numericPrice = parseFloat(cleanPriceStr);
      const hasValidPrice = !isNaN(numericPrice) && numericPrice > 0;

      // Status determination:
      // "if the upload exel in product have price it stuts shold be active and if not price it sttus shold be not requates (new status)"
      const computedStatus: "ACTIVE" | "NOT_REQUESTED" = hasValidPrice
        ? "ACTIVE"
        : "NOT_REQUESTED";

      // Duplicate checking against database
      const normModel = normalize(rawModel);
      const alreadyInDb = Boolean(normModel && existingNamesSet.has(normModel));
      if (alreadyInDb) {
        alreadyExistsCount++;
      }

      if (normModel && seenInSheet.has(normModel)) {
        rowErrors.push(`Duplicate product '${rawModel}' found multiple times in this sheet.`);
      }
      if (normModel) {
        seenInSheet.add(normModel);
      }

      // Reference link scheme check
      if (rawRefLink && !/^https?:\/\//i.test(rawRefLink)) {
        rowErrors.push("Reference link must begin with http:// or https://");
      }

      if (rowErrors.length > 0) {
        errorCount++;
      } else if (!alreadyInDb) {
        // Only count as new Active/Not Requested if NOT already existing in PMS DB
        if (computedStatus === "ACTIVE") {
          activeCount++;
        } else {
          notRequestedCount++;
        }
      }

      parsedRows.push({
        rowNumber: r,
        productName: rawModel,
        modelAndName: rawModel,
        description: rawDesc || undefined,
        quantity: parsedQty,
        weight: parsedWeight,
        referenceLink: rawRefLink || undefined,
        price: hasValidPrice ? numericPrice : 0,
        priceLKR: hasValidPrice ? (isUSD ? null : numericPrice) : null,
        priceUSD: hasValidPrice ? (isUSD ? numericPrice : null) : null,
        currency: isUSD ? "USD" : "LKR",
        warrantyPeriod: rawWarranty || undefined,
        priceValidity: rawValidity || undefined,
        leadTime: rawLeadTime || undefined,
        isBrandNewOriginal: rawBrandNew || undefined,
        imagePath: finalImagePath,
        supplierImage: rawSupplierImage || finalImagePath || undefined,
        supplierNote: rawSupplierNote || undefined,
        computedStatus,
        alreadyExistsInDb: alreadyInDb,
        errors: rowErrors,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: "No product data rows found in the uploaded sheet." },
        { status: 400 }
      );
    }

    // Dry Run (Preview Only)
    if (isDryRun) {
      return NextResponse.json({
        isDryRun: true,
        summary: {
          totalRows: parsedRows.length,
          newCount: activeCount + notRequestedCount,
          activeCount,
          notRequestedCount,
          alreadyExistsCount,
          errorCount,
        },
        warning:
          alreadyExistsCount > 0
            ? `Warning: ${alreadyExistsCount} product(s) already exist in PMS and will NOT be added. Only the other ${activeCount + notRequestedCount} new product(s) will be added.`
            : null,
        previewRows: parsedRows.slice(0, 100), // Return first 100 rows for preview
      });
    }

    // Actual Import Execution - Only insert NEW valid rows (skip products already in DB)
    const validRowsToInsert = parsedRows.filter(
      (r) => r.errors.length === 0 && !r.alreadyExistsInDb
    );

    if (validRowsToInsert.length === 0) {
      if (alreadyExistsCount > 0) {
        return NextResponse.json(
          {
            error: `All valid products in this spreadsheet already exist in PMS (${alreadyExistsCount} skipped). No new products were added.`,
            summary: {
              totalRows: parsedRows.length,
              alreadyExistsCount,
              errorCount,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "All rows in the spreadsheet have errors. Please fix them and try again.",
          summary: {
            totalRows: parsedRows.length,
            errorCount,
          },
        },
        { status: 400 }
      );
    }

    let insertedCount = 0;

    await prisma.$transaction(
      async (tx) => {
        return await withSequenceLock(tx, async () => {
          // Find starting record number
          const lastProduct = await tx.product.findFirst({
            orderBy: { id: "desc" },
            select: { id: true, recordNo: true },
          });


      let currentNum = 1;
      if (lastProduct) {
        const recordNum = parseInt(lastProduct.recordNo, 10);
        currentNum = isNaN(recordNum)
          ? lastProduct.id + 1
          : Math.max(recordNum + 1, lastProduct.id + 1);
      }

      // Find starting SKU number atomically
      let currentSkuNum = 0;
      try {
        const skuRows = (await tx.$queryRawUnsafe(
          "SELECT MAX(CAST(SUBSTRING(sku, 6) AS UNSIGNED)) as maxSku FROM Product WHERE sku LIKE 'LKREQ%' FOR UPDATE"
        )) as any[];
        if (Array.isArray(skuRows) && skuRows.length > 0 && skuRows[0]?.maxSku != null) {
          currentSkuNum = Number(skuRows[0].maxSku) || 0;
        }
      } catch (e) {
        const lastSkuProd = await tx.product.findFirst({
          where: { sku: { startsWith: "LKREQ" } },
          orderBy: { id: "desc" },
          select: { sku: true },
        });
        if (lastSkuProd?.sku) {
          const parsed = parseInt(lastSkuProd.sku.replace(/^LKREQ/i, "").trim(), 10);
          if (!isNaN(parsed)) currentSkuNum = parsed;
        }
      }
      currentSkuNum++;

      for (const row of validRowsToInsert) {
        const recordNo = currentNum.toString().padStart(6, "0");
        const referenceNo = `REF-${recordNo}`;
        const sku = `LKREQ${currentSkuNum.toString().padStart(5, "0")}`;
        currentNum++;
        currentSkuNum++;

        const isRowActive = row.computedStatus === "ACTIVE";

        const created = await tx.product.create({
          data: {
            recordNo,
            referenceNo,
            sku,
            productName: row.productName,
            modelAndName: row.modelAndName,
            description: row.description || null,
            quantity: row.quantity,
            weight: row.weight != null ? row.weight : null,
            referenceLink: row.referenceLink || null,
            price: row.price,
            priceLKR: row.priceLKR,
            priceUSD: row.priceUSD,
            priceUpdatedAt: isRowActive ? new Date() : null,
            warrantyPeriod: row.warrantyPeriod || null,
            priceValidity: row.priceValidity || null,
            leadTime: row.leadTime || null,
            isBrandNewOriginal: row.isBrandNewOriginal || null,
            imagePath: row.imagePath || row.supplierImage || null,
            supplierImage: row.supplierImage || row.imagePath || null,
            supplierNote: row.supplierNote || null,
            categoryId: defaultCategoryId,
            supplierId: defaultSupplierId,
            status: row.computedStatus,
            productDate: new Date(),
            createdBy: userId,
          },
        });

        // If Active with price, create Price History
        if (isRowActive && row.price > 0) {
          await tx.productPriceHistory.create({
            data: {
              productId: created.id,
              priceLKR: row.priceLKR || (row.currency === "LKR" ? row.price : 0),
              priceUSD: row.priceUSD || (row.currency === "USD" ? row.price : null),
              supplierId: defaultSupplierId,
              warrantyPeriod: row.warrantyPeriod || null,
              leadTime: row.leadTime || null,
              note: row.supplierNote || null,
            },
          });
        }

        // Audit History
        await tx.productHistory.create({
          data: {
            productId: created.id,
            userId,
            action: "EXCEL_IMPORT",
            newData: {
              recordNo,
              status: row.computedStatus,
              price: row.price,
              currency: row.currency,
              quantity: row.quantity,
            },
          },
        });

            insertedCount++;
          }
        });
      },
      {
        maxWait: 30000,
        timeout: 60000,
      }
    );


    return NextResponse.json({
      success: true,
      message:
        alreadyExistsCount > 0
          ? `Successfully imported ${insertedCount} new products (${activeCount} Active, ${notRequestedCount} Not Requested). ${alreadyExistsCount} existing products were skipped.`
          : `Successfully imported ${insertedCount} products (${activeCount} Active, ${notRequestedCount} Not Requested).`,
      insertedCount,
      alreadyExistsCount,
      activeCount,
      notRequestedCount,
      errorCount,
    });
  } catch (error: any) {
    console.error("Error importing products via Excel:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process product Excel import." },
      { status: 500 }
    );
  }
}
