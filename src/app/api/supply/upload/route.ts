import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { getClientIp, checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 5000;

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

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

interface ParsedSupplierRow {
  rowNumber: number;
  referenceNo: string;
  modelAndName: string;
  quantity?: number;
  weight?: number | null;
  price: number;
  priceLKR: number;
  priceUSD?: number | null;
  currency: "USD" | "LKR";
  isPriceZero: boolean;
  warrantyPeriod: string;
  priceValidity: string;
  leadTime: string;
  isBrandNewOriginal: string;
  supplierImage: string;
  supplierNote: string;
  matchedProductId?: number;
  currentStatus?: string;
  status: "VALID" | "PRICE_NOT_AVAILABLE" | "INVALID" | "NOT_FOUND";
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`supply_upload:${clientIp}`, 20, 60 * 1000);
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.reset);
    }

    const userId = parseInt((session.user as any).id, 10);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const supplierIdStr = formData.get("supplierId") as string | null;
    const isDryRun = formData.get("dryRun") === "true";

    if (!supplierIdStr || isNaN(parseInt(supplierIdStr, 10))) {
      return NextResponse.json(
        { error: "Please select a valid supplier before uploading the sheet." },
        { status: 400 }
      );
    }

    const supplierId = parseInt(supplierIdStr, 10);
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Selected supplier not found in database." },
        { status: 404 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No Excel file provided (.xlsx)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 10MB limit." },
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

    // Step 1: Detect header row (support both custom downloaded template and legacy formats)
    let headerRowNumber = -1;
    let colMap: Record<string, number> = {};
    let isUSD = false;

    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const headers: string[] = [];
      row.eachCell((cell) => {
        headers.push(normalize(cell.text || ""));
      });

      const hasPrice = headers.some(
        (h) => h.includes("price") || h.includes("lkr") || h.includes("usd")
      );
      const hasRefOrModel = headers.some(
        (h) =>
          h.includes("reference") ||
          h.includes("model") ||
          h.includes("product") ||
          h.includes("name") ||
          h.includes("sku") ||
          h.includes("ref")
      );

      if (hasPrice && hasRefOrModel) {
        headerRowNumber = r;
        row.eachCell((cell, colNumber) => {
          const norm = normalize(cell.text || "");
          if (
            norm.includes("referencenumber") ||
            norm.includes("refno") ||
            norm === "reference" ||
            norm === "ref"
          ) {
            colMap.ref = colNumber;
          } else if (
            norm.includes("productname") ||
            norm.includes("modelno") ||
            norm.includes("model") ||
            norm === "name" ||
            norm === "sku"
          ) {
            colMap.model = colNumber;
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
          } else if (norm.includes("supplierimage")) {
            colMap.supplierImage = colNumber;
          } else if (norm.includes("quantity") || norm === "qty") {
            colMap.quantity = colNumber;
          } else if (norm.includes("weight")) {
            colMap.weight = colNumber;
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
            "Could not identify the header row. Expected columns include: 'Product name' (or 'Reference Number') and 'Price in USD' (or 'Price (LKR)').",
        },
        { status: 400 }
      );
    }

    // Step 2: Scan worksheet rows first to collect search candidate identifiers
    const rawSheetRows: Array<{
      rowNumber: number;
      refText: string;
      modelText: string;
      rawQtyText: string;
      rawWeightText: string;
      rawPriceText: string;
      warranty: string;
      validity: string;
      leadTime: string;
      brandNew: string;
      supplierImage: string;
      supplierNote: string;
    }> = [];

    const candidateRefs = new Set<string>();
    const candidateModels = new Set<string>();

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      if (!row.hasValues) continue;

      const getCellText = (colIdx?: number): string => {
        if (!colIdx) return "";
        const cell = row.getCell(colIdx);
        return cell.text ? sanitizeFormula(cell.text.trim()) : "";
      };

      const refText = getCellText(colMap.ref);
      const modelText = getCellText(colMap.model);
      const rawQtyText = getCellText(colMap.quantity);
      const rawWeightText = getCellText(colMap.weight);
      const rawPriceText = getCellText(colMap.price || colMap.priceLKR || colMap.priceUSD);
      const warranty = getCellText(colMap.warranty);
      const validity = getCellText(colMap.validity);
      const leadTime = getCellText(colMap.leadTime);
      const brandNew = getCellText(colMap.brandNew);
      const supplierImage = getCellText(colMap.supplierImage);
      const supplierNote = getCellText(colMap.note);

      // Skip completely empty trailing rows
      if (!refText && !modelText && !rawPriceText) {
        continue;
      }

      rawSheetRows.push({
        rowNumber: r,
        refText,
        modelText,
        rawQtyText,
        rawWeightText,
        rawPriceText,
        warranty,
        validity,
        leadTime,
        brandNew,
        supplierImage,
        supplierNote,
      });

      if (refText) candidateRefs.add(refText.trim());
      if (modelText) candidateModels.add(modelText.trim());
    }

    // Step 3: Fetch ONLY matching candidate products and pending requests (DB-01 Optimization)
    const candidateRefArray = Array.from(candidateRefs);
    const candidateModelArray = Array.from(candidateModels);

    const whereConditions: any[] = [{ status: "PENDING" }];
    if (candidateRefArray.length > 0) {
      whereConditions.push(
        { referenceNo: { in: candidateRefArray } },
        { recordNo: { in: candidateRefArray } },
        { sku: { in: candidateRefArray } }
      );
    }
    if (candidateModelArray.length > 0) {
      whereConditions.push(
        { modelAndName: { in: candidateModelArray } },
        { productName: { in: candidateModelArray } },
        { sku: { in: candidateModelArray } }
      );
    }

    const allProducts = await prisma.product.findMany({
      where: {
        OR: whereConditions,
      },
      select: {
        id: true,
        recordNo: true,
        referenceNo: true,
        sku: true,
        modelAndName: true,
        productName: true,
        status: true,
        priceLKR: true,
        priceUSD: true,
        source: true,
        externalId: true,
        additionalNote: true,
      },
    });

    const parsedRows: ParsedSupplierRow[] = [];
    let validCount = 0;
    let notAvailableCount = 0;
    let errorCount = 0;

    for (const sheetRow of rawSheetRows) {
      const {
        rowNumber: r,
        refText,
        modelText,
        rawQtyText,
        rawWeightText,
        rawPriceText,
        warranty,
        validity,
        leadTime,
        brandNew,
        supplierImage,
        supplierNote,
      } = sheetRow;

      const parsedQty = rawQtyText ? parseInt(rawQtyText, 10) : undefined;
      const parsedWeight = rawWeightText ? parseFloat(rawWeightText) : undefined;

      const rowErrors: string[] = [];

      // Validate matching identifier
      if (!refText && !modelText) {
        rowErrors.push("Row missing Product / Model Name.");
      }

      // Multi-pass prioritized matching:
      const cleanModel = modelText.trim().toLowerCase();
      const normModel = normalize(modelText);
      let matched: (typeof allProducts)[0] | undefined = undefined;

      if (refText) {
        const cleanRef = refText.trim().toLowerCase();
        const normRef = normalize(refText);
        matched = allProducts.find(
          (p) =>
            (p.referenceNo && (p.referenceNo.toLowerCase() === cleanRef || normalize(p.referenceNo) === normRef)) ||
            (p.recordNo && (p.recordNo.toLowerCase() === cleanRef || normalize(p.recordNo) === normRef)) ||
            (p.sku && p.sku !== "-1" && (p.sku.toLowerCase() === cleanRef || normalize(p.sku) === normRef))
        );
      }

      // Pass 2: Exact Model Name or Product Name match (case-insensitive, prioritizing PENDING products)
      if (!matched && cleanModel) {
        matched =
          allProducts.find(
            (p) =>
              p.status === "PENDING" &&
              ((p.modelAndName && p.modelAndName.trim().toLowerCase() === cleanModel) ||
                (p.productName && p.productName.trim().toLowerCase() === cleanModel))
          ) ||
          allProducts.find(
            (p) =>
              (p.modelAndName && p.modelAndName.trim().toLowerCase() === cleanModel) ||
              (p.productName && p.productName.trim().toLowerCase() === cleanModel)
          );
      }

      // Pass 3: Exact Normalized Model Name or Product Name match (ignoring spaces & symbols)
      if (!matched && normModel) {
        matched =
          allProducts.find(
            (p) =>
              p.status === "PENDING" &&
              ((p.modelAndName && normalize(p.modelAndName) === normModel) ||
                (p.productName && normalize(p.productName) === normModel))
          ) ||
          allProducts.find(
            (p) =>
              (p.modelAndName && normalize(p.modelAndName) === normModel) ||
              (p.productName && normalize(p.productName) === normModel)
          );
      }

      // Pass 4: Match by exact SKU if modelText equals SKU (e.g. user entered SKU in product name column)
      if (!matched && cleanModel) {
        matched = allProducts.find(
          (p) => p.sku && p.sku !== "-1" && p.sku.trim().toLowerCase() === cleanModel
        );
      }

      // Pass 5: Substring match only for valid SKUs (must be >= 4 alphanumeric chars, e.g. LKMOT00001)
      if (!matched && normModel) {
        matched = allProducts.find((p) => {
          if (!p.sku || p.sku === "-1") return false;
          const nSku = normalize(p.sku);
          if (nSku.length < 4) return false;
          return normModel.includes(nSku) || nSku.includes(normModel);
        });
      }

      if (!matched) {
        rowErrors.push(`No matching product found in PMS for '${modelText || refText}'.`);
      }

      // Validate price column
      const cleanPriceStr = rawPriceText.replace(/[^0-9.-]/g, "").trim();
      let numericPrice = parseFloat(cleanPriceStr);
      let isZero = false;

      if (!rawPriceText) {
        rowErrors.push("Price column is empty.");
      } else if (
        rawPriceText === "0" ||
        rawPriceText === "00" ||
        cleanPriceStr === "0" ||
        cleanPriceStr === "0.00" ||
        cleanPriceStr === "00"
      ) {
        numericPrice = 0;
        isZero = true;
      } else if (isNaN(numericPrice) || numericPrice < 0) {
        rowErrors.push(`Price '${rawPriceText}' contains invalid characters or is negative.`);
      }

      let rowStatus: ParsedSupplierRow["status"] = "VALID";
      if (rowErrors.length > 0) {
        rowStatus = matched ? "INVALID" : "NOT_FOUND";
        errorCount++;
      } else if (isZero) {
        rowStatus = "PRICE_NOT_AVAILABLE";
        notAvailableCount++;
      } else {
        rowStatus = "VALID";
        validCount++;
      }

      parsedRows.push({
        rowNumber: r,
        referenceNo: refText || matched?.referenceNo || matched?.recordNo || "",
        modelAndName: modelText || matched?.modelAndName || matched?.productName || "",
        quantity: parsedQty !== undefined && !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : undefined,
        weight: parsedWeight !== undefined && !isNaN(parsedWeight) && parsedWeight >= 0 ? parsedWeight : null,
        price: isNaN(numericPrice) ? 0 : numericPrice,
        priceLKR: isNaN(numericPrice) ? 0 : numericPrice,
        priceUSD: null,
        currency: "LKR",
        isPriceZero: isZero,
        warrantyPeriod: warranty,
        priceValidity: validity,
        leadTime,
        isBrandNewOriginal: brandNew,
        supplierImage,
        supplierNote,
        matchedProductId: matched?.id,
        currentStatus: matched?.status,
        status: rowStatus,
        errors: rowErrors,
      });
    }

    // If dryRun is requested, return the preview validation result without saving
    if (isDryRun) {
      return NextResponse.json({
        isDryRun: true,
        supplier: { id: supplier.id, name: supplier.name },
        summary: {
          totalRows: parsedRows.length,
          validCount,
          notAvailableCount,
          errorCount,
        },
        rows: parsedRows,
      });
    }

    // Step 3: Commit updates in transaction
    if (errorCount > 0) {
      return NextResponse.json(
        {
          error: `Spreadsheet contains ${errorCount} error(s). Please review and correct before committing.`,
          summary: {
            totalRows: parsedRows.length,
            validCount,
            notAvailableCount,
            errorCount,
          },
          rows: parsedRows,
        },
        { status: 400 }
      );
    }

    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of parsedRows) {
        if (!row.matchedProductId) continue;

        const targetStatus = row.isPriceZero ? "PRICE_NOT_AVAILABLE" : "ACTIVE";

        const updateData: any = {
          price: row.price,
          priceUpdatedAt: new Date(),
          supplierId: supplier.id,
          status: targetStatus,
          warrantyPeriod: row.warrantyPeriod || null,
          priceValidity: row.priceValidity || null,
          leadTime: row.leadTime || null,
          isBrandNewOriginal: row.isBrandNewOriginal || null,
          supplierImage: row.supplierImage || null,
          supplierNote: row.supplierNote || null,
        };

        // If product is an Online Web product, tag it with an identifier note indicating it is a PMS updated price
        const targetMatched = allProducts.find((p) => p.id === row.matchedProductId);
        const isOnlineWeb = targetMatched?.source === "ONLINE_WEB" || Boolean(targetMatched?.externalId);
        if (isOnlineWeb) {
          const pmsTag = `[PMS Updated Price via ${supplier.name}]`;
          const existingNote = targetMatched?.additionalNote || "";
          if (!existingNote.includes("[PMS Updated Price")) {
            updateData.additionalNote = existingNote ? `${pmsTag} | ${existingNote}` : pmsTag;
          }
        }

        if (row.quantity !== undefined) {
          updateData.quantity = row.quantity;
        }
        if (row.weight !== undefined && row.weight !== null) {
          updateData.weight = row.weight;
        }

        if (row.currency === "USD") {
          updateData.priceUSD = row.priceUSD || row.price;
        } else {
          updateData.priceLKR = row.priceLKR || row.price;
        }

        const updated = await tx.product.update({
          where: { id: row.matchedProductId },
          data: updateData,
        });

        // Record Price History for tracking over time
        await tx.productPriceHistory.create({
          data: {
            productId: updated.id,
            priceLKR: row.priceLKR || (row.currency === "LKR" ? row.price : 0),
            priceUSD: row.priceUSD || (row.currency === "USD" ? row.price : null),
            supplierId: supplier.id,
            supplierName: supplier.name,
            warrantyPeriod: row.warrantyPeriod || null,
            leadTime: row.leadTime || null,
            note: row.supplierNote || null,
          },
        });

        // Audit History
        await tx.productHistory.create({
          data: {
            productId: updated.id,
            userId,
            action: "SUPPLIER_QUOTATION_UPDATED",
            newData: {
              supplierName: supplier.name,
              price: row.price,
              currency: row.currency,
              priceUSD: row.priceUSD,
              priceLKR: row.priceLKR,
              status: targetStatus,
              warranty: row.warrantyPeriod,
              leadTime: row.leadTime,
              note: row.supplierNote,
            },
          },
        });

        updatedCount++;
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} products from ${supplier.name}'s sheet.`,
      updatedCount,
      supplierName: supplier.name,
    });
  } catch (error) {
    console.error("Error processing supplier sheet:", error);
    return NextResponse.json(
      { error: "Failed to process supplier sheet. Please check file format." },
      { status: 500 }
    );
  }
}
