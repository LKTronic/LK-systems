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
 * Load image as base64 data URL for embedding into jsPDF
 * Supports both browser fetch and Node.js filesystem fallback
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  // Node.js environment fallback (tests, SSR)
  if (typeof window === "undefined") {
    try {
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
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
        const buffer = fs.readFileSync(fullPath);
        return `data:${mime};base64,${buffer.toString("base64")}`;
      }
    } catch {
      // ignore Node fallback errors
    }
  }

  // Browser environment
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
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
 * Helper to draw clean vector checkmark for Terms & Conditions
 */
function drawCheckmark(d: jsPDF, x: number, y: number): void {
  d.setDrawColor(20, 120, 60);
  d.setLineWidth(0.45);
  d.line(x, y - 1, x + 1.2, y + 0.8);
  d.line(x + 1.2, y + 0.8, x + 3.2, y - 2.2);
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
  doc.setFontSize(7.2);
  doc.setTextColor(215, 235, 238);
  doc.text("LK TRONICS,HIGH-LEVEL ROAD,HOMAGAMA,SRI LANKA.", 10, 27.6);
  doc.text(
    `TEL : 011 4 215 515 | REG NO - ${customRegNo}`,
    200,
    27.6,
    { align: "right" }
  );
}

/**
 * Format Product/Service cell content:
 * 1. Description
 * 2. Empty spacer line
 * 3. Stock status: "(instocks)" or "(Shipping from overseas - ...)"
 * 4. Warranty: ONLY if valid warranty is specified. If no warranty, omitted!
 */
export function formatProductServiceCell(
  description: string,
  stockStatus?: string | null,
  leadTime?: string | null,
  warranty?: string | null
): string {
  const rawLead = (leadTime || "12-21").trim();
  const formattedLead =
    rawLead.toLowerCase().includes("working") ||
    rawLead.toLowerCase().includes("day")
      ? rawLead
      : `${rawLead} working days`;

  const stockText =
    stockStatus === "OVERSEAS"
      ? `(Shipping from overseas - ${formattedLead})`
      : "(instocks)";

  const rawWarranty = (warranty || "").trim();
  const isNoWarranty =
    !rawWarranty ||
    rawWarranty.toLowerCase() === "no warranty" ||
    rawWarranty.toLowerCase() === "no-warranty" ||
    rawWarranty.toLowerCase() === "none" ||
    rawWarranty.toLowerCase() === "n/a" ||
    rawWarranty.toLowerCase() === "no";

  const warrantyText = isNoWarranty
    ? ""
    : rawWarranty.startsWith("(") && rawWarranty.endsWith(")")
    ? rawWarranty
    : `(${rawWarranty})`;

  const descParts = [description.trim(), "", stockText];
  if (warrantyText) {
    descParts.push(warrantyText);
  }
  return descParts.join("\n");
}

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
  // X = 109.3 mm, Y = 60.5 mm, Width = 93.7 mm, Height = 29.5 mm
  // Positioned cleanly below the circular logo & "Services" (which ends at 59mm)
  const boxX = 109.3;
  const boxY = 60.5;
  const boxW = 93.7;
  const boxH = 29.5;

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

  let curMetaY = boxY + 5.2;
  for (const r of metaRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(r.label, boxX + 3.5, curMetaY);
    doc.text(String(r.val), boxX + boxW - 3.5, curMetaY, { align: "right" });
    curMetaY += 5.1;
  }

  // Exact Word QUOTATION TO (Left):
  // X = 25.4 mm, Y = 82.2 mm
  const toX = 25.4;
  const toY = 82.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text("QUOTATION TO -", toX, toY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const toLines = doc.splitTextToSize(
    data.quotationTo || "Valued Customer",
    75
  );
  doc.text(toLines, toX, toY + 5.5);

  // Exact Word Items Table:
  // startY = 108 mm, Margin left 21mm, right 21mm (total width: 168mm)
  const tableStartY = Math.max(108, toY + 5.5 + toLines.length * 4.8 + 3);

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
  const tableFoot: any[] = [
    [
      {
        content: "",
        colSpan: 1,
        styles: { lineWidth: 0.35, fillColor: [255, 255, 255] },
      },
      {
        content: "Total Amount",
        colSpan: 4,
        styles: {
          halign: "center",
          fontStyle: "bold",
          fontSize: 9.5,
          textColor: [0, 0, 0],
          fillColor: [255, 255, 255],
        },
      },
      {
        content: formatRs(data.totalAmount),
        colSpan: 1,
        styles: {
          halign: "center",
          fontStyle: "bold",
          fontSize: 9.5,
          textColor: [0, 0, 0],
          fillColor: [255, 255, 255],
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
      fontSize: 8.5,
      cellPadding: 2.5,
      valign: "middle",
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 8.5,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 38, halign: "center" },
      2: { cellWidth: 45, halign: "left" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 29, halign: "center" },
    },
    willDrawPage: (hookData) => {
      // If table spans to additional pages, re-apply letterhead header & footer
      if (hookData.pageNumber > 1) {
        applyLetterhead(doc, selectedRegNo, bgBase64);
      }
    },
    didDrawCell: (hookData) => {
      // Draw thumbnail image inside column index 1 (Image)
      if (hookData.section === "body" && hookData.column.index === 1) {
        const rowIdx = hookData.row.index;
        const img = itemImagesBase64[rowIdx];
        if (img) {
          try {
            const cellW = hookData.cell.width;
            const cellH = hookData.cell.height;
            const imgSize = Math.min(cellW - 4, cellH - 4, 26);
            const x = hookData.cell.x + (cellW - imgSize) / 2;
            const y = hookData.cell.y + (cellH - imgSize) / 2;
            doc.addImage(
              img,
              "JPEG",
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
    },
  });

  // ================= PAGE 2: Terms and Conditions =================
  doc.addPage();
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Starts at Y = 70 mm to cleanly clear the circular logo banner (which ends at 59mm)
  let curY = 70;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("General Terms and Conditions for the Client", 21, curY);
  curY += 7.5;

  const generalBullets = [
    "Ownership of goods shall remain with LK TRONICS until full payment is settled.",
    "Orders once confirmed cannot be cancelled. In the event of cancellation, any advance paid will be non-refundable.",
    "The company shall not be held liable for delays or failures due to events beyond reasonable control, including natural disasters, riots, pandemics, or supply chain disruptions.",
    "This quotation and its pricing are confidential and intended solely for the client. Sharing or distributing it without consent is prohibited.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const b of generalBullets) {
    drawCheckmark(doc, 22, curY);
    const split = doc.splitTextToSize(b, 160);
    doc.text(split, 28, curY);
    curY += split.length * 4.2 + 2.5;
  }

  curY += 3;
  const sections = [
    {
      title: "Validity of Quotation",
      body: "This quotation is valid for a period of Three (03) days from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.",
    },
    {
      title: "Lead Time & Stock Status",
      body: "For products sourced from overseas, the standard delivery lead time ranges from 12–21 business working days, calculated from the date of advance payment or receipt of an official purchase order. Items currently in stock at our Homagama warehouse will be delivered within 2–5 business working days. The stock availability status for each product is clearly specified in the respective product description column of this quotation. (Availability of in-stock products may change without prior notice. Customers are advised to confirm the current stock status with our sales team before issuing a purchase order or making any advance payment.)",
    },
    {
      title: "Warranty Terms",
      body: "Warranty coverage shall be granted based on the manufacturer's or supplier's policy. Damages arising from misuse, mishandling, improper installation, modifications, or external environmental factors are not covered under any circumstances. Where applicable, the warranty period and conditions will be specified in the respective product table within this quotation.",
    },
    {
      title: "Delivery from Homagama Warehouse",
      body: "If delivery charges are not specified in the quotation table, the client shall be responsible for either arranging collection of the goods from our store or bearing the applicable delivery cost, should delivery be required.",
    },
  ];

  for (const sec of sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(sec.title, 21, curY);
    curY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const split = doc.splitTextToSize(sec.body, 168);
    doc.text(split, 21, curY);
    curY += split.length * 4.1 + 4.5;
  }

  // ================= PAGE 3: Payment, Bank Details & Signature =================
  doc.addPage();
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Starts at Y = 70 mm to cleanly clear the circular logo banner
  curY = 70;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Payment Terms", 21, curY);
  curY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const paySplit = doc.splitTextToSize(
    "Payment shall be effected based on the agreed payment method (Full Payment / 80% Advance Payment / Credit) selected by the client and confirmed at the time of order. No processing or delivery will commence until the agreed payment terms are fulfilled.",
    168
  );
  doc.text(paySplit, 21, curY);
  curY += paySplit.length * 4.1 + 8;

  // Bank Details Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Bank Details", 21, curY);
  curY += 5;

  const bankBoxX = 21;
  const bankBoxY = curY;
  const bankBoxW = 120;
  const bankBoxH = 26;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(bankBoxX, bankBoxY, bankBoxW, bankBoxH, "FD");

  const bankRows = [
    { label: "Account Name", val: "LK TRONICS TRADING PVT LTD" },
    { label: "Account Number", val: "047010021564" },
    { label: "Bank Name", val: "Hatton National Bank" },
    { label: "Bank Branch", val: "Biyagama" },
  ];

  let curBankY = bankBoxY + 5;
  for (const b of bankRows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(b.label, bankBoxX + 4, curBankY);
    doc.setFont("helvetica", "normal");
    doc.text(b.val, bankBoxX + 38, curBankY);
    curBankY += 5.5;
  }

  // Signature Block
  const sigY = bankBoxY + 45;
  const sigX = 145;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text("............................................", sigX, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Authorized by", sigX + 10, sigY + 5);

  // Closing appreciation note
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    "We sincerely appreciate the opportunity to submit this quotation and look forward to\nsupporting your requirements.",
    105,
    sigY + 24,
    { align: "center" }
  );

  // ================= PAGE 4: Brands We Do =================
  doc.addPage();
  applyLetterhead(doc, selectedRegNo, bgBase64);

  // Render brands sheet centered on page 4
  if (brandsBase64) {
    try {
      doc.addImage(
        brandsBase64,
        "PNG",
        18,
        48,
        174,
        230,
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
