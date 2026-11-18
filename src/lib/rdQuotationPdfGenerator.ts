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
  formatValidityDaysText,
} from "@/lib/rdQuotationDefaults";
import { WARRANTY_BADGE_BASE64 } from "@/lib/rdQuotationAssets";

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
  commercialNote?: string | null;
  technicalSpecs?: Record<string, any> | string | null;
  systemDesignImages?: string[] | null;
  termsAndConditions?: string | null;
  items: RdQuotationPdfItem[];
  bankDetails?: {
    id?: string;
    accountName: string;
    accountNumber: string;
    bankName: string;
    branch: string;
  } | null;
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
  // Right aligned with table right border (184.6mm), width 70mm, left 114.6mm
  const metaBoxW = 70.0;
  const metaBoxX = 184.6 - metaBoxW; // 114.6mm
  const metaBoxY = 65.5;
  const metaBoxH = 24.5;

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
  ];

  let currentMetaY = metaBoxY + 5.0;
  metaRows.forEach((r) => {
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${r.label}  ${r.val}`, metaBoxX + 2.5, currentMetaY);
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
    let resolved3dValidity = Number(data.validityDays);
    if (!resolved3dValidity || isNaN(resolved3dValidity) || resolved3dValidity <= 0) {
      if (data.preparedDate && data.expireDate) {
        try {
          const p = new Date(data.preparedDate).getTime();
          const e = new Date(data.expireDate).getTime();
          const diff = Math.round((e - p) / (1000 * 60 * 60 * 24));
          if (diff > 0) resolved3dValidity = diff;
        } catch {}
      }
    }
    if (!resolved3dValidity || isNaN(resolved3dValidity) || resolved3dValidity <= 0) {
      resolved3dValidity = 14;
    }
    const validityDaysText = formatValidityDaysText(resolved3dValidity);
    const validityText = `This quotation is valid for a period of ${validityDaysText} from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`;

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
    // Resolve PCB validity matching PMS web enter Validity Period
    let resolvedPcbValidity = Number(data.validityDays);
    if (!resolvedPcbValidity || isNaN(resolvedPcbValidity) || resolvedPcbValidity <= 0) {
      if (data.preparedDate && data.expireDate) {
        try {
          const p = new Date(data.preparedDate).getTime();
          const e = new Date(data.expireDate).getTime();
          const diff = Math.round((e - p) / (1000 * 60 * 60 * 24));
          if (diff > 0) resolvedPcbValidity = diff;
        } catch {}
      }
    }
    if (!resolvedPcbValidity || isNaN(resolvedPcbValidity) || resolvedPcbValidity <= 0) {
      resolvedPcbValidity = 5;
    }
    const pcbValidityDaysText = formatValidityDaysText(resolvedPcbValidity);

    // Exact 5 PCB Terms matching Doc/PCB.docx
    const pcbTerms = [
      {
        heading: "Validity of Quotation",
        body: `This quotation is valid for a period of ${pcbValidityDaysText} from the date of issue. Upon expiry of this period, the prices, availability, and terms specified herein shall be subject to change and may be adjusted based on market conditions, supplier revisions, or other applicable factors.`,
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
  const bankBoxW = 118;
  const bankBoxH = 36;

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("Bank Details", 25.4, bankBoxY - 2.8);

  // Bank Details Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setFillColor(255, 255, 255);
  doc.rect(25.4, bankBoxY, bankBoxW, bankBoxH, "FD");

  // Resolve bank details (from data.bankDetails or data.technicalSpecs)
  let activeBank = LK_TRONICS_BANK_DETAILS;
  if (data.bankDetails) {
    activeBank = {
      accountName: data.bankDetails.accountName || LK_TRONICS_BANK_DETAILS.accountName,
      accountNumber: data.bankDetails.accountNumber || LK_TRONICS_BANK_DETAILS.accountNumber,
      bankName: data.bankDetails.bankName || LK_TRONICS_BANK_DETAILS.bankName,
      branch: data.bankDetails.branch || LK_TRONICS_BANK_DETAILS.branch,
    };
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try { specsObj = JSON.parse(data.technicalSpecs); } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && specsObj.bankDetails) {
      activeBank = {
        accountName: specsObj.bankDetails.accountName || LK_TRONICS_BANK_DETAILS.accountName,
        accountNumber: specsObj.bankDetails.accountNumber || LK_TRONICS_BANK_DETAILS.accountNumber,
        bankName: specsObj.bankDetails.bankName || LK_TRONICS_BANK_DETAILS.bankName,
        branch: specsObj.bankDetails.branch || LK_TRONICS_BANK_DETAILS.branch,
      };
    }
  }

  const bankRows = [
    { label: "Account Name", val: activeBank.accountName },
    { label: "Account Number", val: activeBank.accountNumber },
    { label: "Bank Name", val: activeBank.bankName },
    { label: "Bank Branch", val: activeBank.branch },
  ];

  let bankRowY = bankBoxY + 7.2;
  bankRows.forEach((row) => {
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(row.label, 28.5, bankRowY);
    doc.text(row.val, 64, bankRowY);
    bankRowY += 7.5;
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
  warrantyBadge?: string | null;
}

export interface SlideToken {
  word: string;
  bold: boolean;
  underline: boolean;
  highlight: boolean;
  color?: [number, number, number] | null;
}

const SLIDE_COLOR_MAP: Record<string, [number, number, number]> = {
  red: [220, 38, 38], // #DC2626 Warning / Danger
  danger: [220, 38, 38],
  orange: [242, 142, 43], // #F28E2B LK Orange
  warning: [217, 119, 6],
  amber: [217, 119, 6], // #D97706 Amber
  teal: [0, 122, 135], // #007A87 LK Teal
  blue: [37, 99, 235], // #2563EB Blue
  slate: [71, 85, 105], // #475569 LK Slate
  gray: [100, 116, 139],
};

function parseSlideColor(raw: string): [number, number, number] | null {
  const clean = raw.toLowerCase().trim().replace(/['"]/g, "");
  if (SLIDE_COLOR_MAP[clean]) return SLIDE_COLOR_MAP[clean];
  if (clean.startsWith("#")) {
    const hex = clean.substring(1);
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
  }
  return null;
}

/**
 * Tokenize slide text into styled word units (normal, bold, underline, highlight, color)
 * Syntax:
 * - Bold: **text** or <b>text</b>
 * - Underline: <u>text</u>
 * - Highlight: ==text== or <mark>text</mark>
 * - Color: [red]text[/red], [orange]text[/orange], [teal]text[/teal], [amber]text[/amber], [color=#hex]text[/color]
 */
export function parseSlideTokens(content: string): Array<SlideToken> {
  const segments = content.split(
    /(\*\*|<b>|<\/b>|<u>|<\/u>|==|<mark>|<\/mark>|\[\/?(?:red|danger|orange|warning|amber|teal|blue|slate|gray|color(?:=[^\]]+)?)\]|<font[^>]*>|<\/font>|<span[^>]*>|<\/span>)/gi
  );
  let bold = false;
  let underline = false;
  let highlight = false;
  let activeColor: [number, number, number] | null = null;
  const words: Array<SlideToken> = [];

  segments.forEach((seg) => {
    if (!seg) return;
    const lower = seg.toLowerCase();
    if (seg === "**" || lower === "<b>" || lower === "</b>") {
      bold = seg === "**" ? !bold : lower === "<b>";
    } else if (lower === "<u>" || lower === "</u>") {
      underline = lower === "<u>";
    } else if (seg === "==" || lower === "<mark>" || lower === "</mark>") {
      highlight = seg === "==" ? !highlight : lower === "<mark>";
    } else if (lower.startsWith("[color=")) {
      const colStr = lower.substring(7, lower.length - 1);
      activeColor = parseSlideColor(colStr);
    } else if (
      lower.startsWith("[/color]") ||
      lower === "[/red]" ||
      lower === "[/danger]" ||
      lower === "[/orange]" ||
      lower === "[/warning]" ||
      lower === "[/amber]" ||
      lower === "[/teal]" ||
      lower === "[/blue]" ||
      lower === "[/slate]" ||
      lower === "[/gray]" ||
      lower === "</span>" ||
      lower === "</font>"
    ) {
      activeColor = null;
    } else if (lower === "[red]" || lower === "[danger]") {
      activeColor = SLIDE_COLOR_MAP.red;
    } else if (lower === "[orange]" || lower === "[warning]") {
      activeColor = SLIDE_COLOR_MAP.orange;
    } else if (lower === "[amber]") {
      activeColor = SLIDE_COLOR_MAP.amber;
    } else if (lower === "[teal]") {
      activeColor = SLIDE_COLOR_MAP.teal;
    } else if (lower === "[blue]") {
      activeColor = SLIDE_COLOR_MAP.blue;
    } else if (lower === "[slate]") {
      activeColor = SLIDE_COLOR_MAP.slate;
    } else if (lower.startsWith("<font") || lower.startsWith("<span")) {
      const colorMatch = seg.match(/color[:=]\s*["']?([^"';>]+)/i);
      if (colorMatch) {
        activeColor = parseSlideColor(colorMatch[1]);
      }
    } else {
      const parts = seg.split(/\s+/);
      parts.forEach((p) => {
        if (p) {
          words.push({ word: p, bold, underline, highlight, color: activeColor });
        }
      });
    }
  });
  return words;
}

// Native PPTX 16:9 widescreen presentation dimensions in mm (20 in x 11.25 in = 1440pt x 810pt)
export const SLIDE_W = 508.0;
export const SLIDE_H = 285.75;

/**
 * Responsive layout configuration helper for Slide 3 architecture images:
 * Dynamically increases card size when fewer images are present (e.g. 1 or 2 large prominent cards)
 * and reduces card size when more images are present (e.g. 2 balanced rows of up to 4 cards).
 */
export function getDesignImageLayout(
  totalCount: number,
  index: number
): { x: number; y: number; cardW: number; cardH: number } {
  if (totalCount === 1) {
    const cardW = 380.0;
    const cardH = 175.0;
    const x = (SLIDE_W - cardW) / 2;
    const y = 56.0;
    return { x, y, cardW, cardH };
  }

  if (totalCount === 2) {
    // 2 images: large prominent cards side-by-side (width increased to 210mm)
    const cardW = 210.0;
    const cardH = 165.0;
    const gapX = 22.0;
    const totalRowW = 2 * cardW + gapX;
    const startX = (SLIDE_W - totalRowW) / 2;
    const x = startX + index * (cardW + gapX);
    const y = 58.0;
    return { x, y, cardW, cardH };
  }

  if (totalCount === 3) {
    // 3 images: single row, 3 cards
    const cardW = 138.0;
    const cardH = 150.0;
    const gapX = 16.0;
    const totalRowW = 3 * cardW + 2 * gapX;
    const startX = (SLIDE_W - totalRowW) / 2;
    const x = startX + index * (cardW + gapX);
    const y = 65.0;
    return { x, y, cardW, cardH };
  }

  if (totalCount === 4) {
    // 4 images: single row, 4 cards
    const cardW = 104.0;
    const cardH = 125.0;
    const gapX = 12.0;
    const totalRowW = 4 * cardW + 3 * gapX;
    const startX = (SLIDE_W - totalRowW) / 2;
    const x = startX + index * (cardW + gapX);
    const y = 72.0;
    return { x, y, cardW, cardH };
  }

  if (totalCount === 5 || totalCount === 6) {
    // 2 rows: up to 3 per row
    const cardW = 136.0;
    const cardH = 84.0;
    const gapX = 16.0;
    const gapY = 14.0;

    const row = Math.floor(index / 3);
    const col = index % 3;
    const itemsInThisRow = row === 0 ? 3 : totalCount - 3;
    const totalRowW = itemsInThisRow * cardW + (itemsInThisRow - 1) * gapX;
    const startX = (SLIDE_W - totalRowW) / 2;

    const x = startX + col * (cardW + gapX);
    const y = 56.0 + row * (cardH + gapY);
    return { x, y, cardW, cardH };
  }

  // 7 or 8+ images: 2 rows of up to 4 per row (compact reduced size)
  const cardW = 100.0;
  const cardH = 82.0;
  const gapX = 14.0;
  const gapY = 14.0;

  const row = Math.floor(index / 4);
  const col = index % 4;
  const itemsInThisRow = row === 0 ? 4 : totalCount - 4;
  const totalRowW = itemsInThisRow * cardW + (itemsInThisRow - 1) * gapX;
  const startX = (SLIDE_W - totalRowW) / 2;

  const x = startX + col * (cardW + gapX);
  const y = 56.0 + row * (cardH + gapY);
  return { x, y, cardW, cardH };
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

  // 2. Prepared By - Removed from cover/main page per user requirement

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
  let overviewSize = 22.0;
  if (data.overviewFontSize != null) {
    const s = Number(data.overviewFontSize);
    if (!isNaN(s) && s >= 10 && s <= 36) overviewSize = s;
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try { specsObj = JSON.parse(data.technicalSpecs); } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && specsObj.overviewFontSize != null) {
      const s = Number(specsObj.overviewFontSize);
      if (!isNaN(s) && s >= 10 && s <= 36) overviewSize = s;
    }
  }

  // Rich formatted rendering helper for Slide 2 (Bold, Underline, Highlight, Bullet Lists, and Features)
  const renderFormattedSlide2 = (
    text: string,
    startY: number,
    startX: number = 44.0,
    maxW: number = 420.0
  ): { endY: number; hasCustomBullets: boolean } => {
    const rawLines = text.split("\n");
    let curY = startY;
    const fontSize = overviewSize;
    const lineSpacing = overviewSize * 0.48;
    const paraGap = overviewSize * 0.35;
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

      let curX = startX + indentX;
      doc.setFontSize(fontSize);

      // If bullet item has Title prefix, print title in bold LK Teal first
      if (titlePrefix) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
        doc.text(titlePrefix, curX, curY);
        curX += doc.getTextWidth(titlePrefix) + doc.getTextWidth(" ") + 1.2;
      }

      const bodyWords = parseSlideTokens(bodyContent);
      bodyWords.forEach((wObj, wIdx) => {
        doc.setFont("helvetica", wObj.bold ? "bold" : "normal");
        const wordW = doc.getTextWidth(wObj.word);
        const spaceW = doc.getTextWidth(" ");

        if (curX + wordW > startX + maxW && curX > startX + indentX) {
          curY += lineSpacing;
          curX = startX + indentX;
        }

        // Draw yellow highlight rectangle behind text if highlighted
        if (wObj.highlight) {
          const nextWord = bodyWords[wIdx + 1];
          const hasContinuousHl =
            nextWord &&
            nextWord.highlight &&
            curX + wordW + spaceW <= startX + maxW;
          const hlW = hasContinuousHl ? wordW + spaceW + 0.8 : wordW + 0.8;
          doc.setFillColor(255, 255, 0); // Bright Yellow #FFFF00
          doc.rect(curX - 0.4, curY - fontSize * 0.28, hlW, fontSize * 0.36, "F");
        }

        if (wObj.color) {
          doc.setTextColor(wObj.color[0], wObj.color[1], wObj.color[2]);
        } else if (wObj.bold) {
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

  renderFormattedSlide2(introText, 58.0);

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
    for (let i = 0; i < totalImgCount; i++) {
      const { x, y, cardW, cardH } = getDesignImageLayout(totalImgCount, i);

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
            const pad = totalImgCount <= 2 ? 8.0 : 6.0;
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

  const hwItems = data.items.filter((it) => it.itemType !== "SERVICE").slice(0, 4);
  const srvItems = data.items.filter((it) => it.itemType === "SERVICE").slice(0, 2);

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

  // --- 1. HARDWARE SECTION (Left Side - Max 4 items, prominent font size like terms slide) ---
  // Header Badge
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(36.0, 35.0, 115.0, 10.0, 2.0, 2.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.0);
  doc.setTextColor(255, 255, 255);
  doc.text("1. HARDWARE COMPONENTS (BOM)", 40.0, 41.8);

  // Hardware items (up to 4 items in full-width single column with large clear font)
  let hwY = 52.5;
  const hwStep = hwItems.length <= 3 ? 12.0 : 9.5;
  hwItems.forEach((it) => {
    const name = it.productOrService;
    const qtyStr = `x ${it.quantity}`;

    // Bullet in LK Orange
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18.0);
    doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
    doc.text("•", 38.0, hwY);

    // Quantity right-aligned in LK Orange
    doc.setFontSize(18.5);
    doc.text(qtyStr, 246.0, hwY, { align: "right" });

    // Item name in slate bold
    doc.setFontSize(18.0);
    doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
    const maxNameW = 166.0;
    const lines = doc.splitTextToSize(name, maxNameW);
    if (lines.length > 1) {
      doc.text(lines[0], 44.0, hwY - 2.0);
      doc.setFontSize(15.0);
      doc.text(lines[1], 44.0, hwY + 3.5);
      hwY += hwStep + 3.0;
    } else {
      doc.text(lines[0], 44.0, hwY);
      hwY += hwStep;
    }
  });

  // Hardware Subtotal Pill
  const hwPillY = 94.0;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.4);
  doc.roundedRect(36.0, hwPillY, 96.0, 11.5, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("COMPONENT RELATED COST", 40.0, hwPillY + 7.5);

  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(134.0, hwPillY, 114.0, 11.5, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.0);
  doc.setTextColor(255, 255, 255);
  doc.text(formatLkr(hwTotal), 191.0, hwPillY + 7.8, { align: "center" });

  // --- 2. SERVICES SECTION (Left Side - Max 2 items, prominent font size like terms slide) ---
  const srvHeaderY = 116.0;
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(36.0, srvHeaderY, 105.0, 10.0, 2.0, 2.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.0);
  doc.setTextColor(255, 255, 255);
  doc.text("2. ENGINEERING SERVICES", 40.0, srvHeaderY + 6.8);

  let srvY = 136.0;
  const servicesToShow = srvItems.length > 0 ? srvItems : [
    { productOrService: "Testing / Engineering Charges", quantity: 1, unitPrice: 0, totalPrice: 0 },
    { productOrService: "IOT Installation and Programing", quantity: 1, unitPrice: 0, totalPrice: 0 },
  ];
  servicesToShow.forEach((srv, sIdx) => {
    const name = srv.productOrService;
    const curSrvY = srvY + sIdx * 17.0;

    // Bullet in LK Orange
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19.0);
    doc.setTextColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
    doc.text("•", 38.0, curSrvY);

    // Service name in slate bold
    doc.setFontSize(18.5);
    doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
    const maxSrvW = 200.0;
    const lines = doc.splitTextToSize(name, maxSrvW);
    if (lines.length > 1) {
      doc.text(lines[0], 44.0, curSrvY - 2.0);
      doc.setFontSize(16.0);
      doc.text(lines[1], 44.0, curSrvY + 4.0);
    } else {
      doc.text(lines[0], 44.0, curSrvY);
    }
  });

  // Services Subtotal Pill
  const srvPillY = 173.0;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.4);
  doc.roundedRect(36.0, srvPillY, 96.0, 11.5, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("SERVICES RELATED COST", 40.0, srvPillY + 7.5);

  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.roundedRect(134.0, srvPillY, 114.0, 11.5, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.0);
  doc.setTextColor(255, 255, 255);
  doc.text(formatLkr(srvTotal), 191.0, srvPillY + 7.8, { align: "center" });

  // --- 3. RIGHT SIDE CARDS (Lead Time, Warranty, Optional Commercial Note) ---
  // Lead Time Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.4);
  doc.roundedRect(266.0, 36.0, 100.0, 52.0, 3.5, 3.5, "FD");
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(266.0, 36.0, 100.0, 12.5, 3.5, 3.5, "F");
  doc.rect(266.0, 44.5, 100.0, 4.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("PROJECT ESTIMATED LEAD TIME", 316.0, 44.5, { align: "center" });
  doc.setDrawColor(218, 226, 237);
  doc.line(266.0, 48.5, 366.0, 48.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23.0);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(data.leadTime || "10 Working Days", 316.0, 68.0, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Commences upon purchase order & advance confirmation", 316.0, 80.0, { align: "center" });

  // Warranty Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 226, 237);
  doc.roundedRect(374.0, 36.0, 100.0, 52.0, 3.5, 3.5, "FD");
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(374.0, 36.0, 100.0, 12.5, 3.5, 3.5, "F");
  doc.rect(374.0, 44.5, 100.0, 4.0, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("WARRANTY", 424.0, 44.5, { align: "center" });
  doc.setDrawColor(218, 226, 237);
  doc.line(374.0, 48.5, 474.0, 48.5);

  const badgeImg = bgs.warrantyBadge || WARRANTY_BADGE_BASE64;
  if (badgeImg) {
    try {
      doc.addImage(badgeImg, "PNG", 379.0, 52.5, 33.0, 22.9, undefined, "FAST");
    } catch {
      try {
        doc.addImage(badgeImg, "JPEG", 379.0, 52.5, 33.0, 22.9, undefined, "FAST");
      } catch (err) {
        console.warn("Failed to render warranty badge:", err);
      }
    }
  }

  const warrantyTextCenterX = badgeImg ? 443.0 : 424.0;
  const warrantyTextMaxW = badgeImg ? 58.0 : 90.0;
  const warrantyVal = (data.warranty || "1 Year").trim();
  const warrantyFontSize = warrantyVal.length > 14 ? 16.0 : warrantyVal.length > 9 ? 19.0 : 24.0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(warrantyFontSize);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(warrantyVal, warrantyTextCenterX, 66.0, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.0);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  const subLines = doc.splitTextToSize("Manufacturer fault warranty as stated in quotation terms", warrantyTextMaxW);
  doc.text(subLines, warrantyTextCenterX, 75.0, { align: "center", lineHeightFactor: 1.22 });

  // Resolve commercial / warranty exclusion note (Only show box if note is provided)
  let commercialNoteText: string | null = null;
  if (data.commercialNote && data.commercialNote.trim()) {
    commercialNoteText = data.commercialNote.trim();
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try { specsObj = JSON.parse(data.technicalSpecs); } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj?.commercialNote && typeof specsObj.commercialNote === "string" && specsObj.commercialNote.trim()) {
      commercialNoteText = specsObj.commercialNote.trim();
    }
  }

  if (commercialNoteText) {
    const boxX = 266.0;
    const boxY = 96.0;
    const boxW = 208.0;
    const boxH = 90.0;

    // Outer Card Frame with clean subtle accent border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(245, 158, 11); // Amber accent border
    doc.setLineWidth(0.6);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3.5, 3.5, "FD");

    // Card Header Banner
    doc.setFillColor(254, 243, 199); // Amber-100 soft background
    doc.roundedRect(boxX, boxY, boxW, 13.0, 3.5, 3.5, "F");
    doc.rect(boxX, boxY + 8.0, boxW, 5.0, "F");
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.4);
    doc.line(boxX, boxY + 13.0, boxX + boxW, boxY + 13.0);

    // Header Title
    const isWarrantyExclusion = /warranty\s*exclusion/i.test(commercialNoteText);
    const boxTitle = isWarrantyExclusion
      ? "WARRANTY EXCLUSION & OPERATIONAL CONDITIONS"
      : "SPECIAL OPERATIONAL NOTES & CONDITIONS";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text(boxTitle, boxX + 8.0, boxY + 9.0);

    // Render tokens inside box
    const noteTokens = parseSlideTokens(commercialNoteText);
    let curX = boxX + 8.0;
    let curY = boxY + 22.0;
    const startX = boxX + 8.0;
    const maxW = boxW - 16.0;
    const fontSize = 12.0;
    const lineSpacing = 6.4;
    const maxNoteY = boxY + boxH - 5.0;

    noteTokens.forEach((wObj, wIdx) => {
      doc.setFont("helvetica", wObj.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const wordW = doc.getTextWidth(wObj.word);
      const spaceW = doc.getTextWidth(" ");

      if (curX + wordW > startX + maxW) {
        curY += lineSpacing;
        curX = startX;
      }

      if (curY <= maxNoteY) {
        if (wObj.highlight) {
          const nextWord = noteTokens[wIdx + 1];
          const hasContinuousHl =
            nextWord &&
            nextWord.highlight &&
            curX + wordW + spaceW <= startX + maxW;
          const hlW = hasContinuousHl ? wordW + spaceW + 0.8 : wordW + 0.8;
          doc.setFillColor(255, 255, 0); // Yellow #FFFF00
          doc.rect(curX - 0.4, curY - fontSize * 0.28, hlW, fontSize * 0.36, "F");
        }

        if (wObj.color) {
          doc.setTextColor(wObj.color[0], wObj.color[1], wObj.color[2]);
        } else if (wObj.bold) {
          doc.setTextColor(180, 83, 9); // Amber-700
        } else {
          doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
        }

        doc.text(wObj.word, curX, curY);

        if (wObj.underline) {
          doc.setDrawColor(245, 158, 11);
          doc.setLineWidth(0.4);
          doc.line(curX, curY + 0.8, curX + wordW, curY + 0.8);
        }
      }

      curX += wordW + spaceW;
    });
  }

  // --- 4. GRAND TOTAL INVESTMENT BAR (Bottom Full Width) ---
  const totalBarY = 196.0;
  doc.setFillColor(241, 248, 249);
  doc.setDrawColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.setLineWidth(0.9);
  doc.roundedRect(36.0, totalBarY, 438.0, 34.0, 4.5, 4.5, "FD");

  // Left Section of Total Bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("COMMERCIAL INVESTMENT SCHEDULE", 48.0, totalBarY + 12.0);
  doc.setFontSize(18.0);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("TOTAL PROJECT INVESTMENT", 48.0, totalBarY + 24.0);

  // Separator Line
  doc.setDrawColor(218, 226, 237);
  doc.setLineWidth(0.6);
  doc.line(175.0, totalBarY + 5.0, 175.0, totalBarY + 29.0);

  // Grand Total Amount (Massive LK Teal)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(42.0);
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text(formatLkr(grandTotal), 325.0, totalBarY + 24.0, { align: "center" });

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

  // Resolve custom bank account for Slide 5
  let activeProposalBank = LK_TRONICS_BANK_DETAILS;
  if (data.bankDetails) {
    activeProposalBank = {
      accountName: data.bankDetails.accountName || LK_TRONICS_BANK_DETAILS.accountName,
      accountNumber: data.bankDetails.accountNumber || LK_TRONICS_BANK_DETAILS.accountNumber,
      bankName: data.bankDetails.bankName || LK_TRONICS_BANK_DETAILS.bankName,
      branch: data.bankDetails.branch || LK_TRONICS_BANK_DETAILS.branch,
    };
  } else if (data.technicalSpecs) {
    let specsObj: any = null;
    if (typeof data.technicalSpecs === "string") {
      try { specsObj = JSON.parse(data.technicalSpecs); } catch {}
    } else if (typeof data.technicalSpecs === "object") {
      specsObj = data.technicalSpecs;
    }
    if (specsObj && specsObj.bankDetails) {
      activeProposalBank = {
        accountName: specsObj.bankDetails.accountName || LK_TRONICS_BANK_DETAILS.accountName,
        accountNumber: specsObj.bankDetails.accountNumber || LK_TRONICS_BANK_DETAILS.accountNumber,
        bankName: specsObj.bankDetails.bankName || LK_TRONICS_BANK_DETAILS.bankName,
        branch: specsObj.bankDetails.branch || LK_TRONICS_BANK_DETAILS.branch,
      };
    }
  }

  const isCustomProposalBank =
    activeProposalBank.accountNumber !== LK_TRONICS_BANK_DETAILS.accountNumber ||
    activeProposalBank.bankName !== LK_TRONICS_BANK_DETAILS.bankName;

  if (isCustomProposalBank) {
    // Redraw Right Content Area of Bank Card on Slide 5
    const bankRightX = 155.0;
    const bankRightY = 126.0;
    const bankRightW = 316.0;
    const bankRightH = 105.0;

    doc.setFillColor(255, 255, 255);
    doc.rect(bankRightX, bankRightY, bankRightW, bankRightH, "F");

    let bankRowY = bankRightY + 12.0;
    const bankFields = [
      { label: "Account Name", val: activeProposalBank.accountName, color: LK_TEAL },
      { label: "Account Number", val: activeProposalBank.accountNumber, color: LK_ORANGE },
      { label: "Bank Name", val: activeProposalBank.bankName, color: LK_SLATE },
      { label: "Bank Branch", val: activeProposalBank.branch, color: LK_SLATE },
    ];

    bankFields.forEach((field, fIdx) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13.5);
      doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
      doc.text(field.label, bankRightX + 10.0, bankRowY + 3.0);
      doc.text(":", bankRightX + 70.0, bankRowY + 3.0);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14.0);
      doc.setTextColor(field.color[0], field.color[1], field.color[2]);
      doc.text(field.val, bankRightX + 80.0, bankRowY + 3.0);

      if (fIdx < bankFields.length - 1) {
        doc.setDrawColor(218, 225, 233);
        doc.setLineWidth(0.3);
        doc.line(bankRightX + 10.0, bankRowY + 13.0, bankRightX + bankRightW - 10.0, bankRowY + 13.0);
      }
      bankRowY += 22.0;
    });
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

  // Combine any additional terms ON TOP of the 6 fixed default terms
  const termsList = getProjectProposalCombinedTerms(
    data.termsAndConditions,
    data.validityDays || 4
  );

  let termY = 48.0;
  const maxTermY = 250.0;

  // Resolve terms font size (from data or technicalSpecs)
  let customTermsFontSize: number | null = null;
  if (data.termsFontSize != null) {
    const s = Number(data.termsFontSize);
    if (!isNaN(s) && s >= 9 && s <= 30) {
      customTermsFontSize = s;
    }
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
      if (!isNaN(s) && s >= 9 && s <= 30) {
        customTermsFontSize = s;
      }
    }
  }

  // Auto-fit font size if at default 22.0 or unspecified so all terms fit on Slide 6 when possible
  const availableH = maxTermY - 48.0; // ~202.0mm
  let chosenTermsFontSize = customTermsFontSize || 22.0;

  if (!customTermsFontSize || customTermsFontSize === 22.0) {
    const candidateSizes = [22.0, 20.0, 18.5, 17.0, 16.0];
    for (const testSize of candidateSizes) {
      const testSpacing = testSize * 0.45;
      const testPad = testSize * 0.35;
      doc.setFontSize(testSize);
      let totalEstimatedH = 0;
      for (const t of termsList) {
        const cleanT = t.replace(/^(\d+[\.\)]|\•|\-)\s*/, "").trim();
        const lines = doc.splitTextToSize(cleanT, 426.0);
        const lCount = Array.isArray(lines) ? lines.length : 1;
        totalEstimatedH += lCount * testSpacing + testPad;
      }
      if (totalEstimatedH <= availableH) {
        chosenTermsFontSize = testSize;
        break;
      }
      chosenTermsFontSize = testSize;
    }
  }

  const fontSize = chosenTermsFontSize;
  const lineSpacing = fontSize * 0.45;
  const termPadding = fontSize * 0.35;

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

    // Estimate height of this full term to prevent awkward orphan line splits across pages
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const fullTermText = titlePart ? `${titlePart} ${bodyPart}` : cleanTerm;
    const termLines = doc.splitTextToSize(fullTermText, 426.0);
    const lineCount = Array.isArray(termLines) ? termLines.length : 1;
    const termHeight = lineCount * lineSpacing;

    if (termY + termHeight > maxTermY && termY > 55.0) {
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

    let curX = 44.0;
    const startX = 44.0;
    const maxW = 426.0;

    if (titlePart) {
      // Bold LK Teal title prefix
      doc.setFont("helvetica", "bold");
      doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
      doc.text(titlePart, curX, termY);
      curX += doc.getTextWidth(titlePart) + doc.getTextWidth(" ") + 1.2;
    }

    const termWords = parseSlideTokens(titlePart ? bodyPart : cleanTerm);
    termWords.forEach((wObj, wIdx) => {
      doc.setFont("helvetica", wObj.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const wordW = doc.getTextWidth(wObj.word);
      const spaceW = doc.getTextWidth(" ");

      if (curX + wordW > startX + maxW) {
        termY += lineSpacing;
        curX = startX;
        if (termY > maxTermY) {
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
      }

      // Draw yellow highlight rectangle behind text if highlighted
      if (wObj.highlight) {
        const nextWord = termWords[wIdx + 1];
        const hasContinuousHl =
          nextWord &&
          nextWord.highlight &&
          curX + wordW + spaceW <= startX + maxW;
        const hlW = hasContinuousHl ? wordW + spaceW + 0.8 : wordW + 0.8;
        doc.setFillColor(255, 255, 0); // Bright Yellow #FFFF00
        doc.rect(curX - 0.4, termY - fontSize * 0.28, hlW, fontSize * 0.36, "F");
      }

      if (wObj.color) {
        doc.setTextColor(wObj.color[0], wObj.color[1], wObj.color[2]);
      } else if (wObj.bold) {
        doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
      } else {
        doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      }

      doc.text(wObj.word, curX, termY);

      if (wObj.underline) {
        doc.setDrawColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
        doc.setLineWidth(0.4);
        doc.line(curX, termY + 0.8, curX + wordW, termY + 0.8);
      }

      curX += wordW + spaceW;
    });

    termY += lineSpacing + termPadding;
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
      warrantyBadge,
    ] = await Promise.all([
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide1_cover.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide2_intro.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide3_design.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide4_pricing.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide5_bank.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide6_terms.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide7_clients.png"),
      loadImageAsBase64("/template_assets/pptx_slides/brand_slide8_partners.png"),
      loadImageAsBase64("/template_assets/logos/warranty_badge.png"),
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
      warrantyBadge: warrantyBadge || WARRANTY_BADGE_BASE64,
    });
  } else {
    const bgBase64 = await loadImageAsBase64("/template_assets/rd_3d_letterhead.jpg");
    return await generateHardwareOrPcbPdf(data, bgBase64);
  }
}
