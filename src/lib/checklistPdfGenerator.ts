import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ProductChecklist } from "@/lib/productChecklist";
import { loadImageAsBase64 } from "@/lib/quotationPdfGenerator";

/**
 * LK TRONICS Official Brand Color Palette (matching Project Proposal & R&D Corporate Identity)
 */
const LK_TEAL: [number, number, number] = [26, 91, 102]; // #1A5B66 (Deep industrial teal)
const LK_ORANGE: [number, number, number] = [234, 138, 26]; // #EA8A1A (Vibrant circuit orange)
const LK_SLATE: [number, number, number] = [17, 24, 39]; // #111827 (Executive charcoal slate)
const LK_MUTED: [number, number, number] = [100, 116, 139]; // #64748B (Titanium slate)
const LK_BORDER: [number, number, number] = [226, 232, 240]; // #E2E8F0 (Subtle slate border)
const LK_BG_LIGHT: [number, number, number] = [248, 250, 252]; // #F8FAFC (Soft card fill)

/**
 * Draws a clean vector checkmark icon
 */
function drawCheckmark(
  doc: jsPDF,
  x: number,
  y: number,
  size: number = 2.4,
  color: [number, number, number] = [22, 101, 52]
): void {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.45);
  doc.line(x, y - size * 0.1, x + size * 0.35, y + size * 0.35);
  doc.line(x + size * 0.35, y + size * 0.35, x + size * 0.95, y - size * 0.55);
}

/**
 * Draws a clean vector cross / fail icon
 */
function drawCross(
  doc: jsPDF,
  x: number,
  y: number,
  size: number = 2.4
): void {
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.45);
  doc.line(x, y - size * 0.4, x + size * 0.8, y + size * 0.4);
  doc.line(x + size * 0.8, y - size * 0.4, x, y + size * 0.4);
}

/**
 * Generates an official LK Tronics Product Checklist PDF using the modern R&D Brand Template
 */
export async function generateChecklistPdf(checklist: ProductChecklist): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  doc.setFont("helvetica", "normal");

  // Load official LK Tronics branding logo (Transparent PNG preferred, RGB fallback)
  let logoBase64 = await loadImageAsBase64("/template_assets/logos/footer/lk_tronics.png");
  if (!logoBase64) {
    logoBase64 = await loadImageAsBase64("/template_assets/lk_tronics_logo.png");
  }

  // ================= 1. TOP INDUSTRIAL ACCENT BARS =================
  // Upper Teal Bar
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.rect(0, 0, 210, 5.0, "F");

  // Lower Orange Accent Line (matching Project Proposal style)
  doc.setFillColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.rect(0, 5.0, 210, 1.2, "F");

  // Header Bar Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(240, 253, 250);
  doc.text("LK TRONICS TRADING (PVT) LTD • R&D DIVISION • QUALITY ASSURANCE & TESTING LAB", 10, 3.6);
  doc.text("TEL: 011 4 215 515 | REG NO - P-V 00336036", 200, 3.6, { align: "right" });

  // ================= 2. BRANDED HEADER & METADATA CARD =================
  // LK Tronics Corporate Logo (Left)
  if (logoBase64) {
    try {
      const format = logoBase64.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(logoBase64, format, 10, 8.2, 21, 18.7, undefined, "FAST");
    } catch {}
  }

  const typeLabel = checklist.type === "BATTERY" ? "BATTERY" : "INVERTER";

  // Document Title & Division Info (Middle) - 2 Clean lines to guarantee ZERO overlay with detail box
  const titleX = logoBase64 ? 34 : 10;
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PRODUCT TECHNICAL & QC", titleX, 13.0);
  doc.text("INSPECTION CHECKLIST", titleX, 17.8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text(`HARDWARE VERIFICATION REPORT • ${typeLabel} SERIES`, titleX, 22.8);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("LK Tronics Industrial Testing Facility • Homagama, Sri Lanka", titleX, 27.2);

  // Metadata Card (Top Right) - Crisp rectangle, NO RADIUS (as requested)
  const metaBoxX = 125;
  const metaBoxY = 7.5;
  const metaBoxW = 75;
  const metaBoxH = 24.5;

  doc.setFillColor(LK_BG_LIGHT[0], LK_BG_LIGHT[1], LK_BG_LIGHT[2]);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.rect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, "FD"); // Sharp rectangle, no radius

  const arrivedDate = checklist.type === "BATTERY"
    ? checklist.batteryInfo?.arrivedDate || "-"
    : checklist.inverterInfo?.arrivedDate || "-";

  // Checklist Ref No
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Ref No:", metaBoxX + 3.5, metaBoxY + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(checklist.checklistNo || "QC-DRAFT", metaBoxX + 20, metaBoxY + 4.5);

  // Arrived Date
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Arrived:", metaBoxX + 3.5, metaBoxY + 8.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(arrivedDate, metaBoxX + 20, metaBoxY + 8.8);

  // Checked Date
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Checked:", metaBoxX + 3.5, metaBoxY + 13.0);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(checklist.checkedDate || new Date().toISOString().split("T")[0], metaBoxX + 20, metaBoxY + 13.0);

  // Inspector Name
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("Inspector:", metaBoxX + 3.5, metaBoxY + 17.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(checklist.checkedByName || "R&D Inspection Engineer", metaBoxX + 20, metaBoxY + 17.2);

  // Overall QC Badge (Sharp rectangle, improved 'PASSED' without '/ OK')
  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("QC Status:", metaBoxX + 3.5, metaBoxY + 22.0);

  const badgeX = metaBoxX + 20;
  const badgeY = metaBoxY + 18.8;
  const badgeW = 51.5;
  const badgeH = 4.2;

  if (checklist.overallQcPassed) {
    doc.setFillColor(220, 252, 231); // emerald-100
    doc.setDrawColor(22, 163, 74); // emerald-600
    doc.rect(badgeX, badgeY, badgeW, badgeH, "FD"); // Sharp rectangle, no radius
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("PASSED", badgeX + badgeW / 2, badgeY + 3.1, { align: "center" });
  } else {
    doc.setFillColor(254, 226, 226); // red-100
    doc.setDrawColor(220, 38, 38); // red-600
    doc.rect(badgeX, badgeY, badgeW, badgeH, "FD"); // Sharp rectangle, no radius
    doc.setTextColor(153, 27, 27); // red-800
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("FAILED", badgeX + badgeW / 2, badgeY + 3.1, { align: "center" });
  }

  // Divider Line with Orange Accent Pip
  doc.setDrawColor(LK_BORDER[0], LK_BORDER[1], LK_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(10, 33.2, 200, 33.2);
  doc.setFillColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.rect(10, 32.8, 28, 0.8, "F");

  // ================= 3. SECTION 1: PRODUCT INFORMATION =================
  let curY = 36.0;

  // Section Header Banner (LK Teal with Orange pip)
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.rect(10, curY, 190, 5.5, "F");
  doc.setFillColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.rect(10, curY, 2.5, 5.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(
    `1. ${typeLabel} IDENTIFICATION & ARRIVAL INFORMATION`,
    15,
    curY + 3.9
  );

  curY += 5.5;

  // Information Table Rows
  const infoRows: Array<[string, string, string, string]> = [];

  if (checklist.type === "BATTERY") {
    const b = checklist.batteryInfo;
    const hasBatteryMismatch = Boolean(
      b?.serialNumberBattery &&
      b?.serialNumberBox &&
      b.serialNumberBattery.trim() !== b.serialNumberBox.trim()
    );
    const batSerialDisplay = b?.serialNumberBattery
      ? hasBatteryMismatch
        ? `${b.serialNumberBattery} [MISMATCH]`
        : b.serialNumberBattery
      : "N/A";
    const boxSerialDisplay = b?.serialNumberBox
      ? hasBatteryMismatch
        ? `${b.serialNumberBox} [MISMATCH]`
        : b.serialNumberBox
      : "N/A";

    infoRows.push([
      "Product Category:",
      "Rechargeable Energy Storage (Battery)",
      "Arrived Date:",
      b?.arrivedDate || "-",
    ]);
    infoRows.push([
      "Model Number:",
      b?.modelNumber || "Not Specified",
      "MAC Address:",
      b?.macAddress || "N/A",
    ]);
    infoRows.push([
      "Serial Number (Box):",
      boxSerialDisplay,
      "Serial Number (Battery):",
      batSerialDisplay,
    ]);
    infoRows.push([
      "Battery Input:",
      b?.batteryInput || "Not Specified",
      "Physical Damage:",
      b?.physicalDamage || "None / No physical damage observed",
    ]);
  } else {
    const inv = checklist.inverterInfo;
    const invSerial = inv?.serialNumberInverter || inv?.serialNumber || "";
    const boxSerial = inv?.serialNumberBox || "";
    const hasInverterMismatch = Boolean(
      invSerial &&
      boxSerial &&
      invSerial.trim() !== boxSerial.trim()
    );
    const invSerialDisplay = invSerial
      ? hasInverterMismatch
        ? `${invSerial} [MISMATCH]`
        : invSerial
      : "N/A";
    const boxSerialDisplay = boxSerial
      ? hasInverterMismatch
        ? `${boxSerial} [MISMATCH]`
        : boxSerial
      : "N/A";

    infoRows.push([
      "Product Category:",
      "Power Inverter / Hybrid Controller",
      "Arrived Date:",
      inv?.arrivedDate || "-",
    ]);
    infoRows.push([
      "Model Number:",
      inv?.modelNumber || "Not Specified",
      "Battery System:",
      inv?.batterySystem || "48V DC",
    ]);
    infoRows.push([
      "Serial Number (Box):",
      boxSerialDisplay,
      "Serial Number (Inverter):",
      invSerialDisplay,
    ]);
    infoRows.push([
      "Physical Damage Assessment:",
      inv?.physicalDamage || "None / No physical damage observed",
      "",
      "",
    ]);
  }

  autoTable(doc, {
    startY: curY,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.5,
      textColor: [LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]],
      lineColor: [LK_BORDER[0], LK_BORDER[1], LK_BORDER[2]],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, fillColor: [LK_BG_LIGHT[0], LK_BG_LIGHT[1], LK_BG_LIGHT[2]], textColor: [LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]] },
      1: { cellWidth: 53 },
      2: { fontStyle: "bold", cellWidth: 42, fillColor: [LK_BG_LIGHT[0], LK_BG_LIGHT[1], LK_BG_LIGHT[2]], textColor: [LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]] },
      3: { cellWidth: 53 },
    },
    didParseCell: (dataHook) => {
      const text = String(dataHook.cell.raw || "");
      if (text.includes("[MISMATCH]")) {
        dataHook.cell.styles.textColor = [220, 38, 38];
        dataHook.cell.styles.fontStyle = "bold";
      }
    },
    body: infoRows.map((row) => {
      if (!row[2] && !row[3]) {
        return [
          { content: row[0], styles: { fontStyle: "bold", textColor: [LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]] } },
          { content: row[1], colSpan: 3 },
          "",
          "",
        ];
      }
      return row;
    }),
    margin: { left: 10, right: 10 },
  });

  // ================= 4. SECTION 2: TEST & INSPECTION CHECKLIST =================
  const lastTable = (doc as any).lastAutoTable;
  curY = (lastTable ? lastTable.finalY : curY + 26) + 3.5;

  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.rect(10, curY, 190, 5.5, "F");
  doc.setFillColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.rect(10, curY, 2.5, 5.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`2. FUNCTIONAL & SAFETY VERIFICATION PARAMETERS`, 15, curY + 3.9);

  curY += 5.5;

  const testBody = checklist.tests.map((t, idx) => {
    const statusText = t.passed ? "PASSED" : "FAILED";
    return [
      String(idx + 1).padStart(2, "0"),
      t.label,
      statusText,
      t.comment || (t.passed ? "Verified OK" : "Requires attention"),
    ];
  });

  autoTable(doc, {
    startY: curY,
    theme: "striped",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]],
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 1.6,
    },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.6,
      textColor: [LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]],
      lineColor: [LK_BORDER[0], LK_BORDER[1], LK_BORDER[2]],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold", textColor: [LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]] },
      1: { cellWidth: 52, fontStyle: "bold" },
      2: { cellWidth: 26, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 102 },
    },
    head: [["#", "Test / Inspection Parameter", "Result", "Technical Remarks & Observations"]],
    body: testBody,
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const item = checklist.tests[data.row.index];
        if (item) {
          const posX = data.cell.x + 3.5;
          const posY = data.cell.y + data.cell.height / 2;
          if (item.passed) {
            drawCheckmark(doc, posX, posY, 2.2, [22, 101, 52]);
          } else {
            drawCross(doc, posX, posY, 2.2);
          }
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  const testTable = (doc as any).lastAutoTable;
  curY = (testTable ? testTable.finalY : curY + 45) + 3.5;

  // ================= 5. SECTION 3: TECHNICAL NOTES & SPECIAL OBSERVATIONS =================
  // Header Banner: LK Teal (matching other sections, as requested)
  doc.setFillColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.rect(10, curY, 190, 5.5, "F");
  doc.setFillColor(LK_ORANGE[0], LK_ORANGE[1], LK_ORANGE[2]);
  doc.rect(10, curY, 2.5, 5.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`3. TECHNICAL NOTES & SPECIAL OBSERVATIONS`, 15, curY + 3.9);

  curY += 5.5;

  // Render Additional Notes Box - Sharp rectangle (no radius)
  const notesCount = checklist.additionalNotes?.length || 0;
  const boxHeight = Math.max(18, notesCount * 5.4 + 6);

  doc.setFillColor(LK_BG_LIGHT[0], LK_BG_LIGHT[1], LK_BG_LIGHT[2]);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(10, curY, 190, boxHeight, "FD"); // Sharp rectangle, no radius

  let noteY = curY + 4.8;
  if (!checklist.additionalNotes || checklist.additionalNotes.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
    doc.text("• No additional defects or observations noted during inspection.", 15, noteY);
  } else {
    checklist.additionalNotes.forEach((n) => {
      doc.setFont("helvetica", n.bold ? "bold" : "normal");
      doc.setFontSize(8);

      // Bullet color indicator
      let bulletR = LK_TEAL[0], bulletG = LK_TEAL[1], bulletB = LK_TEAL[2];
      if (n.color === "red") { bulletR = 220; bulletG = 38; bulletB = 38; }
      else if (n.color === "amber") { bulletR = 217; bulletG = 119; bulletB = 6; }
      else if (n.color === "green") { bulletR = 22; bulletG = 163; bulletB = 74; }
      else if (n.color === "blue") { bulletR = 37; bulletG = 99; bulletB = 235; }

      // Optional highlight pill background (sharp rectangle)
      if (n.highlight) {
        doc.setFillColor(254, 240, 138); // yellow-200
        const textWidth = doc.getTextWidth(`•  ${n.text}`);
        doc.rect(14, noteY - 3.0, Math.min(180, textWidth + 3), 4.2, "F");
      }

      doc.setTextColor(bulletR, bulletG, bulletB);
      doc.text("•", 15, noteY);

      if (n.color && n.color !== "default") {
        doc.setTextColor(bulletR, bulletG, bulletB);
      } else {
        doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
      }

      doc.text(n.text, 20, noteY);
      noteY += 5.2;
    });
  }

  curY += boxHeight + 4.5;

  // ================= 4. INSPECTION & VERIFICATION DETAILS (CLEAN TEXT ONLY, NO BOXES) =================
  // Left: Inspected & Tested By
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("INSPECTED & TESTED BY:", 12, curY + 4.0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(checklist.checkedByName || "R&D Inspection Engineer", 12, curY + 9.2);

  // Right: Verification Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text("VERIFICATION DATE:", 112, curY + 4.0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(LK_SLATE[0], LK_SLATE[1], LK_SLATE[2]);
  doc.text(checklist.checkedDate || arrivedDate, 112, curY + 9.2);

  // ================= 6. FOOTER =================
  doc.setDrawColor(LK_BORDER[0], LK_BORDER[1], LK_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(10, 283, 200, 283);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(LK_MUTED[0], LK_MUTED[1], LK_MUTED[2]);
  doc.text(
    "This technical report certifies inspection conditions at the time of testing. Generated by LK Tronics PMS Enterprise System.",
    10,
    287.5
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(LK_TEAL[0], LK_TEAL[1], LK_TEAL[2]);
  doc.text("Page 1 of 1", 200, 287.5, { align: "right" });

  return doc;
}
