import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Product Management System (PMS)";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Supplier Quotation Example", {
      views: [{ state: "frozen", ySplit: 5 }],
    });

    // 13 Columns matching pending export & supply upload expectations (with Quantity column)
    worksheet.columns = [
      { key: "productName", width: 34 },        // A: Product name
      { key: "description", width: 40 },        // B: Description
      { key: "quantity", width: 14 },           // C: Quantity
      { key: "image", width: 14 },              // D: Image
      { key: "referenceLink", width: 36 },      // E: Refrence link if available
      { key: "weight", width: 14 },             // F: Weight
      { key: "priceLKR", width: 26 },           // G: Price (LKR) without shipping chargers
      { key: "warrantyPeriod", width: 18 },     // H: Warranty Period
      { key: "priceValidity", width: 26 },      // I: Price validity(minimum 30 days expected)
      { key: "leadTime", width: 22 },           // J: Package preparation lead time
      { key: "isBrandNewOriginal", width: 20 }, // K: Brand new & original (Yes/No)?
      { key: "supplierImage", width: 20 },      // L: Supplier image
      { key: "supplierNote", width: 34 },       // M: Supplier special note
    ];

    const thinBorder = {
      top: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
      bottom: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
      left: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
      right: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
    };

    // Row 1: Spacing
    worksheet.getRow(1).height = 10;

    // Row 2: Notice Banner 1
    worksheet.mergeCells("A2:M2");
    const row2Cell = worksheet.getCell("A2");
    row2Cell.value =
      "Shipping costs are not required to be included, as we have our own freight forwarders in China.";
    row2Cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF1E293B" } };
    row2Cell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 24;

    // Row 3: Notice Banner 2
    worksheet.mergeCells("A3:M3");
    const row3Cell = worksheet.getCell("A3");
    row3Cell.value = "Kindly ensure that all details are confirmed";
    row3Cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF1E293B" } };
    row3Cell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(3).height = 22;

    // Row 4: Spacing
    worksheet.getRow(4).height = 8;

    // Row 5: Headers
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
              text: "Price (LKR)\n",
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
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF1E293B" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" }, // Slate-100 header fill
        };
      }
    });

    // Sample Rows (Prices in LKR)
    const sampleRows = [
      {
        productName: "STM32F407VGT6 Microcontroller LQFP-100",
        description: "Original ARM Cortex-M4 32-bit MCU+FPU, 168MHz, 1MB Flash",
        quantity: 1,
        image: "",
        referenceLink: "https://www.st.com/en/microcontrollers-microprocessors/stm32f407vg.html",
        weight: 0.02,
        priceLKR: 1450.0,
        warrantyPeriod: "1 Year",
        priceValidity: "30 Days",
        leadTime: "1-2 Days",
        isBrandNewOriginal: "Yes",
        supplierImage: "",
        supplierNote: "Brand new original in tape & reel. In stock.",
      },
      {
        productName: "ESP32-WROOM-32D Wi-Fi + Bluetooth Module",
        description: "Dual-core ESP32 4MB SPI flash PCB antenna module",
        quantity: 1,
        image: "",
        referenceLink: "https://www.espressif.com/en/products/modules/esp32",
        weight: 0.05,
        priceLKR: 810.0,
        warrantyPeriod: "6 Months",
        priceValidity: "45 Days",
        leadTime: "2-3 Days",
        isBrandNewOriginal: "Yes",
        supplierImage: "",
        supplierNote: "Factory sealed packaging.",
      },
      {
        productName: "ATmega328P-PU DIP-28 Microchip",
        description: "8-bit AVR Microcontroller with 32K Bytes In-System Programmable Flash",
        quantity: 1,
        image: "",
        referenceLink: "https://www.microchip.com/en-us/product/ATmega328p",
        weight: 0.01,
        priceLKR: 0, // Demonstrates zero price for Price Not Available
        warrantyPeriod: "—",
        priceValidity: "—",
        leadTime: "—",
        isBrandNewOriginal: "Yes",
        supplierImage: "",
        supplierNote: "Temporarily out of stock (Price 0 marks Price Not Available)",
      },
    ];

    sampleRows.forEach((item, index) => {
      const rowNumber = 6 + index;
      const row = worksheet.getRow(rowNumber);
      row.height = 42;

      // Col A: Product name
      const cellA = row.getCell(1);
      cellA.value = item.productName;
      cellA.font = { name: "Segoe UI", size: 10, bold: true };
      cellA.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col B: Description
      const cellB = row.getCell(2);
      cellB.value = item.description;
      cellB.font = { name: "Segoe UI", size: 9.5 };
      cellB.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col C: Quantity
      const cellC = row.getCell(3);
      cellC.value = item.quantity;
      cellC.font = { name: "Segoe UI", size: 10, bold: true };
      cellC.alignment = { vertical: "middle", horizontal: "center" };

      // Col D: Image
      const cellD = row.getCell(4);
      cellD.value = "";
      cellD.alignment = { vertical: "middle", horizontal: "center" };

      // Col E: Refrence link
      const cellE = row.getCell(5);
      cellE.value = {
        text: item.referenceLink,
        hyperlink: item.referenceLink,
      };
      cellE.font = { name: "Segoe UI", size: 9, color: { argb: "FF0000EE" }, underline: true };
      cellE.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      // Col F: Weight
      const cellF = row.getCell(6);
      cellF.value = item.weight;
      cellF.font = { name: "Segoe UI", size: 9.5 };
      cellF.alignment = { vertical: "middle", horizontal: "center" };

      // Col G: Price in LKR
      const cellG = row.getCell(7);
      cellG.value = item.priceLKR;
      cellG.numFmt = '#,##0.00';
      cellG.font = { name: "Segoe UI", size: 10, bold: true };
      cellG.alignment = { vertical: "middle", horizontal: "right" };
      cellG.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" }, // Bright Yellow
      };

      // Col H: Warranty Period
      const cellH = row.getCell(8);
      cellH.value = item.warrantyPeriod;
      cellH.font = { name: "Segoe UI", size: 9.5 };
      cellH.alignment = { vertical: "middle", horizontal: "center" };

      // Col I: Price validity
      const cellI = row.getCell(9);
      cellI.value = item.priceValidity;
      cellI.font = { name: "Segoe UI", size: 9.5 };
      cellI.alignment = { vertical: "middle", horizontal: "center" };

      // Col J: Lead time
      const cellJ = row.getCell(10);
      cellJ.value = item.leadTime;
      cellJ.font = { name: "Segoe UI", size: 9.5 };
      cellJ.alignment = { vertical: "middle", horizontal: "center" };

      // Col K: Brand new original
      const cellK = row.getCell(11);
      cellK.value = item.isBrandNewOriginal;
      cellK.font = { name: "Segoe UI", size: 9.5 };
      cellK.alignment = { vertical: "middle", horizontal: "center" };

      // Col L: Supplier image
      const cellL = row.getCell(12);
      cellL.value = item.supplierImage;
      cellL.font = { name: "Segoe UI", size: 9.5 };
      cellL.alignment = { vertical: "middle", horizontal: "center" };

      // Col M: Supplier note
      const cellM = row.getCell(13);
      cellM.value = item.supplierNote;
      cellM.font = { name: "Segoe UI", size: 9.5 };
      cellM.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      for (let c = 1; c <= 13; c++) {
        row.getCell(c).border = thinBorder;
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = "PMS_Supplier_Quotation_Example_Template.xlsx";

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
    console.error("Error generating sample Excel template:", error);
    return NextResponse.json(
      { error: "Failed to generate example Excel template." },
      { status: 500 }
    );
  }
}
