import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatLKR, formatRs } from "@/lib/quotationPdfGenerator";
import {
  RdQuotationType,
  DEFAULT_THREE_D_PRINT_SPECS,
  DEFAULT_PCB_SPECS,
  DEFAULT_THREE_D_PRINT_TERMS,
  DEFAULT_PCB_TERMS,
  DEFAULT_PROJECT_PROPOSAL_TERMS,
  DEFAULT_PROJECT_PROPOSAL_INTRO,
  getProjectProposalTerms,
  getProjectProposalCombinedTerms,
  LK_TRONICS_BANK_DETAILS,
} from "@/lib/rdQuotationDefaults";

export interface RdQuotationPdfItem {
  itemIndex: number;
  itemType?: "HARDWARE" | "SERVICE";
  productOrService: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
}

export interface RdQuotationPdfData {
  type: RdQuotationType;
  quotationNo: string;
  registrationNo?: string | null;
  projectTitle?: string | null;
  preparedDate: string;
  expireDate: string;
  validityDays?: number | string | null;
  paymentMethod: string;
  advancePercent?: number | string | null;
  preparedBy: string;
  quotationTo: string;
  leadTime?: string | null;
  warranty?: string | null;
  hardwareTotal?: number | null;
  servicesTotal?: number | null;
  totalAmount: number;
  overview?: string | null;
  overviewFontSize?: number | string | null;
  termsFontSize?: number | string | null;
  technicalSpecs?: Record<string, any> | string | null;
  systemDesignImages?: string[] | null;
  termsAndConditions?: string | null;
  items: RdQuotationPdfItem[];
}

/**
 * Loads an image from URL as base64 data (supports browser and Node.js)
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  if (typeof window === "undefined") {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const cleanUrl = url.split("?")[0].replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", cleanUrl);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          ext === ".png"
            ? "image/png"
            : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
        return `data:${mime};base64,${buffer.toString("base64")}`;
      }
    } catch {
      return null;
    }
    return null;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Apply branded letterhead background and top bar (for Project Proposal)
 */
function applyLetterhead(
  doc: jsPDF,
  customRegNo: string,
  bgBase64: string | null
): void {
  if (bgBase64) {
    try {
      doc.addImage(bgBase64, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    } catch {}
  }

  // Top Teal bar
  doc.setFillColor(13, 148, 136); // #0d9488 LK Teal
  doc.rect(0, 23.3, 210, 6.8, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(240, 253, 250);
  doc.text("LK TRONICS,HIGH-LEVEL ROAD,HOMAGAMA,SRI LANKA.", 10, 27.8);
  doc.text(
    `TEL : 011 4 215 515 | REG NO - ${customRegNo || "P-V 00336036"}`,
    200,
    27.8,
    { align: "right" }
  );
}

/**
 * Draws a clean vector checkmark icon
 */
function drawCheckmark(
  doc: jsPDF,
  x: number,
  y: number,
  size: number = 2.4
): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(x, y - size * 0.1, x + size * 0.35, y + size * 0.35);
  doc.line(x + size * 0.35, y + size * 0.35, x + size * 0.95, y - size * 0.55);
}

/**
 * Generate PDF for 3D Print or PCB Quotation (Matching Doc/3D Print.docx & Doc/PCB.docx exactly 1:1)
 */
async function generateHardwareOrPcbPdf(
  data: RdQuotationPdfData,
  bgBase64: string | null

): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Default font to Times New Roman
  doc.setFont("times", "normal");

  const is3D = data.type === "THREE_D_PRINT";
  const isPcb = data.type === "PCB";
  const titleText = is3D
    ? "3D PRINTING SERVICE QUOTATION TO-"
    : "PCB DESIGN & PRINTING SERVICE";

  // Pre-load PCB Images if applicable
  let parsedSpecs: any = {};
  if (data.technicalSpecs) {
    if (typeof data.technicalSpecs === "string") {
      try {
        parsedSpecs = JSON.parse(data.technicalSpecs);
      } catch {
        parsedSpecs = {};
      }
    } else {
      parsedSpecs = data.technicalSpecs;
    }
  }

  const pcbImageBase64List: string[] = [];
  if (isPcb && parsedSpecs) {
    const rawImages: any[] = Array.isArray(parsedSpecs.images)
      ? parsedSpecs.images
      : Array.isArray(parsedSpecs.pcbImages)
      ? parsedSpecs.pcbImages
      : [];

    for (const item of rawImages) {
      if (typeof item === "string" && item.trim()) {
        const b64 = await loadImageAsBase64(item.trim());
        if (b64) {
          pcbImageBase64List.push(b64);
        }
      }
    }
  }

  // Helper to draw full-page authentic letterhead background
  const drawLetterheadBackground = () => {
    if (bgBase64) {
      try {
        doc.addImage(bgBase64, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      } catch (err) {
        console.error("Failed to render letterhead background:", err);
      }
    }
  };

  // --- PAGE 1 ---
  drawLetterheadBackground();

  // --- METADATA BOX (Top Right) ---
  // Positioned below the center circular logo and watermark (Y=32-62mm)
  // Left: 107mm, Right: 187mm (aligned with table right), Top: 65.5mm, Bottom: 94.8mm
  const metaBoxX = 107.0;
  const metaBoxY = 65.5;
  const metaBoxW = 80.0;
  const metaBoxH = 29.3;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.rect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, "FD");

  let paymentMethodDisplay = data.paymentMethod || "100% payment";
  if (paymentMethodDisplay === "ADVANCE_PAYMENT") {
    paymentMethodDisplay = "Advance Payment";
  } else if (
    paymentMethodDisplay === "FULL_PAYMENT" ||
    paymentMethodDisplay === "100% payment"
  ) {
    paymentMethodDisplay = "100% payment";
  }

  const metaRows = [
    { label: "Quotation No:", val: data.quotationNo },
    { label: "Quotation Prepared Date:", val: data.preparedDate },
    { label: "Quotation Expire Date:", val: data.expireDate },
    { label: "Payment Method:", val: paymentMethodDisplay },
    { label: "Prepared by:", val: `[${data.preparedBy || "Vishva Varna"}]` },
  ];

  let currentMetaY = metaBoxY + 5.0;
  metaRows.forEach((r) => {
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(r.label, metaBoxX + 2.5, currentMetaY);
    doc.text(r.val, metaBoxX + metaBoxW - 2.5, currentMetaY, { align: "right" });
    currentMetaY += 4.8;
  });

  // --- CUSTOMER DETAILS (Top Left) ---
  // Positioned below the watermark, starting at Y = 75.0mm
  const customerLeftX = 25.4;
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(0, 0, 0);
  doc.text(titleText, customerLeftX, 75.0);

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  const rawQuotationTo = data.quotationTo || "Customer";
  const customerLines = rawQuotationTo
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let custY = 85.5;
  customerLines.forEach((line) => {
    const splitLines = doc.splitTextToSize(line, 75);
    doc.text(splitLines, customerLeftX, custY);
    custY += splitLines.length * 5.5;
  });

  // --- TABLE (5 Columns) ---
  // Matching Doc/3D Print.docx TBL12:
  // Starts at Y = 104.0mm
  // Col widths: No. (14mm), Product/Service (78.6mm), Quantity (19mm), Unit Price (23.8mm), Total Price (23.8mm)
  // Total Width: 159.2 mm (25.4mm left to 184.6mm right).
  const tableStartY = 104.0;

  // Table rows dynamically matching exact product count
  const tableBody: any[][] = [];
  data.items.forEach((item, i) => {
    tableBody.push([
      (i + 1).toString(),
      item.productOrService || "",
      item.quantity?.toString() || "1",
      Number(item.unitPrice || 0).toFixed(2),
      Number(item.totalPrice || 0).toFixed(2),
    ]);
  });

  // Total Amount row
  tableBody.push([
    "",
    "Total Amount",
    "",
    "",
    Number(data.totalAmount || 0).toFixed(2),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 25.4, right: 25.4 },
    head: [["No.", "Product/Service", "Quantity", "Unit Price", "Total Price"]],
    body: tableBody,
    theme: "plain",
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.25,
    styles: {
      font: "times",
      fontSize: 10,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
      minCellHeight: 7.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      font: "times",
      fontStyle: "bold",
      fontSize: 10,
      textColor: [0, 0, 0],
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 14.0, halign: "center", font: "times", fontStyle: "bold" },
      1: { cellWidth: 78.6, halign: "left", font: "times" },
      2: { cellWidth: 19.0, halign: "center", font: "times", fontStyle: "bold" },
      3: { cellWidth: 23.8, halign: "right", font: "times", fontStyle: "bold" },
      4: { cellWidth: 23.8, halign: "right", font: "times", fontStyle: "bold" },
    },
    didParseCell: (dataHook) => {
      dataHook.cell.styles.font = "times";
      // Total Amount row is the last row
      if (dataHook.row.index === tableBody.length - 1) {
        dataHook.cell.styles.fontStyle = "bold";
        if (dataHook.column.index === 1) {
          dataHook.cell.styles.halign = "center";
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 135.0;

  // --- LEAD TIME BANNER (Bold 11.5pt in Red #EE0000) ---
  const leadTimeY = finalY + 6.5;
  const leadTimeText = data.leadTime || (is3D ? "1 Days" : "12 - 21 Days");
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(238, 0, 0); // #EE0000 Bright Red
  doc.text(`Printing Lead Time & Contingencies: ${leadTimeText}`, 25.4, leadTimeY);

  // --- TECHNICAL SPECIFICATIONS & PRINTING PARAMETERS ---
  const specHeadingY = leadTimeY + 8.5;
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Technical Specifications & Printing Parameters", 25.4, specHeadingY);

  if (is3D) {
    const specLines: string[] = [];
    specLines.push(
      `Printing Technology: ${parsedSpecs.printingTechnology || parsedSpecs.technology || DEFAULT_THREE_D_PRINT_SPECS.printingTechnology}`
    );
    specLines.push(
      `Infill Density: ${parsedSpecs.infillDensity || parsedSpecs.infill || DEFAULT_THREE_D_PRINT_SPECS.infillDensity}`
    );
    specLines.push(
      `Material: ${parsedSpecs.material || DEFAULT_THREE_D_PRINT_SPECS.material}`
    );
    const colors =
      parsedSpecs.availableColors ||
      parsedSpecs.colors ||
      DEFAULT_THREE_D_PRINT_SPECS.availableColors;
    specLines.push(
      `Available Colors: ${colors} (Confirm preferred color at payment)`
    );
    specLines.push(
      `Print Quality: ${parsedSpecs.printQuality || parsedSpecs.layerHeight || DEFAULT_THREE_D_PRINT_SPECS.printQuality}`
    );

    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);

    let currentSpecY = specHeadingY + 6.5;
    specLines.forEach((line) => {
      // Draw vector checkmark at X = 33.0mm
      drawCheckmark(doc, 33.0, currentSpecY - 0.5, 2.2);
      // Draw text starting at X = 38.0mm
      doc.text(line, 38.0, currentSpecY);
      currentSpecY += 5.5;
    });

    // --- TERM 1 (On Page 1): Validity of Quotation ---
    const validityHeadingY = currentSpecY + 5.5;
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Validity of Quotation", 25.4, validityHeadingY);

    const validityBodyY = validityHeadingY + 4.5;
    doc.setFont("times", "normal");
    doc.setFontSize(9.0);
    const validityDays = data.validityDays || "14";
    const validityText = `This quotation is valid for a period of fourteen (${validityDays}) days from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`;

    const wrappedValidity = doc.splitTextToSize(validityText, 159.2);
    doc.text(wrappedValidity, 25.4, validityBodyY);
  } else {
    // --- PCB QUOTATION: Render PCB preview images below Technical Specifications on Page 1 ---
    const imgStartY = specHeadingY + 5.5;
    if (pcbImageBase64List.length === 0) {
      doc.setFont("times", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      doc.text(
        "[ PCB Gerber files & fabrication artwork approved for production ]",
        25.4,
        imgStartY + 6.0
      );
    } else if (pcbImageBase64List.length === 1) {
      const imgW = 140.0;
      const imgH = 65.0;
      const imgX = 25.4 + (159.2 - imgW) / 2;
      try {
        doc.addImage(pcbImageBase64List[0], "PNG", imgX, imgStartY, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[0], "JPEG", imgX, imgStartY, imgW, imgH, undefined, "FAST");
      }
    } else if (pcbImageBase64List.length === 2) {
      const imgW = 75.0;
      const imgH = 55.0;
      const x1 = 25.4;
      const x2 = 25.4 + imgW + 9.2;
      try {
        doc.addImage(pcbImageBase64List[0], "PNG", x1, imgStartY, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[0], "JPEG", x1, imgStartY, imgW, imgH, undefined, "FAST");
      }
      try {
        doc.addImage(pcbImageBase64List[1], "PNG", x2, imgStartY, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[1], "JPEG", x2, imgStartY, imgW, imgH, undefined, "FAST");
      }
    } else if (pcbImageBase64List.length === 3) {
      // 3 images: Matching Doc/PCB.docx layout:
      // Row 1: 2 side-by-side images
      // Row 2: 1 full-width image centered below
      const imgWTop = 75.0;
      const imgHTop = 42.0;
      const x1 = 25.4;
      const x2 = 25.4 + imgWTop + 9.2;
      try {
        doc.addImage(pcbImageBase64List[0], "PNG", x1, imgStartY, imgWTop, imgHTop, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[0], "JPEG", x1, imgStartY, imgWTop, imgHTop, undefined, "FAST");
      }
      try {
        doc.addImage(pcbImageBase64List[1], "PNG", x2, imgStartY, imgWTop, imgHTop, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[1], "JPEG", x2, imgStartY, imgWTop, imgHTop, undefined, "FAST");
      }
      const yBottom = imgStartY + imgHTop + 4.5;
      try {
        doc.addImage(pcbImageBase64List[2], "PNG", 25.4, yBottom, 159.2, 45.0, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[2], "JPEG", 25.4, yBottom, 159.2, 45.0, undefined, "FAST");
      }
    } else {
      // 4+ images: 2x2 grid
      const imgW = 75.0;
      const imgH = 40.0;
      const x1 = 25.4;
      const x2 = 25.4 + imgW + 9.2;
      try {
        doc.addImage(pcbImageBase64List[0], "PNG", x1, imgStartY, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[0], "JPEG", x1, imgStartY, imgW, imgH, undefined, "FAST");
      }
      try {
        doc.addImage(pcbImageBase64List[1], "PNG", x2, imgStartY, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[1], "JPEG", x2, imgStartY, imgW, imgH, undefined, "FAST");
      }
      const yRow2 = imgStartY + imgH + 4.5;
      try {
        doc.addImage(pcbImageBase64List[2], "PNG", x1, yRow2, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[2], "JPEG", x1, yRow2, imgW, imgH, undefined, "FAST");
      }
      try {
        doc.addImage(pcbImageBase64List[3], "PNG", x2, yRow2, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addImage(pcbImageBase64List[3], "JPEG", x2, yRow2, imgW, imgH, undefined, "FAST");
      }
    }
  }

  // ==========================================
  // PAGE 2: Terms, Bank Details, Signature & Appreciation
  // ==========================================
  doc.addPage();
  doc.setFont("times", "normal");
  drawLetterheadBackground();

  // On page 2, start below the top watermark as well (Y = 62mm)
  let p2Y = 62.0;

  if (is3D) {
    const remainingTerms = [
      {
        heading: "Printing Job Scheduling & Availability",
        body: "All 3D printing jobs are scheduled subject to the availability of printers at the LK TRONICS R&D facility. Customers are requested to confirm machine availability with the relevant officer in the LK TRONICS R&D Department prior to order placement.",
      },
      {
        heading: "Design Responsibility & Warranty",
        body: "Printing will be performed strictly according to the STL file provided by the customer. LK TRONICS shall not be liable for any design inaccuracies or dimensional errors arising from customer-supplied files. No warranty is applicable to 3D-printed parts, as they are custom-produced based on client specifications.",
      },
      {
        heading: "Delivery Terms",
        body: "If delivery charges are not specified in the quotation table, the client shall be responsible for either collecting the goods from our store or bearing the applicable delivery cost if delivery is required. LK TRONICS will not be held liable for any damages that may occur during transportation or delivery.",
      },
      {
        heading: "Payment Terms",
        body: "To commence the printing job, a full payment or an 80% advance payment is required. Cancellations are non-refundable once payment has been made. Completed 3D-printed parts will be released to the client only upon receipt of full payment.",
      },
    ];

    remainingTerms.forEach((term) => {
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(term.heading, 25.4, p2Y);

      p2Y += 4.5;
      doc.setFont("times", "normal");
      doc.setFontSize(9.5);
      const wrapped = doc.splitTextToSize(term.body, 159.2);
      doc.text(wrapped, 25.4, p2Y);
      p2Y += wrapped.length * 4.2 + 5.0;
    });
  } else {
    // Exact 5 PCB Terms matching Doc/PCB.docx
    const pcbTerms = [
      {
        heading: "Validity of Quotation",
        body: `This quotation is valid for a period of five (${data.validityDays || "05"}) days from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`,
      },
      {
        heading: "PCB Printing Job Scheduling & Availability",
        body: "All PCB printing and fabrication jobs are scheduled subject to the availability of PCB production equipment at the LK TRONICS R&D facility. Customers are requested to confirm machine availability and estimated production lead time with the relevant officer in the LK TRONICS R&D Department prior to order placement.",
      },
      {
        heading: "PCB Design Responsibility & Warranty",
        body: `PCB printing and fabrication will be carried out strictly according to the design files provided by the customer, including Gerber files, drill files, PCB layouts, dimensions, and other relevant specifications. LK TRONICS shall not be responsible for any design errors, incorrect footprints, track-routing issues, component placement errors, dimensional inaccuracies, or other defects arising from customer-supplied files.\n\nCustomers are therefore advised to verify and approve all design files before production. As PCBs are custom-manufactured according to individual customer specifications, no warranty is applicable for design-related issues; however, any confirmed manufacturing defect attributable to the PCB production process will be reviewed separately.\n\nAll PCB fabrication is carried out based on the final customer-approved design. Even if PCB design assistance is provided by LK TRONICS, the customer is responsible for verifying the design before production, and LK TRONICS shall not be liable for design, compatibility, or functional issues after approval.`,
      },
      {
        heading: "Delivery Terms",
        body: "If delivery charges are not specified in the quotation table, the client shall be responsible for either collecting the goods from our store or bearing the applicable delivery cost if delivery is required. LK TRONICS will not be held liable for any damages that may occur during transportation or delivery.",
      },
      {
        heading: "Payment Terms",
        body: "To commence the printing job, a full payment is required. Cancellations are non-refundable once payment has been made. Completed 3D-printed parts will be released to the client only upon receipt of full payment.",
      },
    ];

    pcbTerms.forEach((term) => {
      doc.setFont("times", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      doc.text(term.heading, 25.4, p2Y);

      p2Y += 4.0;
      doc.setFont("times", "normal");
      doc.setFontSize(8.5);

      const paragraphs = term.body.split("\n\n");
      paragraphs.forEach((pText) => {
        const wrapped = doc.splitTextToSize(pText.trim(), 159.2);
        doc.text(wrapped, 25.4, p2Y);
        p2Y += wrapped.length * 3.6 + 2.0;
      });
      p2Y += 1.5;
    });
  }

  // --- BANK DETAILS SECTION & SIGNATURE ---
  const bankBoxY = Math.min(Math.max(p2Y + 6.0, 184.0), 195.0);
  const bankBoxW = 108;
  const bankBoxH = 30;

  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Bank Details", 25.4, bankBoxY - 2.5);

  // Bank Details Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.rect(25.4, bankBoxY, bankBoxW, bankBoxH, "FD");

  const bankRows = [
    { label: "Account Name", val: LK_TRONICS_BANK_DETAILS.accountName },
    { label: "Account Number", val: LK_TRONICS_BANK_DETAILS.accountNumber },
    { label: "Bank Name", val: LK_TRONICS_BANK_DETAILS.bankName },
    { label: "Bank Branch", val: LK_TRONICS_BANK_DETAILS.branch },
  ];

  let bankRowY = bankBoxY + 6.2;
  bankRows.forEach((row) => {
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(row.label, 28, bankRowY);
    doc.text(row.val, 60, bankRowY);
    bankRowY += 6.5;
  });

  // --- FOOTER APPRECIATION NOTE ---
  // Word doc P69: Times Bold 11.5pt, centered above the bottom graphic curve
  const appreciationY = is3D ? 265 : Math.min(Math.max(bankBoxY + bankBoxH + 8.0, 235.0), 260.0);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(
    "We sincerely appreciate the opportunity to submit this quotation and look forward to supporting your requirements.",
    105,
    appreciationY,
    { align: "center" }
  );

  return doc;
}

interface ProjectProposalBackgrounds {
  bgCover: string | null;
  bgIntro: string | null;
  bgDesign: string | null;
  bgPricing: string | null;
  bgBank: string | null;
  bgTerms: string | null;
  bgClients: string | null;
  bgPartners: string | null;
}

/**
 * Generate PDF for Project Proposal in 16:9 Landscape Presentation format,
 * matching Doc/Project proposal.pptx slide-by-slide across all 8 pages.
 * Page size is exactly 508.0mm x 285.75mm (1440pt x 810pt) matching PPTX native slide size.
 */
async function generateProjectProposalPdf(
  data: RdQuotationPdfData,
  bgs: ProjectProposalBackgrounds
): Promise<jsPDF> {
  // Native PPTX 16:9 widescreen presentation dimensions in mm (20 in x 11.25 in = 1440pt x 810pt)
  const SLIDE_W = 508.0;
  const SLIDE_H = 285.75;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [SLIDE_W, SLIDE_H],
    compress: true,
  });

  // LK TRONICS Official Brand Color Palette (matching official LK Tronics logo)
  const LK_ORANGE: [number, number, number] = [234, 138, 26]; // #EA8A1A (Vibrant circuit orange from 'L', 'Automation' & 'Energy')
  const LK_TEAL: [number, number, number] = [26, 91, 102];   // #1A5B66 (Deep industrial teal from 'TRONICS' & 'Services')
  const LK_SLATE: [number, number, number] = [17, 24, 39];    // #111827 (Executive charcoal slate from 'Electronics')
  const LK_MUTED: [number, number, number] = [100, 116, 139]; // #64748B (Titanium slate circuit traces)

  // ==========================================
  // SLIDE 1: COVER PAGE
  // ==========================================
  if (bgs.bgCover) {
    try {
      doc.addImage(bgs.bgCover, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgCover:", err);
    }
  }

  // 1. Quotation Reference Number (Top Right, minimal, no box, label + number on next line)
  const rawNo = (data.quotationNo || "").trim();
  if (rawNo) {
    const numOnly = rawNo.replace(/^QUOTATION\s*(REF|NO)?\s*[:.-]?\s*/i, "").trim() || rawNo;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
    doc.text("QUOTATION NO", 478.0, 31.5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
    doc.text(numOnly, 478.0, 41.5, { align: "right" });
  }

  // Project Title (uppercase, Helvetica Bold, LK Teal #1A5B66)
  // Perfectly centered horizontally & vertically inside the chamfered title container
  // Box bounds: Center X=254.0mm, Box Y=57.5..112.1mm (Center Y=84.8mm), Max Width=360.0mm, Max Height=44.0mm
  const rawTitle = (data.projectTitle || "PETROL PUMP AUTOMATION SYSTEMS").toUpperCase();
  const maxTitleWidth = 360.0;
  const maxTitleHeight = 44.0;
  const boxCenterY = 84.8;

  // Split raw title into lines preserving user manual line breaks (\r?\n)
  const userLines = rawTitle
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (userLines.length === 0) userLines.push("PETROL PUMP AUTOMATION SYSTEMS");

  // Candidate font sizes from prominent to compact
  const candidateSizes = [38, 34, 30, 26, 22, 19, 16];
  let chosenFontSize = candidateSizes[candidateSizes.length - 1];
  let finalLines: string[] = [];

  for (const size of candidateSizes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);

    const testLines: string[] = [];
    let widthExceeded = false;

    for (const uLine of userLines) {
      const wrapped = doc.splitTextToSize(uLine, maxTitleWidth);
      const subLines: string[] = Array.isArray(wrapped) ? wrapped : [wrapped];
      for (const sl of subLines) {
        testLines.push(sl);
        if (doc.getTextWidth(sl) > maxTitleWidth) {
          widthExceeded = true;
        }
      }
    }

    const lineHeightMm = size * 0.3527 * 1.22;
    const totalBlockHeight = testLines.length * lineHeightMm;

    if (!widthExceeded && totalBlockHeight <= maxTitleHeight) {
      chosenFontSize = size;
      finalLines = testLines;
      break;
    }
    if (size === candidateSizes[candidateSizes.length - 1]) {
      chosenFontSize = size;
      finalLines = testLines;
    }
  }

  // Calculate vertical start Y so the block is centered at boxCenterY
  const lineHeightMm = chosenFontSize * 0.3527 * 1.22;
  const capHeightMm = chosenFontSize * 0.3527 * 0.72;
  const totalHeightMm = (finalLines.length - 1) * lineHeightMm + capHeightMm;
  const startY = boxCenterY - totalHeightMm / 2 + capHeightMm;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(chosenFontSize);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text(finalLines, 254.0, startY, { align: "center", lineHeightFactor: 1.22 });

  // 2. Prepared By (Left Column: X=35.7mm, Baseline Y=137.0mm)
  const prepBy = data.preparedBy || "R&D Department LK TRONICS PVT [LTD]";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text(prepBy, 35.7, 137.0);

  // 3. Quotation To / Client Details (Center Column: X=190.5mm, Baseline Y=137.0mm)
  const quoToText = data.quotationTo || "Super Administrator";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  const quoToLines = doc.splitTextToSize(quoToText, 160.0);
  doc.text(quoToLines, 190.5, 137.0, { lineHeightFactor: 1.25 });

  // 4. Prepared Date (Center Column, Bottom Left: X=190.5mm, Baseline Y=180.0mm)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(data.preparedDate || "—", 190.5, 180.0);

  // 5. Validity Period (Center Column, Bottom Right: X=273.8mm, Baseline Y=180.0mm)
  const valDays = data.validityDays ? `${data.validityDays} Days` : "4 Days";
  const expireStr = data.expireDate ? ` (Until ${data.expireDate})` : "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.text(`${valDays}${expireStr}`, 273.8, 180.0);

  // ==========================================
  // SLIDE 2: SYSTEM OVERVIEW & INTRODUCTION
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgIntro) {
    try {
      doc.addImage(bgs.bgIntro, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgIntro:", err);
    }
  }

  const introText = data.overview || DEFAULT_PROJECT_PROPOSAL_INTRO;

  // Resolve overview font size (from data or technicalSpecs)
  let overviewSize = 16.5;
  if (data.overviewFontSize != null) {
    const s = Number(data.overviewFontSize);
    if (!isNaN(s) && s >= 10 && s <= 30) overviewSize = s;
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try { specsObj = JSON.parse(data.technicalSpecs); } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && specsObj.overviewFontSize != null) {
      const s = Number(specsObj.overviewFontSize);
      if (!isNaN(s) && s >= 10 && s <= 30) overviewSize = s;
    }
  }

  // Rich formatted rendering helper for Slide 2 (Bold, Underline, Bullet Lists, and Features)
  const renderFormattedSlide2 = (
    text: string,
    startY: number,
    startX: number = 44.0,
    maxW: number = 420.0
  ): { endY: number; hasCustomBullets: boolean } => {
    const rawLines = text.split("\n");
    let curY = startY;
    const fontSize = overviewSize;
    const lineSpacing = overviewSize * 0.42;
    const paraGap = overviewSize * 0.25;
    let customBulletCount = 0;

    rawLines.forEach((rawLine) => {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        curY += paraGap;
        return;
      }

      const isBullet =
        trimmed.startsWith("•") ||
        trimmed.startsWith("-") ||
        trimmed.startsWith("*");
      const isNumbered = /^\d+[\.\)]\s+/.test(trimmed);

      if (isBullet || isNumbered) {
        customBulletCount++;
      }

      const cleanLine = isBullet
        ? trimmed.replace(/^[•\-\*]\s*/, "")
        : isNumbered
        ? trimmed.replace(/^\d+[\.\)]\s*/, "")
        : trimmed;

      const indentX = isBullet || isNumbered ? 10.0 : 0.0;

      if (isBullet) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize);
        doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
        doc.text("•", startX + 2.0, curY);
      } else if (isNumbered) {
        const numMatch = trimmed.match(/^(\d+[\.\)])\s+/);
        const numPrefix = numMatch ? numMatch[1] : "1.";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize - 1.5);
        doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
        doc.text(numPrefix, startX + 1.0, curY);
      }

      // Check if bullet has a "Title:" prefix
      const firstColonIdx = cleanLine.indexOf(":");
      const hasColonTitle = isBullet && firstColonIdx > 0 && firstColonIdx < 45;
      const titlePrefix = hasColonTitle
        ? cleanLine.substring(0, firstColonIdx + 1).trim()
        : "";
      const bodyContent = hasColonTitle
        ? cleanLine.substring(firstColonIdx + 1).trim()
        : cleanLine;

      // Tokenize for bold (**...**) and underline (<u>...</u>)
      const parseTokens = (content: string) => {
        const segments = content.split(/(\*\*|<b>|<\/b>|<u>|<\/u>)/);
        let bold = false;
        let underline = false;
        const words: { word: string; bold: boolean; underline: boolean }[] = [];

        segments.forEach((seg) => {
          if (!seg) return;
          if (seg === "**" || seg === "<b>" || seg === "</b>") {
            bold = seg === "**" ? !bold : seg === "<b>";
          } else if (seg === "<u>" || seg === "</u>") {
            underline = seg === "<u>";
          } else {
            const parts = seg.split(/\s+/);
            parts.forEach((p) => {
              if (p) {
                words.push({ word: p, bold, underline });
              }
            });
          }
        });
        return words;
      };

      let curX = startX + indentX;
      doc.setFontSize(fontSize);

      // If bullet item has Title prefix, print title in bold LK Teal first
      if (titlePrefix) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
        doc.text(titlePrefix, curX, curY);
        curX += doc.getTextWidth(titlePrefix) + doc.getTextWidth(" ") + 1.2;
      }

      const bodyWords = parseTokens(bodyContent);
      bodyWords.forEach((wObj) => {
        doc.setFont("helvetica", wObj.bold ? "bold" : "normal");
        const wordW = doc.getTextWidth(wObj.word);
        const spaceW = doc.getTextWidth(" ");

        if (curX + wordW > startX + maxW && curX > startX + indentX) {
          curY += lineSpacing;
          curX = startX + indentX;
        }

        if (wObj.bold) {
          doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
        } else {
          doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
        }

        doc.text(wObj.word, curX, curY);

        if (wObj.underline) {
          doc.setDrawColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
          doc.setLineWidth(0.4);
          doc.line(curX, curY + 0.8, curX + wordW, curY + 0.8);
        }

        curX += wordW + spaceW;
      });

      curY += lineSpacing + (isBullet ? 3.5 : 2.0);
    });

    return { endY: curY, hasCustomBullets: customBulletCount > 0 };
  };

  const { endY: introEndY, hasCustomBullets } = renderFormattedSlide2(introText, 52.0);

  // If user has not provided custom bullet feature points and text is short, show 3 default pillars
  if (!hasCustomBullets && introEndY <= 95.0) {
    const pillarsY = 100.0;
    const pillarW = 136.0;
    const pillarH = 56.0;
    const pillarGap = 10.0;
    const pillars = [
      {
        num: "01",
        title: "EDGE ACQUISITION & TELEMETRY",
        subtitle: "Sensor Sampling & Edge Buffering",
        points: [
          "High-frequency operational data acquisition",
          "Deterministic edge processing & event logging",
          "Continuous pump status monitoring & telemetry",
        ],
      },
      {
        num: "02",
        title: "INDUSTRIAL PROTOCOL INTEGRATION",
        subtitle: "Modbus RS232/485 & Transceiver Bridges",
        points: [
          "Hardware isolated serial-to-WiFi/Ethernet links",
          "Noise immunity & transient voltage suppression",
          "Seamless compatibility with site dispensing pumps",
        ],
      },
      {
        num: "03",
        title: "CLOUD ANALYTICS & LOGGING",
        subtitle: "Remote Access & Secure Cloud Dashboard",
        points: [
          "Encrypted operational telemetry streaming",
          "Centralized reporting & fuel flow audit trails",
          "Live diagnostic health checks & anomaly alerts",
        ],
      },
    ];

    pillars.forEach((p, idx) => {
      const px = 40.0 + idx * (pillarW + pillarGap);

      // Card background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(218, 226, 237);
      doc.setLineWidth(0.4);
      doc.roundedRect(px, pillarsY, pillarW, pillarH, 3.5, 3.5, "FD");

      // Header strip
      doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
      doc.roundedRect(px, pillarsY, pillarW, 11.0, 3.5, 3.5, "F");
      doc.rect(px, pillarsY + 7.0, pillarW, 4.0, "F");

      // Pillar Number & Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(p.num, px + 5.0, pillarsY + 7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(p.title, px + 15.0, pillarsY + 7.5);

      // Subtitle
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.0);
      doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
      doc.text(p.subtitle, px + 6.0, pillarsY + 17.5);

      // Divider
      doc.setDrawColor(218, 226, 237);
      doc.setLineWidth(0.3);
      doc.line(px + 6.0, pillarsY + 20.0, px + pillarW - 6.0, pillarsY + 20.0);

      // Points
      let ptY = pillarsY + 26.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.0);
      p.points.forEach((pt) => {
        doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
        doc.text("•", px + 7.0, ptY);
        doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
        doc.text(pt, px + 12.0, ptY);
        ptY += 8.2;
      });
    });
  }

  // ==========================================
  // SLIDE 3: SYSTEM DESIGN & ARCHITECTURE (UP TO 8 IMAGES)
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgDesign) {
    try {
      doc.addImage(bgs.bgDesign, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgDesign:", err);
    }
  }

  // Resolve images: user-uploaded images or PPTX sample images
  let resolvedImages: string[] = [];
  if (Array.isArray(data.systemDesignImages) && data.systemDesignImages.length > 0) {
    resolvedImages = data.systemDesignImages;
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try {
        specsObj = JSON.parse(data.technicalSpecs);
      } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && Array.isArray(specsObj.systemDesignImages) && specsObj.systemDesignImages.length > 0) {
      resolvedImages = specsObj.systemDesignImages;
    }
  }

  // If no user images provided, load the PPTX 8 component images as sample
  if (resolvedImages.length === 0) {
    const samplePaths = [
      "/template_assets/pptx_slides/image5.png",
      "/template_assets/pptx_slides/image6.png",
      "/template_assets/pptx_slides/image7.png",
      "/template_assets/pptx_slides/image8.png",
      "/template_assets/pptx_slides/image9.png",
      "/template_assets/pptx_slides/image10.png",
      "/template_assets/pptx_slides/image11.png",
      "/template_assets/pptx_slides/image12.png",
    ];
    const loadedSamples = await Promise.all(samplePaths.map((p) => loadImageAsBase64(p)));
    resolvedImages = loadedSamples.filter(Boolean) as string[];
  }

  const imagesToRender = resolvedImages.slice(0, 8);
  const totalImgCount = imagesToRender.length;

  if (totalImgCount > 0) {
    const isSingleRow = totalImgCount <= 4;
    const cols = isSingleRow ? totalImgCount : 4;
    const cardW = 98.0;
    const cardH = isSingleRow ? 92.0 : 72.0;
    const gapX = 14.0;
    const totalRowW = cols * cardW + (cols - 1) * gapX;
    const startX = isSingleRow ? (SLIDE_W - totalRowW) / 2 : 35.0;

    for (let i = 0; i < totalImgCount; i++) {
      const row = isSingleRow ? 0 : Math.floor(i / 4);
      const col = isSingleRow ? i : i % 4;
      const x = startX + col * (cardW + gapX);
      const y = isSingleRow ? 90.0 : row === 0 ? 65.0 : 147.0;

      // Draw sleek, modern engineering card frame with soft subtle border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // Slate-200 subtle modern card outline
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cardW, cardH, 4.0, 4.0, "FD");

      const imgData = imagesToRender[i];
      if (imgData) {
        try {
          const imgBase64 = imgData.startsWith("data:")
            ? imgData
            : await loadImageAsBase64(imgData);
          if (imgBase64) {
            const pad = 6.0;
            const maxW = cardW - pad * 2;
            const maxH = cardH - pad * 2;
            let drawW = maxW;
            let drawH = maxH;
            let drawX = x + pad;
            let drawY = y + pad;

            try {
              const props = doc.getImageProperties(imgBase64);
              if (props && props.width > 0 && props.height > 0) {
                const imgAspect = props.width / props.height;
                const boxAspect = maxW / maxH;
                if (imgAspect > boxAspect) {
                  drawW = maxW;
                  drawH = maxW / imgAspect;
                } else {
                  drawH = maxH;
                  drawW = maxH * imgAspect;
                }
                drawX = x + pad + (maxW - drawW) / 2;
                drawY = y + pad + (maxH - drawH) / 2;
              }
            } catch {
              // fallback to max dimensions
            }

            doc.addImage(
              imgBase64,
              "PNG",
              drawX,
              drawY,
              drawW,
              drawH,
              undefined,
              "FAST"
            );
          }
        } catch (imgErr) {
          console.warn(`Failed to render design image ${i + 1}:`, imgErr);
        }
      }
    }
  }

  // ==========================================
  // SLIDE 4: PRICE AND SYSTEM DESIGN (SPECIFICATIONS & PRICING)
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgPricing) {
    try {
      doc.addImage(bgs.bgPricing, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgPricing:", err);
    }
  }

  const hwItems = data.items.filter((it) => it.itemType !== "SERVICE");
  const srvItems = data.items.filter((it) => it.itemType === "SERVICE");

  const formatLkr = (num: number) =>
    `LKR ${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const hwTotal =
    data.hardwareTotal != null && Number(data.hardwareTotal) > 0
      ? Number(data.hardwareTotal)
      : hwItems.reduce((s, it) => s + Number(it.totalPrice || it.quantity * it.unitPrice || 0), 0);

  const srvTotal =
    data.servicesTotal != null && Number(data.servicesTotal) > 0
      ? Number(data.servicesTotal)
      : srvItems.reduce((s, it) => s + Number(it.totalPrice || it.quantity * it.unitPrice || 0), 0);

  const grandTotal =
    Number(data.totalAmount) > 0
      ? Number(data.totalAmount)
      : hwTotal + srvTotal;

  // --- 1. HARDWARE SECTION (Left Side) ---
  // Header Badge
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(36.0, 36.0, 95.0, 8.5, 2.0, 2.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text("1. HARDWARE COMPONENTS (BOM)", 40.0, 41.8);

  // Hardware items across 2 columns (up to 4 in col 1, 4 in col 2)
  const hwCol1 = hwItems.length > 4 ? hwItems.slice(0, 4) : hwItems;
  const hwCol2 = hwItems.length > 4 ? hwItems.slice(4, 8) : [];

  let hwY1 = 50.0;
  hwCol1.forEach((it) => {
    const name = it.productOrService;
    const qtyStr = `x ${it.quantity}`;
    const lines = doc.splitTextToSize(`•  ${name}`, 82);
    doc.setFont("helvetica", "bold");
    if (lines.length > 1) {
      doc.setFontSize(11.0);
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      doc.text(lines[0], 38.0, hwY1);
      doc.text(lines[1], 42.0, hwY1 + 4.2);
      doc.setFontSize(12.5);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(qtyStr, 138.0, hwY1 + 2.0, { align: "right" });
      hwY1 += 9.2;
    } else {
      doc.setFontSize(12.0);
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      doc.text(lines[0], 38.0, hwY1);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(qtyStr, 138.0, hwY1, { align: "right" });
      hwY1 += 7.8;
    }
  });

  let hwY2 = 50.0;
  hwCol2.forEach((it) => {
    const name = it.productOrService;
    const qtyStr = `x ${it.quantity}`;
    const lines = doc.splitTextToSize(`•  ${name}`, 82);
    doc.setFont("helvetica", "bold");
    if (lines.length > 1) {
      doc.setFontSize(11.0);
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      doc.text(lines[0], 146.0, hwY2);
      doc.text(lines[1], 150.0, hwY2 + 4.2);
      doc.setFontSize(12.5);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(qtyStr, 246.0, hwY2 + 2.0, { align: "right" });
      hwY2 += 9.2;
    } else {
      doc.setFontSize(12.0);
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      doc.text(lines[0], 146.0, hwY2);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(qtyStr, 246.0, hwY2, { align: "right" });
      hwY2 += 7.8;
    }
  });

  // Hardware Subtotal Pill
  const hwPillY = 88.0;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.4);
  doc.roundedRect(36.0, hwPillY, 96.0, 10.0, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("COMPONENT RELATED COST", 40.0, hwPillY + 6.5);

  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(134.0, hwPillY, 114.0, 10.0, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatLkr(hwTotal), 191.0, hwPillY + 6.8, { align: "center" });

  // --- 2. SERVICES SECTION (Left Side) ---
  const srvHeaderY = 104.0;
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(36.0, srvHeaderY, 95.0, 8.5, 2.0, 2.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text("2. ENGINEERING SERVICES", 40.0, srvHeaderY + 5.8);

  let srvY = 118.0;
  const servicesToShow = srvItems.length > 0 ? srvItems : [
    { productOrService: "Testing / Engineering Charges", quantity: 1, unitPrice: 0, totalPrice: 0 },
    { productOrService: "IOT Installation and Programing", quantity: 1, unitPrice: 0, totalPrice: 0 },
  ];
  servicesToShow.forEach((srv) => {
    const name = srv.productOrService;
    const qtyStr = `x ${srv.quantity}`;
    const lines = doc.splitTextToSize(`•  ${name}`, 170);
    doc.setFont("helvetica", "bold");
    if (lines.length > 1) {
      doc.setFontSize(11.5);
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      doc.text(lines[0], 38.0, srvY);
      doc.text(lines[1], 42.0, srvY + 4.2);
      doc.setFontSize(12.5);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(qtyStr, 246.0, srvY + 2.0, { align: "right" });
      srvY += 9.5;
    } else {
      doc.setFontSize(12.5);
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      doc.text(lines[0], 38.0, srvY);
      doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
      doc.text(qtyStr, 246.0, srvY, { align: "right" });
      srvY += 8.2;
    }
  });

  // Services Subtotal Pill
  const srvPillY = 140.0;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.4);
  doc.roundedRect(36.0, srvPillY, 96.0, 10.0, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("SERVICES RELATED COST", 40.0, srvPillY + 6.5);

  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(134.0, srvPillY, 114.0, 10.0, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatLkr(srvTotal), 191.0, srvPillY + 6.8, { align: "center" });

  // --- 3. RIGHT SIDE CARDS (Lead Time, Warranty, Engineering Oversight) ---
  // Lead Time Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.4);
  doc.roundedRect(266.0, 36.0, 100.0, 48.0, 3.5, 3.5, "FD");
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(266.0, 36.0, 100.0, 12.0, 3.5, 3.5, "F");
  doc.rect(266.0, 44.0, 100.0, 4.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.0);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("PROJECT ESTIMATED LEAD TIME", 316.0, 44.0, { align: "center" });
  doc.setDrawColor(218, 226, 237);
  doc.line(266.0, 48.0, 366.0, 48.0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21.0);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(data.leadTime || "10 Working Days", 316.0, 65.0, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Commences upon purchase order & advance confirmation", 316.0, 75.0, { align: "center" });

  // Warranty Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 226, 237);
  doc.roundedRect(374.0, 36.0, 100.0, 48.0, 3.5, 3.5, "FD");
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(374.0, 36.0, 100.0, 12.0, 3.5, 3.5, "F");
  doc.rect(374.0, 44.0, 100.0, 4.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.0);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("HARDWARE WARRANTY", 424.0, 44.0, { align: "center" });
  doc.setDrawColor(218, 226, 237);
  doc.line(374.0, 48.0, 474.0, 48.0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21.0);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(data.warranty || "1 Year", 424.0, 65.0, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Manufacturer fault warranty as stated in quotation terms", 424.0, 75.0, { align: "center" });

  // Engineering Oversight Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(218, 226, 237);
  doc.roundedRect(266.0, 92.0, 208.0, 58.0, 3.5, 3.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.0);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("ENGINEERING OVERSIGHT & QUALITY ASSURANCE", 274.0, 102.0);
  doc.setDrawColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.setLineWidth(0.8);
  doc.line(274.0, 105.0, 410.0, 105.0);

  const engNotes = [
    "• Directed by dedicated Senior R&D Engineer from inception to deployment.",
    "• Regular milestone progress reports & engineering test validations.",
    "• Industrial grade component screening & environmental stress validation.",
    "• Comprehensive benchtop and on-site integration verification protocol.",
  ];
  let noteY = 113.0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  engNotes.forEach((n) => {
    doc.text(n, 274.0, noteY);
    noteY += 8.2;
  });

  // --- 4. GRAND TOTAL INVESTMENT BAR (Bottom Full Width) ---
  const totalBarY = 160.0;
  doc.setFillColor(241, 248, 249);
  doc.setDrawColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(36.0, totalBarY, 438.0, 28.0, 4.0, 4.0, "FD");

  // Left Section of Total Bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("COMMERCIAL INVESTMENT SCHEDULE", 46.0, totalBarY + 10.0);
  doc.setFontSize(16.0);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("TOTAL PROJECT INVESTMENT", 46.0, totalBarY + 20.0);

  // Separator Line
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.5);
  doc.line(170.0, totalBarY + 4.0, 170.0, totalBarY + 24.0);

  // Grand Total Amount (Massive LK Teal)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36.0);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text(formatLkr(grandTotal), 320.0, totalBarY + 19.5, { align: "center" });

  // ==========================================
  // SLIDE 5: BANK DETAILS (DEDICATED SLIDE)
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgBank) {
    try {
      doc.addImage(bgs.bgBank, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgBank:", err);
    }
  }

  // Check if advance percentage is different from 60%
  let advancePercent = 60;
  if (data.advancePercent != null) {
    const p = Number(data.advancePercent);
    if (!isNaN(p) && p > 0 && p <= 100) advancePercent = p;
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try {
        specsObj = JSON.parse(data.technicalSpecs);
      } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && specsObj.advancePercent != null) {
      const p = Number(specsObj.advancePercent);
      if (!isNaN(p) && p > 0 && p <= 100) advancePercent = p;
    }
  }

  if (advancePercent !== 60) {
    // Redraw the PO text box with custom percentage matching exact slide card coordinates
    doc.setFillColor(248, 250, 252);
    doc.rect(38.0, 42.0, 244.0, 70.0, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14.0);
    doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
    doc.text("PURCHASE ORDER & ADVANCE TERMS", 44.0, 48.0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13.0);
    doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
    const clauseText = `The total value of the product or ${advancePercent}% of the total value\nshould be payable together with your purchase order.\n\n(If only we are registered as your vendor, a one-month\ncredit facility can be extended for your orders.\nTo initiate this credit facility, kindly reach out to us.)`;
    doc.text(clauseText, 44.0, 56.0, { lineHeightFactor: 1.4 });
  }

  // ==========================================
  // SLIDE 6: TERMS AND CONDITIONS
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgTerms) {
    try {
      doc.addImage(bgs.bgTerms, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgTerms:", err);
    }
  }

  // Combine any additional terms ON TOP of the 7 fixed default terms
  const termsList = getProjectProposalCombinedTerms(
    data.termsAndConditions,
    data.validityDays || 4
  );

  let termY = 48.0;
  const maxTermY = 248.0;

  // Resolve terms font size (from data or technicalSpecs)
  let customTermsFontSize: number | null = null;
  if (data.termsFontSize != null) {
    const s = Number(data.termsFontSize);
    if (!isNaN(s) && s >= 9 && s <= 24) customTermsFontSize = s;
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try {
        specsObj = JSON.parse(data.technicalSpecs);
      } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && specsObj.termsFontSize != null) {
      const s = Number(specsObj.termsFontSize);
      if (!isNaN(s) && s >= 9 && s <= 24) customTermsFontSize = s;
    }
  }

  const isExtended = termsList.length > 7;
  const defaultSize = isExtended ? (termsList.length > 9 ? 12.0 : 13.5) : 15.0;
  const fontSize = customTermsFontSize || defaultSize;
  const lineSpacing = fontSize * 0.44;
  const termPadding = fontSize * 0.28;

  termsList.forEach((term) => {
    const cleanTerm = term.replace(/^(\d+[\.\)]|\•|\-)\s*/, "").trim();

    // Check if term starts with Title Prefix e.g. "Quotation Validity: ..."
    const colonIdx = cleanTerm.indexOf(":");
    let titlePart = "";
    let bodyPart = cleanTerm;
    if (colonIdx > 0 && colonIdx < 40) {
      titlePart = cleanTerm.substring(0, colonIdx + 1).trim();
      bodyPart = cleanTerm.substring(colonIdx + 1).trim();
    }

    const fullTermText = titlePart ? `•  ${titlePart} ${bodyPart}` : `•  ${cleanTerm}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const wrapped = doc.splitTextToSize(fullTermText, 432.0);
    const blockHeight = wrapped.length * lineSpacing + termPadding;

    if (termY + blockHeight > maxTermY) {
      doc.addPage([SLIDE_W, SLIDE_H], "landscape");
      if (bgs.bgTerms) {
        try {
          doc.addImage(bgs.bgTerms, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
        } catch (err) {
          console.warn("Failed to render continuation bgTerms:", err);
        }
      }
      termY = 48.0;
    }

    // Draw bullet
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
    doc.text("•", 38.0, termY);

    if (titlePart) {
      // Bold LK Teal title prefix
      doc.setFont("helvetica", "bold");
      doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
      doc.text(titlePart, 44.0, termY);

      // Remaining line text with explicit word gap
      const titleWidth = doc.getTextWidth(titlePart) + doc.getTextWidth(" ") + 1.2;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);

      // Calculate wrapped text for lines
      const combinedLine1 = titlePart + " " + bodyPart;
      const allWrapped = doc.splitTextToSize(combinedLine1, 426.0);

      // Print first line after title
      if (allWrapped.length > 0) {
        const firstLineBody = allWrapped[0].substring(titlePart.length).trim();
        doc.text(firstLineBody, 44.0 + titleWidth, termY);
        for (let l = 1; l < allWrapped.length; l++) {
          doc.text(allWrapped[l], 44.0, termY + l * lineSpacing);
        }
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      const noBulletWrapped = doc.splitTextToSize(cleanTerm, 426.0);
      doc.text(noBulletWrapped, 44.0, termY, { lineHeightFactor: 1.25 });
    }

    termY += blockHeight;
  });

  // ==========================================
  // SLIDE 7: OUR CLIENTS
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgClients) {
    try {
      doc.addImage(bgs.bgClients, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgClients:", err);
    }
  }

  // ==========================================
  // SLIDE 8: OUR BRAND PARTNERS
  // ==========================================
  doc.addPage([SLIDE_W, SLIDE_H], "landscape");
  if (bgs.bgPartners) {
    try {
      doc.addImage(bgs.bgPartners, "PNG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
    } catch (err) {
      console.warn("Failed to render bgPartners:", err);
    }
  }

  return doc;
}

/**
 * Universal R&D PDF generator entry point
 */
export async function generateRdQuotationPdf(
  data: RdQuotationPdfData
): Promise<jsPDF> {
  if (data.type === "PROJECT_PROPOSAL") {
    const [
      bgCover,
      bgIntro,
      bgDesign,
      bgPricing,
      bgBank,
      bgTerms,
      bgClients,
      bgPartners,
    ] = await Promise.all([
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide1_cover.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide2_intro.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide3_design.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide4_pricing.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide5_bank.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide6_terms.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide7_clients.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide8_partners.png"),
    ]);
    return await generateProjectProposalPdf(data, {
      bgCover,
      bgIntro,
      bgDesign,
      bgPricing,
      bgBank,
      bgTerms,
      bgClients,
      bgPartners,
    });
  } else {
    const bgBase64 = await loadImageAsBase64("/template_assets/rd_3d_letterhead.jpg");
    return await generateHardwareOrPcbPdf(data, bgBase64);
  }
}
