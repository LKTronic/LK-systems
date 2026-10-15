import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuotationPdfItem {
  itemIndex: number;
  description: string;
  imagePath?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface QuotationPdfData {
  quotationNo: string;
  preparedDate: string; // YYYY-MM-DD
  expireDate: string; // YYYY-MM-DD
  paymentMethod: string; // "FULL_PAYMENT" | "CREDIT" | "ADVANCE_PAYMENT"
  advancePercent?: number | null;
  preparedBy: string;
  quotationTo: string;
  subtotal: number;
  totalAmount: number;
  notes?: string | null;
  items: QuotationPdfItem[];
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

/**
 * Load image as base64 data URL for embedding into jsPDF
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
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
 * Format currency to LKR format
 */
export function formatLKR(amount: number): string {
  return "LKR " + (Number(amount) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
 * Generate and download Quotation PDF
 * Note: Modular template structure — easily customizable when user provides their specific layout!
 */
export async function generateQuotationPdf(data: QuotationPdfData): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Try to load logo
  const logoBase64 = await loadImageAsBase64("/logo.png");

  // --- HEADER SECTION ---
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 12, 35, 14, undefined, "FAST");
    } catch {
      // Fallback text if logo fails to render
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(24, 76, 120);
      doc.text(data.companyName || "LK TRONICS", margin, 20);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(24, 76, 120);
    doc.text(data.companyName || "LK TRONICS", margin, 20);
  }

  // Company details (Right aligned header)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 110);
  const companyInfo = [
    data.companyName || "LK Tronics (Pvt) Ltd",
    data.companyAddress || "No. 123, Galle Road, Colombo, Sri Lanka",
    "Hotline: +94 11 234 5678 / +94 77 123 4567",
    "Email: info@lk-tronics.com | Web: www.lk-tronics.com",
  ];
  let compY = 14;
  for (const line of companyInfo) {
    doc.text(line, pageWidth - margin, compY, { align: "right" });
    compY += 4.2;
  }

  // Horizontal Accent Divider
  doc.setDrawColor(24, 76, 120);
  doc.setLineWidth(0.8);
  doc.line(margin, 34, pageWidth - margin, 34);

  // Document Title Banner
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(margin, 38, pageWidth - margin * 2, 12, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(24, 76, 120);
  doc.text("COMMERCIAL QUOTATION", margin + 4, 46);

  doc.setFontSize(11);
  doc.setTextColor(40, 50, 60);
  doc.text(data.quotationNo, pageWidth - margin - 4, 46, { align: "right" });

  // --- METADATA SECTION: TWO COLUMNS (Quotation To vs Meta Info) ---
  const metaStartY = 56;

  // Left Column: Quotation To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(24, 76, 120);
  doc.text("QUOTATION TO:", margin, metaStartY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(45, 55, 72);
  const customerLines = doc.splitTextToSize(data.quotationTo || "Valued Customer", 85);
  doc.text(customerLines, margin, metaStartY + 5);

  // Right Column: Quotation Details Box
  const boxX = pageWidth - margin - 85;
  const boxWidth = 85;

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxX, metaStartY - 2, boxWidth, 28, 2, 2, "FD");

  const metaItems = [
    { label: "Quotation Date:", val: data.preparedDate },
    { label: "Valid Until:", val: data.expireDate },
    {
      label: "Payment Terms:",
      val: formatPaymentMethodLabel(data.paymentMethod, data.advancePercent),
    },
    { label: "Prepared By:", val: data.preparedBy || "Staff" },
  ];

  let metaY = metaStartY + 4;
  for (const item of metaItems) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(item.label, boxX + 4, metaY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.val), boxX + boxWidth - 4, metaY, { align: "right" });
    metaY += 5.8;
  }

  // Pre-load images for table rows
  const itemImagesBase64: { [idx: number]: string | null } = {};
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (item.imagePath) {
      itemImagesBase64[i] = await loadImageAsBase64(item.imagePath);
    }
  }

  // --- ITEMS TABLE ---
  const tableStartY = Math.max(metaStartY + 32, metaStartY + customerLines.length * 4.5 + 8);

  const tableBody = data.items.map((item, idx) => {
    return [
      String(idx + 1),
      "", // placeholder cell where image will be drawn
      item.description,
      String(item.quantity),
      formatLKR(item.unitPrice),
      formatLKR(item.totalPrice),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [["#", "Image", "Product / Service", "Qty", "Unit Price", "Total Price"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [24, 76, 120],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 34, halign: "right", fontStyle: "bold" },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      valign: "middle",
      overflow: "linebreak",
    },
    didDrawCell: (hookData) => {
      // Draw thumbnail image inside column index 1
      if (hookData.section === "body" && hookData.column.index === 1) {
        const rowIdx = hookData.row.index;
        const img = itemImagesBase64[rowIdx];
        if (img) {
          try {
            const cellW = hookData.cell.width;
            const cellH = hookData.cell.height;
            const imgSize = Math.min(cellW - 4, cellH - 4, 14);
            const x = hookData.cell.x + (cellW - imgSize) / 2;
            const y = hookData.cell.y + (cellH - imgSize) / 2;
            doc.addImage(img, "JPEG", x, y, imgSize, imgSize, undefined, "FAST");
          } catch {
            // Ignore image render failures
          }
        }
      }
    },
  });

  // Position after table
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 40;

  // --- SUMMARY / TOTALS SECTION ---
  const summaryWidth = 85;
  const summaryX = pageWidth - margin - summaryWidth;
  let summaryY = finalY + 6;

  // Check if page break is needed for summary
  if (summaryY + 45 > pageHeight - margin) {
    doc.addPage();
    summaryY = margin + 10;
  }

  // Summary background box
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, summaryY, summaryWidth, 38, 2, 2, "FD");

  // Subtotal line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal:", summaryX + 4, summaryY + 7);
  doc.text(formatLKR(data.subtotal), summaryX + summaryWidth - 4, summaryY + 7, {
    align: "right",
  });

  let nextSummaryY = summaryY + 14;

  // Advance Payment breakdown if selected
  if (data.paymentMethod === "ADVANCE_PAYMENT" && data.advancePercent != null) {
    const advanceAmount = (data.totalAmount * data.advancePercent) / 100;
    const balanceDue = data.totalAmount - advanceAmount;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9); // Amber
    doc.text(`Advance Payable (${data.advancePercent}%):`, summaryX + 4, nextSummaryY);
    doc.text(formatLKR(advanceAmount), summaryX + summaryWidth - 4, nextSummaryY, {
      align: "right",
    });

    nextSummaryY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Balance Due on Delivery:", summaryX + 4, nextSummaryY);
    doc.text(formatLKR(balanceDue), summaryX + summaryWidth - 4, nextSummaryY, {
      align: "right",
    });

    nextSummaryY += 7;
  }

  // Grand Total banner
  doc.setFillColor(24, 76, 120);
  doc.roundedRect(
    summaryX,
    summaryY + 27,
    summaryWidth,
    11,
    1,
    1,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL:", summaryX + 4, summaryY + 34);
  doc.text(formatLKR(data.totalAmount), summaryX + summaryWidth - 4, summaryY + 34, {
    align: "right",
  });

  // --- FOOTER & SIGNATURE ---
  const footerY = pageHeight - 24;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  // Signature Block
  const sigX = pageWidth - margin - 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Authorized Signature", sigX + 25, footerY + 8, { align: "center" });
  doc.setDrawColor(100, 116, 139);
  doc.line(sigX, footerY + 4, sigX + 50, footerY + 4);

  // Save / Trigger Download
  const cleanFileName = (data.quotationNo || "Quotation").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${cleanFileName}.pdf`);
}
