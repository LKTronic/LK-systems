import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuotationPdfItem {
  itemIndex: number;
  description: string;
  imagePath?: string | null;
  stockStatus?: string | null; // "IN_STOCK" or "OVERSEAS"
  leadTime?: string | null;
  warranty?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface QuotationPdfData {
  quotationNo: string;
  preparedDate: string; // YYYY-MM-DD or YYYY/MM/DD
  expireDate: string; // YYYY-MM-DD or YYYY/MM/DD
  validityDays?: number | string | null;
  paymentMethod: string; // "FULL_PAYMENT" | "CREDIT" | "ADVANCE_PAYMENT"
  advancePercent?: number | null;
  preparedBy: string;
  quotationTo: string;
  subtotal: number;
  totalAmount: number;
  notes?: string | null;
  registrationNo?: string | null;
  items: QuotationPdfItem[];
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

/**
 * Convert number (1-999) to English words
 */
const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

export function numberToWords(num: number): string {
  const n = Math.abs(Math.round(num));
  if (n < 20) return ONES[n] || String(n);
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const remainder = n % 10;
    return remainder > 0 ? `${tens}-${ONES[remainder]}` : tens;
  }
  if (n < 1000) {
    const hundreds = ONES[Math.floor(n / 100)] + " Hundred";
    const remainder = n % 100;
    return remainder > 0 ? `${hundreds} ${numberToWords(remainder)}` : hundreds;
  }
  return String(n);
}

/**
 * Format validity period text matching template format:
 * e.g. 3 -> "Three (03) days"
 * e.g. 7 -> "Seven (07) days"
 * e.g. 1 -> "One (01) day"
 */
export function formatValidityPeriodText(days: number): string {
  const d = Math.max(1, Math.round(Number(days) || 3));
  const word = numberToWords(d);
  const padded = d < 10 ? `0${d}` : String(d);
  const unit = d === 1 ? "day" : "days";
  return `${word} (${padded}) ${unit}`;
}

/**
 * Calculate validity days from QuotationPdfData:
 * 1. Uses explicit data.validityDays if provided
 * 2. Or calculates from expireDate - preparedDate
 * 3. Fallback to 3 days (official template default)
 */
export function getValidityDays(data: QuotationPdfData): number {
  if (
    data.validityDays !== undefined &&
    data.validityDays !== null &&
    !isNaN(Number(data.validityDays)) &&
    Number(data.validityDays) > 0
  ) {
    return Math.round(Number(data.validityDays));
  }
  if (data.preparedDate && data.expireDate) {
    try {
      const p = new Date(data.preparedDate).getTime();
      const e = new Date(data.expireDate).getTime();
      const diff = Math.round((e - p) / (1000 * 60 * 60 * 24));
      if (diff > 0) return diff;
    } catch {
      // fallback
    }
  }
  return 3;
}

/**
 * Bank Details interface
 */
export interface BankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankBranch: string;
}

/**
 * Return bank details dynamically based on Registration Number:
 * - If WF19731 / W-F 19731:
 *     LK TRONICS / 1000525586 / Commercial Bank / Homagama
 * - If PV00336036 / P-V 00336036 (or default):
 *     LK TRONICS TRADING PVT LTD / 047010021564 / Hatton National Bank / Biyagama
 */
export function getBankDetails(registrationNo?: string | null): BankDetails {
  const clean = (registrationNo || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (clean.includes("WF19731") || clean.includes("19731")) {
    return {
      accountName: "LK TRONICS",
      accountNumber: "1000525586",
      bankName: "Commercial Bank",
      bankBranch: "Homagama",
    };
  }
  return {
    accountName: "LK TRONICS TRADING PVT LTD",
    accountNumber: "047010021564",
    bankName: "Hatton National Bank",
    bankBranch: "Biyagama",
  };
}

/**
 * Convert an image Blob to standard JPEG base64 data URL via canvas
 * Ensures any format (PNG with transparency, WebP, AVIF) is cleanly rasterized
 * with an opaque white background suitable for jsPDF.
 */
function convertBlobToJpegBase64(blob: Blob): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 200;
        canvas.height = img.naturalHeight || img.height || 200;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

/**
 * Load image as base64 data URL for embedding into jsPDF
 * Supports both browser fetch (with server proxy for external URLs to bypass CORS)
 * and Node.js filesystem fallback
 */
export async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  // Node.js environment fallback (tests, SSR)
  if (typeof window === "undefined") {
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = res.headers.get("content-type") || "image/jpeg";
        return `data:${mime};base64,${buffer.toString("base64")}`;
      }

      const nodeFs = "fs";
      const nodePath = "path";
      const fs = await import(/* webpackIgnore: true */ nodeFs);
      const path = await import(/* webpackIgnore: true */ nodePath);
      const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
      const fullPath = path.isAbsolute(url)
        ? url
        : path.join(process.cwd(), "public", cleanUrl);

      if (fs.existsSync(fullPath)) {
        const ext = path.extname(fullPath).toLowerCase().replace(".", "");
        const mime =
          ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : "image/png";
        const buffer = fs.readFileSync(fullPath);
        return `data:${mime};base64,${buffer.toString("base64")}`;
      }
    } catch {
      // ignore Node fallback errors
    }
    return null;
  }

  // Browser environment
  try {
    const isHttp = url.startsWith("http://") || url.startsWith("https://");
    let fetchUrl = url;

    // Route external URLs through /api/proxy-image to prevent CORS block
    if (isHttp) {
      try {
        const parsed = new URL(url);
        if (parsed.origin !== window.location.origin) {
          fetchUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        }
      } catch {
        fetchUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      }
    }

    let res = await fetch(fetchUrl);
    if (!res.ok && fetchUrl !== url) {
      // Fallback: try direct fetch
      try {
        res = await fetch(url);
      } catch {
        // continue
      }
    }

    if (!res.ok) return null;
    const blob = await res.blob();

    // Preserve PNG format with transparency (do NOT rasterize to opaque JPEG)
    if (blob.type === "image/png" || url.toLowerCase().includes(".png")) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }

    // Standardize via offscreen canvas for crisp JPEG on white background
    const canvasResult = await convertBlobToJpegBase64(blob);
    if (canvasResult) return canvasResult;

    // Fallback to FileReader
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Format currency to LKR format (e.g. "LKR 1,500.00")
 */
export function formatLKR(amount: number): string {
  return (
    "LKR " +
    (Number(amount) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Format currency to template format (e.g. "Rs 15,270.00")
 */
export function formatRs(amount: number): string {
  return (
    "Rs " +
    (Number(amount) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Clean and format payment method label
 */
export function formatPaymentMethodLabel(
  method: string,
  advancePercent?: number | null
): string {
  if (method === "ADVANCE_PAYMENT") {
    return `Advance Payment (${advancePercent ?? 0}%)`;
  }
  if (method === "CREDIT") {
    return "Credit Payment";
  }
  return "Full Payment";
}

/**
 * Helper to draw crisp vector checkmark for Terms & Conditions list
 * Perfectly aligned with 10pt text baseline
 */
function drawCheckmark(d: jsPDF, x: number, y: number): void {
  d.saveGraphicsState();
  d.setDrawColor(0, 0, 0);
  d.setLineWidth(0.55);
  d.setLineCap("round");
  d.setLineJoin("round");
  // Short tick down to baseline, long tick up to cap height
  d.line(x, y - 1.4, x + 1.2, y - 0.2);
  d.line(x + 1.2, y - 0.2, x + 3.4, y - 3.0);
  d.restoreGraphicsState();
}

/**
 * Return highlight flags for Lead Time & Stock Status on Page 2:
 * - If all products in quotation are IN_STOCK:
 *     highlight in-stock sentence ("Items currently in stock at our Homagama warehouse...")
 * - If all products in quotation are OVERSEAS:
 *     highlight overseas sentence ("sourced from overseas, the standard delivery lead time...")
 * - If BOTH exist in the quotation:
 *     highlight BOTH sentences
 */
export function getLeadTimeHighlightFlags(
  items: Array<{ stockStatus?: string | null }>
): {
  highlightOverseas: boolean;
  highlightInStock: boolean;
} {
  const hasOverseas = (items || []).some((it) => it.stockStatus === "OVERSEAS");
  const hasInStock = (items || []).some(
    (it) => !it.stockStatus || it.stockStatus === "IN_STOCK"
  );

  if (hasOverseas && hasInStock) {
    return { highlightOverseas: true, highlightInStock: true };
  }
  if (hasOverseas) {
    return { highlightOverseas: true, highlightInStock: false };
  }
  // Default to in-stock (as in the official Word template)
  return { highlightOverseas: false, highlightInStock: true };
}

/**
 * Helper to render a flowing paragraph with selective yellow background highlights on text segments.
 * Accurately flows across multiple lines at 10pt font size.
 */
function renderHighlightedParagraph(
  doc: jsPDF,
  segments: Array<{ text: string; highlight: boolean }>,
  startX: number,
  startY: number,
  maxWidth: number,
  lineH: number = 4.6
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const tokens: Array<{ word: string; highlight: boolean }> = [];
  for (const seg of segments) {
    const words = seg.text.split(" ");
    for (let i = 0; i < words.length; i++) {
      if (words[i].length > 0) {
        tokens.push({ word: words[i], highlight: seg.highlight });
      }
    }
  }

  const spaceW = doc.getTextWidth(" ");
  const lines: Array<Array<{ word: string; highlight: boolean }>> = [];
  let curLine: Array<{ word: string; highlight: boolean }> = [];
  let curLineW = 0;

  for (const token of tokens) {
    const wordW = doc.getTextWidth(token.word);
    const addedW = curLine.length === 0 ? wordW : spaceW + wordW;

    if (curLineW + addedW <= maxWidth) {
      curLine.push(token);
      curLineW += addedW;
    } else {
      lines.push(curLine);
      curLine = [token];
      curLineW = wordW;
    }
  }
  if (curLine.length > 0) {
    lines.push(curLine);
  }

  let curY = startY;
  for (const line of lines) {
    // Group adjacent words with identical highlight status
    const lineSegments: Array<{
      highlight: boolean;
      words: string[];
    }> = [];

    for (const item of line) {
      const last = lineSegments[lineSegments.length - 1];
      if (last && last.highlight === item.highlight) {
        last.words.push(item.word);
      } else {
        lineSegments.push({
          highlight: item.highlight,
          words: [item.word],
        });
      }
    }

    let curX = startX;
    for (const seg of lineSegments) {
      const text = seg.words.join(" ");
      const segW = doc.getTextWidth(text);

      if (seg.highlight) {
        doc.setFillColor(255, 255, 0); // Bright yellow highlight (#FFFF00)
        doc.rect(curX - 0.4, curY - 3.1, segW + 0.8, 4.0, "F");
      }

      doc.setTextColor(0, 0, 0);
      doc.text(text, curX, curY);
      curX += segW + spaceW;
    }
    curY += lineH;
  }

  return curY;
}

/**
 * Helper to apply branded letterhead background and dynamic top bar to any page
 */
function applyLetterhead(
  doc: jsPDF,
  customRegNo: string,
  bgBase64: string | null
): void {
  // 1. Draw full A4 page letterhead background (circuit board graphics + logo + footer)
  if (bgBase64) {
    try {
      doc.addImage(bgBase64, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    } catch {
      // Fallback if background fails
    }
  }

  // 2. Draw dynamic top teal bar with user-selected Registration Number
  doc.setFillColor(74, 144, 152); // exact template teal
  doc.rect(0, 23.3, 210, 6.8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(215, 235, 238);
  doc.text("LK TRONICS,HIGH-LEVEL ROAD,HOMAGAMA,SRI LANKA.", 10, 27.8);
  doc.text(
    `TEL : 011 4 215 515 | REG NO - ${customRegNo}`,
    200,
    27.8,
    { align: "right" }
  );
}

/**
 * Return highlight lines (stock status & warranty) matching template formatting:
 * - OVERSEAS:
 *     "(Shipping from Overseas)"
 *     "(Lead time 12-21 working days)"
 * - IN_STOCK:
 *     "(instocks)"
 * - Warranty (if valid):
 *     "(${warranty})"
 */
export function getProductHighlightLines(
  stockStatus?: string | null,
  leadTime?: string | null,
  warranty?: string | null
): string[] {
  const rawLead = (leadTime || "12-21").trim();
  const formattedLead =
    rawLead.toLowerCase().includes("working") ||
    rawLead.toLowerCase().includes("day")
      ? rawLead
      : `${rawLead} working days`;

  const lines: string[] = [];
  if (stockStatus === "OVERSEAS") {
    lines.push("(Shipping from Overseas)");
    lines.push(`(Lead time ${formattedLead})`);
  } else {
    lines.push("(instocks)");
  }

  const rawWarranty = (warranty || "").trim();
  const isNoWarranty =
    !rawWarranty ||
    rawWarranty.toLowerCase() === "no warranty" ||
    rawWarranty.toLowerCase() === "no-warranty" ||
    rawWarranty.toLowerCase() === "none" ||
    rawWarranty.toLowerCase() === "n/a" ||
    rawWarranty.toLowerCase() === "no";

  if (!isNoWarranty) {
    const warrantyText =
      rawWarranty.startsWith("(") && rawWarranty.endsWith(")")
        ? rawWarranty
        : `(${rawWarranty})`;
    lines.push(warrantyText);
  }

  return lines;
}

/**
 * Format Product/Service cell content:
 * 1. Description
 * 2. Empty spacer line
 * 3. Stock status & lead time
 * 4. Warranty: ONLY if valid warranty is specified. If no warranty, omitted!
 */
export function formatProductServiceCell(
  description: string,
  stockStatus?: string | null,
  leadTime?: string | null,
  warranty?: string | null
): string {
  const hl = getProductHighlightLines(stockStatus, leadTime, warranty);
  return [description.trim(), "", ...hl].join("\n");
}

/**
 * Default General Terms and Conditions bullets for quotation PDF
 */
export const DEFAULT_GENERAL_TERMS_BULLETS = [
  "Ownership of goods shall remain with LK TRONICS until full payment is settled.",
  "For imported products, the goods will be released from our warehouse only after the full payment has been completed, including the remaining balance after the advance payment.",
  "Orders once confirmed cannot be cancelled. In the event of cancellation, any advance paid will be non-refundable.",
  "The company shall not be held liable for delays or failures due to events beyond reasonable control, including natural disasters, riots, pandemics, or supply chain disruptions.",
  "This quotation and its pricing are confidential and intended solely for the client. Sharing or distributing it without consent is prohibited.",
];

/**
 * Generate and download Quotation PDF matching official 4-page Word template (20261015QJ01.docx)
 */
export async function generateQuotationPdf(
  data: QuotationPdfData
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const selectedRegNo = (data.registrationNo || "P-V 00336036").trim();

  // Pre-load template assets
  const [bgBase64, brandsBase64] = await Promise.all([
    loadImageAsBase64("/template_assets/letterhead_bg.jpg"),
    loadImageAsBase64("/template_assets/brands_sheet.png"),
  ]);

  // Pre-load row thumbnail images
  const itemImagesBase64: { [idx: number]: string | null } = {};
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (item.imagePath) {
      itemImagesBase64[i] = await loadImageAsBase64(item.imagePath);
    }
  }

  // ================= PAGE 1 =================
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Exact Word Metadata Box (Right):
  // X = 109.3 mm, Y = 60.5 mm, Width = 93.7 mm, Height = 34 mm
  // Positioned cleanly below the circular logo & "Services" (which ends at 59mm)
  const boxX = 109.3;
  const boxY = 60.5;
  const boxW = 93.7;
  const boxH = 34;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(boxX, boxY, boxW, boxH, "FD");

  const formattedPrepDate = (data.preparedDate || "").replace(/-/g, "/");
  const formattedExpDate = (data.expireDate || "").replace(/-/g, "/");

  const metaRows = [
    { label: "Quotation No:", val: data.quotationNo },
    { label: "Quotation Prepared Date:", val: formattedPrepDate },
    { label: "Quotation Expire Date:", val: formattedExpDate },
    {
      label: "Payment Method:",
      val: formatPaymentMethodLabel(data.paymentMethod, data.advancePercent),
    },
    { label: "Prepared by:", val: data.preparedBy || "Staff" },
  ];

  let curMetaY = boxY + 5.8;
  for (const r of metaRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(r.label, boxX + 3.5, curMetaY);
    doc.text(String(r.val), boxX + boxW - 3.5, curMetaY, { align: "right" });
    curMetaY += 5.8;
  }

  // Exact Word QUOTATION TO (Left):
  // X = 25.4 mm, Y = 82.2 mm
  const toX = 25.4;
  const toY = 82.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("QUOTATION TO -", toX, toY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const toLines = doc.splitTextToSize(
    data.quotationTo || "Valued Customer",
    75
  );
  doc.text(toLines, toX, toY + 5.5);

  // Exact Word Items Table:
  // startY = 108 mm, Margin left 21mm, right 21mm (total width: 168mm)
  const tableStartY = Math.max(108, toY + 5.5 + toLines.length * 5.2 + 3);

  const tableData = data.items.map((item, idx) => {
    const productCellText = formatProductServiceCell(
      item.description,
      item.stockStatus,
      item.leadTime,
      item.warranty
    );

    return [
      String(idx + 1),
      "", // image cell (rendered in didDrawCell)
      productCellText,
      String(item.quantity),
      formatRs(item.unitPrice),
      formatRs(item.totalPrice),
    ];
  });

  // Footer row: Exact Word template has ONLY Total Amount in the table
  // Keep row height small to match only the total price content
  const tableFoot: any[] = [
    [
      {
        content: "",
        colSpan: 1,
        styles: {
          lineWidth: 0.35,
          fillColor: [255, 255, 255],
          minCellHeight: 9.5,
          cellPadding: 2,
        },
      },
      {
        content: "Total Amount",
        colSpan: 4,
        styles: {
          halign: "center",
          fontStyle: "bold",
          fontSize: 10,
          textColor: [0, 0, 0],
          fillColor: [255, 255, 255],
          minCellHeight: 9.5,
          cellPadding: 2,
        },
      },
      {
        content: formatRs(data.totalAmount),
        colSpan: 1,
        styles: {
          halign: "center",
          fontStyle: "bold",
          fontSize: 10,
          textColor: [0, 0, 0],
          fillColor: [255, 255, 255],
          minCellHeight: 9.5,
          cellPadding: 2,
        },
      },
    ],
  ];

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 21, right: 21 },
    head: [
      [
        { content: "No.", styles: { halign: "center" } },
        { content: "Image", styles: { halign: "center" } },
        { content: "Product/Service", styles: { halign: "center" } },
        { content: "Quantity", styles: { halign: "center" } },
        { content: "Unit Price", styles: { halign: "center" } },
        { content: "Total Price", styles: { halign: "center" } },
      ],
    ],
    body: tableData,
    foot: tableFoot,
    theme: "plain",
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.35,
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.35,
      textColor: [0, 0, 0],
      fontSize: 10,
      cellPadding: 4,
      minCellHeight: 35, // Increased row height for product body rows
      valign: "middle",
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 10,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      minCellHeight: 11,
      cellPadding: 3,
      valign: "middle",
    },
    footStyles: {
      minCellHeight: 9.5,
      cellPadding: 2,
      valign: "middle",
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", valign: "middle" },
      1: {
        cellWidth: 34,
        halign: "center",
        valign: "middle",
        minCellHeight: 35,
      },
      2: { cellWidth: 51, halign: "left", valign: "middle", minCellHeight: 35 },
      3: { cellWidth: 15, halign: "center", valign: "middle" },
      4: { cellWidth: 28, halign: "center", valign: "middle" },
      5: { cellWidth: 28, halign: "center", valign: "middle" },
    },
    willDrawPage: (hookData) => {
      // If table spans to additional pages, re-apply letterhead header & footer
      if (hookData.pageNumber > 1) {
        applyLetterhead(doc, selectedRegNo, bgBase64);
      }
    },
    willDrawCell: (hookData) => {
      // Suppress default autoTable text rendering for column 2 (Product/Service)
      // so we can render description + yellow-highlighted italic stock & warranty in didDrawCell
      if (hookData.section === "body" && hookData.column.index === 2) {
        hookData.cell.text = [];
      }
    },
    didDrawCell: (hookData) => {
      // 1. Draw thumbnail image inside column index 1 (Image)
      if (hookData.section === "body" && hookData.column.index === 1) {
        const rowIdx = hookData.row.index;
        const img = itemImagesBase64[rowIdx];
        if (img) {
          try {
            const cellW = hookData.cell.width;
            const cellH = hookData.cell.height;
            const imgSize = Math.min(cellW - 6, cellH - 6, 28);
            const x = hookData.cell.x + (cellW - imgSize) / 2;
            const y = hookData.cell.y + (cellH - imgSize) / 2;
            const format = img.startsWith("data:image/png") ? "PNG" : "JPEG";
            doc.addImage(
              img,
              format,
              x,
              y,
              imgSize,
              imgSize,
              undefined,
              "FAST"
            );
          } catch {
            // Ignore individual image render failures
          }
        }
      }

      // 2. Custom render column index 2 (Product/Service) with yellow highlighted stock & warranty
      if (hookData.section === "body" && hookData.column.index === 2) {
        const rowIdx = hookData.row.index;
        const item = data.items[rowIdx];
        if (!item) return;

        const cell = hookData.cell;
        const padX = 4;
        const maxTextW = cell.width - padX * 2;

        // Split description lines
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const descLines = doc.splitTextToSize(item.description.trim(), maxTextW);

        // Highlight lines (stock status & warranty) using smaller 8pt font
        const hlLines = getProductHighlightLines(
          item.stockStatus,
          item.leadTime,
          item.warranty
        );

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        const wrappedHlLines: string[] = [];
        for (const hl of hlLines) {
          const split = doc.splitTextToSize(hl, maxTextW);
          wrappedHlLines.push(...split);
        }

        const lineH = 4.4;
        const hlLineH = 3.8;
        const spacerH = 2.0;
        const totalContentH =
          descLines.length * lineH + spacerH + wrappedHlLines.length * hlLineH;

        let curY =
          cell.y +
          Math.max(3, (cell.height - totalContentH) / 2) +
          3.0;

        // Draw description lines (normal, 10pt)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        for (const line of descLines) {
          if (line.trim().length > 0) {
            doc.text(line, cell.x + padX, curY);
          }
          curY += lineH;
        }

        curY += spacerH;

        // Draw yellow highlighted stock & warranty lines (italic, 8pt, #FFFF00 highlight)
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        for (const hLine of wrappedHlLines) {
          const strW = doc.getTextWidth(hLine);
          const padHL = 0.8;
          const rectW = Math.min(strW + padHL * 2, maxTextW);
          const rectH = 3.6;

          // Bright yellow highlight box behind text
          doc.setFillColor(255, 255, 0);
          doc.rect(cell.x + padX, curY - 2.8, rectW, rectH, "F");

          // Text over highlight
          doc.setTextColor(0, 0, 0);
          doc.text(hLine, cell.x + padX + padHL, curY);

          curY += 4.0;
        }
      }
    },
  });

  // ================= PAGE 2: Terms and Conditions =================
  doc.addPage();
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Starts at Y = 70 mm to cleanly clear the circular logo banner (which ends at 59mm)
  let curY = 70;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("General Terms and Conditions for the Client", 21, curY);
  curY += 8;

  const generalBullets = DEFAULT_GENERAL_TERMS_BULLETS;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const b of generalBullets) {
    drawCheckmark(doc, 22, curY);
    const split = doc.splitTextToSize(b, 161);
    doc.text(split, 27.5, curY);
    curY += split.length * 4.8 + 2.5;
  }

  curY += 3;
  const { highlightOverseas, highlightInStock } = getLeadTimeHighlightFlags(
    data.items
  );

  const validityDays = getValidityDays(data);
  const validityText = formatValidityPeriodText(validityDays);

  const sections = [
    {
      title: "Validity of Quotation",
      type: "plain" as const,
      body: `This quotation is valid for a period of ${validityText} from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`,
    },
    {
      title: "Lead Time & Stock Status",
      type: "lead_time" as const,
      segments: [
        { text: "For products", highlight: false },
        {
          text: "sourced from overseas, the standard delivery lead time ranges from 12–21 business working days,",
          highlight: highlightOverseas,
        },
        {
          text: "calculated from the date of advance payment or receipt of an official purchase order.",
          highlight: false,
        },
        {
          text: "Items currently in stock at our Homagama warehouse will be delivered within 2–5 business working days.",
          highlight: highlightInStock,
        },
        {
          text: "The stock availability status for each product is clearly specified in the respective product description column of this quotation. (Availability of in-stock products may change without prior notice. Customers are advised to confirm the current stock status with our sales team before issuing a purchase order or making any advance payment.)",
          highlight: false,
        },
      ],
    },
    {
      title: "Warranty Terms",
      type: "plain" as const,
      body: "Warranty coverage shall be granted based on the manufacturer's or supplier's policy. Damages arising from misuse, mishandling, improper installation, modifications, or external environmental factors are not covered under any circumstances. Where applicable, the warranty period and conditions will be specified in the respective product table within this quotation.",
    },
    {
      title: "Delivery from Homagama Warehouse",
      type: "plain" as const,
      body: "If delivery charges are not specified in the quotation table, the client shall be responsible for either arranging collection of the goods from our store or bearing the applicable delivery cost, should delivery be required.",
    },
  ];

  for (const sec of sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(sec.title, 21, curY);
    curY += 5;

    if (sec.type === "lead_time" && sec.segments) {
      curY = renderHighlightedParagraph(doc, sec.segments, 21, curY, 168, 4.6);
      curY += 4.5;
    } else if (sec.body) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const split = doc.splitTextToSize(sec.body, 168);
      doc.text(split, 21, curY);
      curY += split.length * 4.6 + 4.5;
    }
  }

  // ================= PAGE 3: Payment, Bank Details & Signature =================
  doc.addPage();
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Starts at Y = 70 mm to cleanly clear the circular logo banner
  curY = 70;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Payment Terms", 21, curY);
  curY += 5;

  const advancePct =
    data.advancePercent !== undefined &&
    data.advancePercent !== null &&
    Number(data.advancePercent) > 0
      ? Number(data.advancePercent)
      : 80;
  const advanceLabel = `${advancePct}% Advance Payment`;

  const isFull = data.paymentMethod === "FULL_PAYMENT";
  const isAdvance = data.paymentMethod === "ADVANCE_PAYMENT";
  const isCredit = data.paymentMethod === "CREDIT";

  const paymentSegments = [
    {
      text: "Payment shall be effected based on the agreed payment method (",
      highlight: false,
    },
    {
      text: "Full Payment",
      highlight: isFull,
    },
    {
      text: " / ",
      highlight: false,
    },
    {
      text: advanceLabel,
      highlight: isAdvance,
    },
    {
      text: " / ",
      highlight: false,
    },
    {
      text: "Credit",
      highlight: isCredit,
    },
    {
      text: ") selected by the client and confirmed at the time of order. No processing or delivery will commence until the agreed payment terms are fulfilled.",
      highlight: false,
    },
  ];

  curY = renderHighlightedParagraph(doc, paymentSegments, 21, curY, 168, 4.6);
  curY += 8;

  // Bank Details Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bank Details", 21, curY);
  curY += 5;

  const bankBoxX = 21;
  const bankBoxY = curY;
  const bankBoxW = 135;
  const bankBoxH = 30;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(bankBoxX, bankBoxY, bankBoxW, bankBoxH, "FD");

  const bankInfo = getBankDetails(selectedRegNo);
  const bankRows = [
    { label: "Account Name", val: bankInfo.accountName },
    { label: "Account Number", val: bankInfo.accountNumber },
    { label: "Bank Name", val: bankInfo.bankName },
    { label: "Bank Branch", val: bankInfo.bankBranch },
  ];

  let curBankY = bankBoxY + 5.5;
  for (const b of bankRows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(b.label, bankBoxX + 4, curBankY);
    doc.setFont("helvetica", "normal");
    doc.text(b.val, bankBoxX + 45, curBankY);
    curBankY += 6.2;
  }

  // Signature Block
  const sigY = bankBoxY + 50;
  const sigX = 145;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("............................................", sigX, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Authorized by", sigX + 10, sigY + 5.5);

  // Closing appreciation note
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    "We sincerely appreciate the opportunity to submit this quotation and look forward to\nsupporting your requirements.",
    105,
    sigY + 25,
    { align: "center" }
  );

  // ================= PAGE 4: Brands We Do =================
  doc.addPage();
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Render brands sheet centered on page 4
  // In Word docx: cx = 155.18 mm, cy = 219.50 mm, positioned below top header
  // Keep x centered on A4: (210 - 155) / 2 = 27.5 mm, y = 50 mm
  if (brandsBase64) {
    try {
      doc.addImage(
        brandsBase64,
        "PNG",
        27.5,
        50,
        155,
        219,
        undefined,
        "FAST"
      );
    } catch {
      // Ignore if brand sheet rendering fails
    }
  }

  // Save / Trigger Download
  const cleanFileName = (data.quotationNo || "Quotation").replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
  doc.save(`${cleanFileName}.pdf`);
}
