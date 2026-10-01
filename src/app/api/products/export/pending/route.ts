import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

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

const MAX_IMAGE_CACHE_ENTRIES = 100;
const imageCache = new Map<string, { buffer: Buffer; extension: "png" | "jpeg" | "gif" } | null>();

function setBoundedImageCache(key: string, value: { buffer: Buffer; extension: "png" | "jpeg" | "gif" } | null) {
  if (imageCache.size >= MAX_IMAGE_CACHE_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey) {
      imageCache.delete(oldestKey);
    }
  }
  imageCache.set(key, value);
}

async function getImageBuffer(
  imagePath?: string | null
): Promise<{ buffer: Buffer; extension: "png" | "jpeg" | "gif" } | null> {
  try {
    if (!imagePath || typeof imagePath !== "string") return null;

    let targetPath = imagePath.trim();
    if (!targetPath) return null;

    if (targetPath.startsWith("//")) {
      targetPath = `https:${targetPath}`;
    }

    if (imageCache.has(targetPath)) {
      return imageCache.get(targetPath) || null;
    }

    // Remote HTTP / HTTPS image (e.g. Online Web / WooCommerce store products)
    if (targetPath.startsWith("http://") || targetPath.startsWith("https://")) {
      try {
        const parsedUrl = new URL(targetPath);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          setBoundedImageCache(targetPath, null);
          return null;
        }

        // SSRF protection: reject internal / loopback / private IP addresses & hostnames
        const hostname = parsedUrl.hostname.toLowerCase();
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "::1" ||
          hostname.endsWith(".local") ||
          hostname.endsWith(".internal") ||
          hostname.startsWith("10.") ||
          hostname.startsWith("192.168.") ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
          hostname.startsWith("169.254.") ||
          hostname === "0.0.0.0"
        ) {
          setBoundedImageCache(targetPath, null);
          return null;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(targetPath, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          setBoundedImageCache(targetPath, null);
          return null;
        }

        const contentType = response.headers.get("content-type")?.toLowerCase() || "";
        const pathname = parsedUrl.pathname.toLowerCase();
        let ext: "png" | "jpeg" | "gif" = "jpeg";

        if (contentType.includes("image/png") || pathname.endsWith(".png")) {
          ext = "png";
        } else if (
          contentType.includes("image/jpeg") ||
          contentType.includes("image/jpg") ||
          pathname.endsWith(".jpg") ||
          pathname.endsWith(".jpeg")
        ) {
          ext = "jpeg";
        } else if (contentType.includes("image/gif") || pathname.endsWith(".gif")) {
          ext = "gif";
        } else if (contentType.includes("image/webp") || pathname.endsWith(".webp")) {
          // ExcelJS accepts webp buffer with png/jpeg container
          ext = "png";
        } else if (contentType.startsWith("image/")) {
          ext = "png";
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 15 * 1024 * 1024) {
          setBoundedImageCache(targetPath, null);
          return null;
        }

        const result = { buffer: Buffer.from(arrayBuffer), extension: ext };
        setBoundedImageCache(targetPath, result);
        return result;
      } catch (remoteErr) {
        console.error("Failed to fetch remote image for Excel export:", targetPath, remoteErr);
        setBoundedImageCache(targetPath, null);
        return null;
      }
    }

    // Local file path (Path traversal protection)
    const publicDir = path.resolve(process.cwd(), "public");
    const normalized = path.normalize(targetPath.startsWith("/") ? targetPath.slice(1) : targetPath);
    const fullPath = path.resolve(publicDir, normalized);

    // Verify canonical path does not escape public directory
    if (!fullPath.startsWith(publicDir)) {
      setBoundedImageCache(targetPath, null);
      return null;
    }

    if (fs.existsSync(fullPath)) {
      const extLower = fullPath.toLowerCase();
      let ext: "png" | "jpeg" | "gif" = "jpeg";
      if (extLower.endsWith(".png")) ext = "png";
      else if (extLower.endsWith(".gif")) ext = "gif";
      else ext = "jpeg";

      const buffer = fs.readFileSync(fullPath);
      const result = { buffer, extension: ext };
      setBoundedImageCache(targetPath, result);
      return result;
    }
  } catch (err) {
    console.error("Error loading image for Excel export:", err);
  }
  return null;
}

async function buildWorkbook(pendingProducts: any[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Product Management System (PMS)";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Pending Requests", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  // Set explicit column widths (Col A to Col L: 12 columns total without Quantity)
  worksheet.columns = [
    { key: "productName", width: 28 },        // A: Product name
    { key: "description", width: 36 },        // B: Description
    { key: "quantity", width: 14 },           // C: Quantity
    { key: "image", width: 18 },              // D: Image
    { key: "referenceLink", width: 34 },      // E: Refrence link if available
    { key: "weight", width: 14 },             // F: Weight
    { key: "priceUSD", width: 24 },           // G: Price in USD without shipping chargers
    { key: "warrantyPeriod", width: 18 },     // H: Warranty Period
    { key: "priceValidity", width: 26 },      // I: Price validity(minimum 30 days expected)
    { key: "leadTime", width: 22 },           // J: Package preparation lead time
    { key: "isBrandNewOriginal", width: 20 }, // K: Brand new & original (Yes/No)?
    { key: "supplierImage", width: 20 },      // L: Supplier image
    { key: "supplierNote", width: 32 },       // M: Supplier special note
  ];

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FF000000" } },
    bottom: { style: "thin" as const, color: { argb: "FF000000" } },
    left: { style: "thin" as const, color: { argb: "FF000000" } },
    right: { style: "thin" as const, color: { argb: "FF000000" } },
  };

  // Top banner styling - Row 1 empty spacing
  worksheet.getRow(1).height = 10;

  // Row 2: "Shipping costs are not required to be included, as we have our own freight forwarders in China."
  worksheet.mergeCells("A2:M2");
  const row2Cell = worksheet.getCell("A2");
  row2Cell.value =
    "Shipping costs are not required to be included, as we have our own freight forwarders in China.";
  row2Cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF000000" } };
  row2Cell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 24;

  // Row 3: "Kindly ensure that all details are confirmed"
  worksheet.mergeCells("A3:M3");
  const row3Cell = worksheet.getCell("A3");
  row3Cell.value = "Kindly ensure that all details are confirmed";
  row3Cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF000000" } };
  row3Cell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(3).height = 22;

  // Row 4: Spacing
  worksheet.getRow(4).height = 8;

  // Row 5: Column Headers
  const headerRow = worksheet.getRow(5);
  headerRow.height = 48;

  const headerDefinitions = [
    { col: 1, value: "Product name" },
    { col: 2, value: "Description" },
    { col: 3, value: "Quantity" },
    { col: 4, value: "Image" },
    { col: 5, value: "Refrence link if available" },
    { col: 6, value: "Weight" },
    {
      col: 7,
      value: {
        richText: [
          {
            text: "Price in USD\n",
            font: { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF000000" } },
          },
          {
            text: "without shipping chargers",
            font: { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFF0000" } },
          },
        ],
      },
      isYellow: true,
    },
    { col: 8, value: "Warranty Period" },
    {
      col: 9,
      value: {
        richText: [
          {
            text: "Price validity\n",
            font: { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF000000" } },
          },
          {
            text: "(minimum 30 days expected)",
            font: { name: "Segoe UI", size: 8.5, bold: true, color: { argb: "FFFF0000" } },
          },
        ],
      },
    },
    { col: 10, value: "Package preparation lead time" },
    { col: 11, value: "Brand new & original (Yes/No)?" },
    { col: 12, value: "Supplier image" },
    { col: 13, value: "Supplier special note" },
  ];

  headerDefinitions.forEach((h) => {
    const cell = headerRow.getCell(h.col);
    cell.value = h.value as any;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
    if (h.isYellow) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" }, // Bright Yellow
      };
    } else {
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF000000" } };
    }
  });

  // Pre-load all image buffers in parallel
  const imageBuffers = await Promise.all(
    pendingProducts.map((p) => (p.imagePath ? getImageBuffer(p.imagePath) : Promise.resolve(null)))
  );

  // Populate Product Data Rows (Starting from row 6)
  for (let idx = 0; idx < pendingProducts.length; idx++) {
    const p = pendingProducts[idx];
    const currentRowNumber = 6 + idx;
    const row = worksheet.getRow(currentRowNumber);
    row.height = 75; // Tall row to accommodate image thumbnail

    // Col A (1): Product name
    const cellA = row.getCell(1);
    cellA.value = escapeFormulaForExport(p.modelAndName || p.productName || p.sku || "");
    cellA.font = { name: "Segoe UI", size: 11, bold: true };
    cellA.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Col B (2): Description (Populate from description, additionalNote, or fallback to product model/name)
    const cellB = row.getCell(2);
    const descContent = p.description || p.additionalNote || p.modelAndName || p.productName || "";
    cellB.value = descContent ? escapeFormulaForExport(descContent) : "";
    cellB.font = { name: "Segoe UI", size: 9.5 };
    cellB.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Col C (3): Quantity (Actual product quantity from DB)
    const cellC = row.getCell(3);
    const qtyVal = p.quantity != null && Number(p.quantity) > 0 ? Number(p.quantity) : 1;
    cellC.value = qtyVal;
    cellC.font = { name: "Segoe UI", size: 10, bold: true };
    cellC.alignment = { vertical: "middle", horizontal: "center" };

    // Col D (4): Image (Embedded)
    const cellD = row.getCell(4);
    cellD.alignment = { vertical: "middle", horizontal: "center" };
    const imgData = imageBuffers[idx];
    if (imgData) {
      const imageId = workbook.addImage({
        buffer: imgData.buffer as any,
        extension: imgData.extension,
      });

      worksheet.addImage(imageId, {
        tl: { col: 3.15, row: currentRowNumber - 1 + 0.08 }, // 0-indexed column 3 (D)
        ext: { width: 68, height: 68 },
        editAs: "oneCell",
      });
    }

    // Col E (5): Reference link if available (Clickable link)
    const cellE = row.getCell(5);
    if (p.referenceLink && p.referenceLink.trim()) {
      const linkUrl = p.referenceLink.trim();
      cellE.value = {
        text: linkUrl,
        hyperlink: linkUrl,
      };
      cellE.font = { name: "Segoe UI", size: 9, color: { argb: "FF0000EE" }, underline: true };
    } else {
      cellE.value = "";
    }
    cellE.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Col F (6): Weight (Supports up to 4 decimal places, e.g. 0.0001)
    const cellF = row.getCell(6);
    if (p.weight != null) {
      const numWeight = Number(p.weight);
      cellF.value = numWeight;
      cellF.numFmt = "0.####";
    } else {
      cellF.value = "";
    }
    cellF.font = { name: "Segoe UI", size: 10 };
    cellF.alignment = { vertical: "middle", horizontal: "center" };

    // Col G (7): Price in USD without shipping chargers (Yellow background - Blank for fresh quote)
    const cellG = row.getCell(7);
    cellG.value = "";
    cellG.numFmt = '"$"#,##0.00';
    cellG.font = { name: "Segoe UI", size: 10, bold: true };
    cellG.alignment = { vertical: "middle", horizontal: "right" };
    cellG.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" }, // Bright Yellow
    };

    // Col H (8): Warranty Period (Blank)
    const cellH = row.getCell(8);
    cellH.value = "";
    cellH.font = { name: "Segoe UI", size: 9.5 };
    cellH.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Col I (9): Price validity(minimum 30 days expected) (Blank)
    const cellI = row.getCell(9);
    cellI.value = "";
    cellI.font = { name: "Segoe UI", size: 9.5 };
    cellI.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Col J (10): Package preparation lead time (Blank)
    const cellJ = row.getCell(10);
    cellJ.value = "";
    cellJ.font = { name: "Segoe UI", size: 9.5 };
    cellJ.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Col K (11): Brand new & original (Yes/No)? (Blank)
    const cellK = row.getCell(11);
    cellK.value = "";
    cellK.font = { name: "Segoe UI", size: 9.5 };
    cellK.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Col L (12): Supplier image (Blank)
    const cellL = row.getCell(12);
    cellL.value = "";
    cellL.font = { name: "Segoe UI", size: 9.5 };
    cellL.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Col M (13): Supplier special note (Blank)
    const cellM = row.getCell(13);
    cellM.value = "";
    cellM.font = { name: "Segoe UI", size: 9.5 };
    cellM.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Set borders for all 13 cells
    for (let c = 1; c <= 13; c++) {
      row.getCell(c).border = thinBorder;
    }
  }

  return await workbook.xlsx.writeBuffer();
}

function buildWhereClause(params: {
  productIds?: number[];
  supplierId?: string | null;
  createdBy?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}) {
  const where: any = {
    status: "PENDING",
  };

  if (params.productIds && params.productIds.length > 0) {
    where.id = { in: params.productIds };
  }

  if (params.supplierId === "NONE" || params.supplierId === "UNASSIGNED") {
    where.supplierId = null;
  } else if (params.supplierId && params.supplierId !== "ALL") {
    const sId = parseInt(params.supplierId, 10);
    if (!isNaN(sId)) {
      where.supplierId = sId;
    }
  }

  if (params.createdBy && params.createdBy !== "ALL") {
    const uId = parseInt(params.createdBy, 10);
    if (!isNaN(uId)) {
      where.createdBy = uId;
    }
  }

  if (params.fromDate || params.toDate) {
    where.productDate = {};
    if (params.fromDate) {
      where.productDate.gte = new Date(params.fromDate);
    }
    if (params.toDate) {
      const end = new Date(params.toDate);
      end.setHours(23, 59, 59, 999);
      where.productDate.lte = end;
    }
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const supplierId = searchParams.get("supplierId");
    const createdBy = searchParams.get("createdBy") || searchParams.get("addedBy");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    let productIds: number[] | undefined;
    if (idsParam) {
      productIds = idsParam
        .split(",")
        .map((x) => parseInt(x.trim(), 10))
        .filter((x) => !isNaN(x));
    }

    const where = buildWhereClause({ productIds, supplierId, createdBy, fromDate, toDate });

    const pendingProducts = await prisma.product.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        author: {
          select: {
            name: true,
            username: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
      },
    });

    const buffer = await buildWorkbook(pendingProducts);
    const filename = `PMS_Pending_Requests_USD_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error exporting pending requests:", error);
    return NextResponse.json(
      { error: "Failed to export pending requests." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const productIds: number[] | undefined = Array.isArray(body.productIds)
      ? body.productIds.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))
      : undefined;

    const where = buildWhereClause({
      productIds,
      supplierId: body.supplierId,
      createdBy: body.createdBy || body.addedBy,
      fromDate: body.fromDate,
      toDate: body.toDate,
    });

    const pendingProducts = await prisma.product.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        author: {
          select: {
            name: true,
            username: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
      },
    });

    const buffer = await buildWorkbook(pendingProducts);
    const filename = `PMS_Selected_Pending_USD_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error exporting selected pending requests:", error);
    return NextResponse.json(
      { error: "Failed to export selected pending requests." },
      { status: 500 }
    );
  }
}
