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
 * exactly matching the corporate template layout
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

  doc.setFont("helvetica", "normal");

  // Load official LK Tronics branding logo
  let logoBase64 = await loadImageAsBase64("/template_assets/logos/footer/lk_tronics.png");
  if (!logoBase64) {
    logoBase64 = await loadImageAsBase64("/template_assets/lk_tronics_logo.png");
  }

  const leftMargin = 16;
  const rightMargin = 194;
  const contentWidth = rightMargin - leftMargin;

  // ================= 1. HEADER =================
  // Left: Circular LK Tronics Logo
  if (logoBase64) {
    try {
      const format = logoBase64.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(logoBase64, format, leftMargin, 13.5, 20, 17.8, undefined, "FAST");
    } catch {}
  }

  // Under Logo subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(50, 50, 50);
  doc.text("COMPONENTS FOR THE FUTURE", leftMargin + 10, 35, { align: "center" });

  // Center: LK TRONICS & Contact Information (spaced cleanly with ZERO overlap)
  const centerColX = 52;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39); // Dark slate
  doc.text("LK TRONICS", centerColX, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Labels and Values aligned cleanly
  doc.text("Tele", centerColX, 26);
  doc.text(":", centerColX + 10, 26);
  doc.text("+94 76 357 31 31", centerColX + 13, 26);

  doc.text("E mail", centerColX, 31.5);
  doc.text(":", centerColX + 10, 31.5);
  doc.text("admin@lk-tronics.com | sales@lk-tronics.com", centerColX + 13, 31.5);

  doc.text("Web", centerColX, 37);
  doc.text(":", centerColX + 10, 37);
  doc.text("www.lk-tronics.com", centerColX + 13, 37);

  // Right: Registration No & Address
  const rightColX = 154;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Reg No -WF19731", rightColX, 19);
  doc.text("# 408/20,", rightColX, 23.8);
  doc.text("Pitipana South,", rightColX, 28.6);
  doc.text("Delgahakanda,", rightColX, 33.4);
  doc.text("Homagama,", rightColX, 38.2);
  doc.text("Sri Lanka.", rightColX, 43);

  // Header Divider Horizontal Rule
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.45);
  doc.line(leftMargin, 46.5, rightMargin, 46.5);

  // Optional Ref Number at top right below rule if available
  if (data.refNo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Ref: ${data.refNo}`, rightMargin, 51.5, { align: "right" });
  }

  // ================= 2. DOCUMENT TITLE =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text("Product Handover Letter", 105, 56.5, { align: "center" });

  // ================= 3. PREAMBLE PARAGRAPH =================
  let currentY = 66;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const preamble =
    "We hereby confirm that the following product(s) have been received and accepted for our internal inspection and evaluation process. These items will be reviewed accordingly by our team to verify specifications, condition, and compliance with our requirements.";
  
  const preambleLines = doc.splitTextToSize(preamble, contentWidth);
  doc.text(preambleLines, leftMargin, currentY, { lineHeightFactor: 1.35 });
  currentY += preambleLines.length * 5.2 + 8;

  // ================= 4. SECTION 1: PRODUCT DETAILS =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text("1. Product Details", leftMargin, currentY);
  currentY += 7.5;

  const renderBulletLine = (
    label: string,
    val: string | number | undefined,
    yPos: number,
    minUnderlineWidth = 90
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);

    // Bullet dot
    doc.text("•", leftMargin + 6, yPos);
    // Label
    doc.text(label, leftMargin + 12, yPos);

    const labelWidth = doc.getTextWidth(label);
    const valueStartX = leftMargin + 12 + labelWidth + 3;

    doc.setFont("helvetica", "normal");
    const displayVal = val ? String(val).trim() : "";

    if (displayVal) {
      doc.setTextColor(15, 23, 42);
      // Split value if very long
      const maxValWidth = rightMargin - valueStartX;
      const valLines = doc.splitTextToSize(displayVal, maxValWidth);
      doc.text(valLines, valueStartX, yPos);
      return Math.max(valLines.length * 5.2, 6.5);
    } else {
      // Draw official template blank underline
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.3);
      doc.line(valueStartX, yPos + 0.8, Math.min(valueStartX + minUnderlineWidth, rightMargin), yPos + 0.8);
      return 6.5;
    }
  };

  currentY += renderBulletLine("Product Name:", data.productName, currentY);
  currentY += renderBulletLine("Model / Description:", data.modelDescription, currentY);
  currentY += renderBulletLine("Serial Number(s):", data.serialNumbers, currentY);
  currentY += renderBulletLine("Quantity:", data.quantity, currentY);

  // If additional items were provided
  if (data.additionalItems && data.additionalItems.length > 0) {
    data.additionalItems.forEach((item, idx) => {
      currentY += 2;
      currentY += renderBulletLine(
        `Item ${idx + 2} (${item.productName || "Product"}):`,
        `${item.modelDescription ? item.modelDescription + " | " : ""}Serial: ${item.serialNumbers || "N/A"} | Qty: ${item.quantity || "1"}`,
        currentY
      );
    });
  }

  currentY += 6;

  // ================= 5. SECTION 2: LK TRONICS COLLECTOR'S DETAILS =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text("2. LK TRONICS Collector's Details", leftMargin, currentY);
  currentY += 7.5;

  currentY += renderBulletLine("Name:", data.collectorName, currentY, 110);
  currentY += renderBulletLine("Designation:", data.collectorDesignation, currentY, 95);
  currentY += renderBulletLine("Date:", data.handoverDate, currentY, 70);
  currentY += renderBulletLine("Contact number:", data.contactNumber, currentY, 80);

  currentY += 10;

  // ================= 6. SECTION 4: HANDOVER CONFIRMATION =================
  // (In the official document template, this section is titled "4. Handover Confirmation")
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text("4. Handover Confirmation", leftMargin, currentY);
  currentY += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const confirmText =
    data.confirmationText ||
    "The undersigned hereby confirms that the above-mentioned product(s) have been received for our internal inspection and evaluation. We acknowledge responsibility for the safekeeping and handling of the products from the date stated below.";

  const confirmLines = doc.splitTextToSize(confirmText, contentWidth);
  doc.text(confirmLines, leftMargin, currentY, { lineHeightFactor: 1.35 });

  // ================= 7. SIGNATURES AREA =================
  const sigY = 248;

  // Left Signature: Collector
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, sigY, leftMargin + 65, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("Signature of Collector", leftMargin, sigY + 5.5);

  // Right Signature: Date (with Auto Date printed above the underline)
  const dateSigStartX = 145;
  const dateSigEndX = 188;
  const displayDate = (data.handoverDate || new Date().toISOString().split("T")[0]).trim();

  if (displayDate) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(displayDate, (dateSigStartX + dateSigEndX) / 2, sigY - 2.5, { align: "center" });
  }

  doc.line(dateSigStartX, sigY, dateSigEndX, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("Date", (dateSigStartX + dateSigEndX) / 2, sigY + 5.5, { align: "center" });

  // ================= 8. PAGE NUMBER =================
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("1", 105, 282, { align: "center" });

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

