import jsPDF from "jspdf";
import { loadImageAsBase64 } from "@/lib/quotationPdfGenerator";

/**
 * Interface representing item details in a Product Handover Letter
 */
export interface ProductHandoverItem {
  productName: string;
  modelDescription: string;
  serialNumbers: string;
  quantity: string | number;
}

/**
 * Interface representing all details needed for an official LK Tronics Product Handover Letter
 */
export interface ProductHandoverData {
  id?: string;
  refNo?: string;
  // Primary Product
  productName: string;
  modelDescription: string;
  serialNumbers: string;
  quantity: string | number;

  // Optional Additional Products (if multiple units collected)
  additionalItems?: ProductHandoverItem[];

  // Section 2: Collector Details
  collectorName?: string;
  collectorDesignation?: string;
  handoverDate?: string;
  contactNumber?: string;

  // Confirmation Text (configurable, with official LK Tronics default)
  confirmationText?: string;

  createdAt?: string;
  updatedAt?: string;
}

/**
 * Generates an official LK Tronics Product Handover Letter PDF
 * using the official Quotation template layout, with the logo on the left,
 * no "QUOTATION" watermark text, and the official Quotation company address.
 */
export async function generateHandoverLetterPdf(
  data: ProductHandoverData
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Use Times New Roman to match LK Tronics official quotation documents
  doc.setFont("times", "normal");

  // Load letterhead background (clean top without "QUOTATION" text, with official circuit & footer)
  let bgBase64 = await loadImageAsBase64("/template_assets/handover_letterhead_bg.jpg");
  if (!bgBase64) {
    bgBase64 = await loadImageAsBase64("/template_assets/letterhead_bg.jpg");
  }

  // Load official circular LK Tronics branding logo
  let logoBase64 = await loadImageAsBase64("/template_assets/logos/footer/lk_tronics.png");
  if (!logoBase64) {
    logoBase64 = await loadImageAsBase64("/template_assets/lk_tronics_logo.png");
  }

  const leftMargin = 14;
  const rightMargin = 196;
  const contentWidth = rightMargin - leftMargin;

  // ================= 1. LETTERHEAD BACKGROUND & CLEAN TOP =================
  if (bgBase64) {
    try {
      doc.addImage(bgBase64, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    } catch {
      // Background fallback
    }
  }

  // Ensure header banner area (Y: 0 to 23.3mm) is completely clean white with NO "QUOTATION" text
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 23.3, "F");

  // ================= 2. HEADER: LOGO TO LEFT & QUOTATION ADDRESS =================
  // LK Tronics circular logo positioned on the LEFT
  if (logoBase64) {
    try {
      const format = logoBase64.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(logoBase64, format, leftMargin, 3.8, 16.5, 16.5, undefined, "FAST");
    } catch {}
  }

  // Under-logo tagline
  doc.setFont("times", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  doc.text("COMPONENTS FOR THE FUTURE", leftMargin + 8.25, 21.6, { align: "center" });

  // Company Brand & Contact Details (placed beside the logo)
  const brandColX = leftMargin + 20;
  doc.setFont("times", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(17, 24, 39); // Deep Slate
  doc.text("LK TRONICS", brandColX, 9.8);

  doc.setFont("times", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  doc.text("Tele : +94 76 357 31 31 | 011 4 215 515", brandColX, 14.2);
  doc.text("E mail : admin@lk-tronics.com | sales@lk-tronics.com", brandColX, 18.2);

  // Top Right Contact & Registration Info
  doc.setFont("times", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  doc.text("Web : www.lk-tronics.com", rightMargin, 14.2, { align: "right" });
  doc.text("Reg No : P-V 00336036", rightMargin, 18.2, { align: "right" });

  // ================= 3. SIGNATURE QUOTATION TEAL BAR =================
  // Teal address bar matching quotation template
  doc.setFillColor(74, 144, 152); // Official LK Teal quotation color
  doc.rect(0, 23.3, 210, 6.8, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(235, 248, 250);
  doc.text("LK TRONICS, HIGH-LEVEL ROAD, HOMAGAMA, SRI LANKA.", leftMargin, 27.8);
  doc.text("TEL : 011 4 215 515 | REG NO - P-V 00336036", rightMargin, 27.8, { align: "right" });

  // ================= 4. DOCUMENT TITLE & OPTIONAL REFERENCE =================
  let currentY = 38.5;
  doc.setFont("times", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(17, 24, 39);
  doc.text("Product Handover Letter", 105, currentY, { align: "center" });

  if (data.refNo) {
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Ref: ${data.refNo}`, rightMargin, currentY, { align: "right" });
  }

  // ================= 5. PREAMBLE PARAGRAPH =================
  currentY += 8.0;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const preamble =
    "We hereby confirm that the following product(s) have been received and accepted for our internal inspection and evaluation process. These items will be reviewed accordingly by our team to verify specifications, condition, and compliance with our requirements.";

  const preambleLines = doc.splitTextToSize(preamble, contentWidth);
  doc.text(preambleLines, leftMargin, currentY, { lineHeightFactor: 1.35 });
  currentY += preambleLines.length * 5.0 + 7.0;

  // ================= 6. SECTION 1: PRODUCT DETAILS =================
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text("1. Product Details", leftMargin, currentY);
  currentY += 7.0;

  const renderBulletLine = (
    label: string,
    val: string | number | undefined,
    yPos: number,
    minUnderlineWidth = 90
  ) => {
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);

    // Bullet dot
    doc.text("•", leftMargin + 6, yPos);
    // Label
    doc.text(label, leftMargin + 12, yPos);

    const labelWidth = doc.getTextWidth(label);
    const valueStartX = leftMargin + 12 + labelWidth + 3;

    doc.setFont("times", "normal");
    const displayVal = val ? String(val).trim() : "";

    if (displayVal) {
      doc.setTextColor(15, 23, 42);
      const maxValWidth = rightMargin - valueStartX;
      const valLines = doc.splitTextToSize(displayVal, maxValWidth);
      doc.text(valLines, valueStartX, yPos);
      return Math.max(valLines.length * 5.0, 6.2);
    } else {
      // Draw template blank underline
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.3);
      doc.line(
        valueStartX,
        yPos + 0.8,
        Math.min(valueStartX + minUnderlineWidth, rightMargin),
        yPos + 0.8
      );
      return 6.2;
    }
  };

  currentY += renderBulletLine("Product Name:", data.productName, currentY);
  currentY += renderBulletLine("Model / Description:", data.modelDescription, currentY);
  currentY += renderBulletLine("Serial Number(s):", data.serialNumbers, currentY);
  currentY += renderBulletLine("Quantity:", data.quantity, currentY);

  // If additional items were provided
  if (data.additionalItems && data.additionalItems.length > 0) {
    data.additionalItems.forEach((item, idx) => {
      currentY += 1.5;
      currentY += renderBulletLine(
        `Item ${idx + 2} (${item.productName || "Product"}):`,
        `${item.modelDescription ? item.modelDescription + " | " : ""}Serial: ${item.serialNumbers || "N/A"} | Qty: ${item.quantity || "1"}`,
        currentY
      );
    });
  }

  currentY += 5.5;

  // ================= 7. SECTION 2: LK TRONICS COLLECTOR'S DETAILS =================
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text("2. LK TRONICS Collector's Details", leftMargin, currentY);
  currentY += 7.0;

  currentY += renderBulletLine("Name:", data.collectorName, currentY, 110);
  currentY += renderBulletLine("Designation:", data.collectorDesignation, currentY, 95);
  currentY += renderBulletLine("Date:", data.handoverDate, currentY, 70);
  currentY += renderBulletLine("Contact number:", data.contactNumber, currentY, 80);

  currentY += 8.5;

  // ================= 8. SECTION 4: HANDOVER CONFIRMATION =================
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text("4. Handover Confirmation", leftMargin, currentY);
  currentY += 6.0;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const confirmText =
    data.confirmationText ||
    "The undersigned hereby confirms that the above-mentioned product(s) have been received for our internal inspection and evaluation. We acknowledge responsibility for the safekeeping and handling of the products from the date stated below.";

  const confirmLines = doc.splitTextToSize(confirmText, contentWidth);
  doc.text(confirmLines, leftMargin, currentY, { lineHeightFactor: 1.35 });

  // ================= 9. SIGNATURES AREA =================
  const sigY = 246;

  // Left Signature: Collector
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, sigY, leftMargin + 65, sigY);

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("Signature of Collector", leftMargin, sigY + 5.5);

  // Right Signature: Date (with Auto Date printed above the underline)
  const dateSigStartX = 145;
  const dateSigEndX = 188;
  const displayDate = (data.handoverDate || new Date().toISOString().split("T")[0]).trim();

  if (displayDate) {
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(displayDate, (dateSigStartX + dateSigEndX) / 2, sigY - 2.5, { align: "center" });
  }

  doc.line(dateSigStartX, sigY, dateSigEndX, sigY);

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("Date", (dateSigStartX + dateSigEndX) / 2, sigY + 5.5, { align: "center" });

  // ================= 10. PAGE NUMBER =================
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("1", 105, 280, { align: "center" });

  return doc;
}

/**
 * Direct Print implementation:
 * Opens the browser's native print preview dialog immediately without user friction.
 */
export async function printHandoverLetter(data: ProductHandoverData): Promise<void> {
  const doc = await generateHandoverLetterPdf(data);
  if (typeof window === "undefined") return;

  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  // Use an invisible iframe for seamless direct printing
  let iframe = document.getElementById("handover-print-iframe") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "handover-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
  }

  iframe.src = blobUrl;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("Direct iframe print failed, falling back to window.open", err);
        const printWin = window.open(blobUrl, "_blank");
        printWin?.print();
      }
    }, 200);
  };
}

/**
 * Direct Download implementation:
 * Saves the Handover Letter as a PDF file with a meaningful filename.
 */
export async function downloadHandoverLetter(
  data: ProductHandoverData,
  customFilename?: string
): Promise<void> {
  const doc = await generateHandoverLetterPdf(data);
  const cleanSerial = (data.serialNumbers || "doc").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanDate = (data.handoverDate || new Date().toISOString().split("T")[0]).replace(/[^a-zA-Z0-9_-]/g, "");
  const defaultFilename = `LK_TRONICS_Product_Handover_Letter_${cleanSerial}_${cleanDate}.pdf`;
  const filename = customFilename || defaultFilename;

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
