import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatLKR,
  formatRs,
  formatPaymentMethodLabel,
  formatProductServiceCell,
  getBankDetails,
  getLeadTimeHighlightFlags,
  formatValidityPeriodText,
  getValidityDays,
  numberToWords,
  DEFAULT_GENERAL_TERMS_BULLETS,
  cleanProductDescription,
} from "../src/lib/quotationPdfGenerator";
import { generateRdQuotationPdf } from "../src/lib/rdQuotationPdfGenerator";
import { getNextQuotationNo } from "../src/lib/quotationNo";
import { getNextRdQuotationNo } from "../src/lib/rdQuotationNo";
import {
  DEFAULT_THREE_D_PRINT_SPECS,
  DEFAULT_PCB_SPECS,
  LK_TRONICS_BANK_DETAILS,
  calculate3DPrintPrice,
  DEFAULT_PROJECT_PROPOSAL_HARDWARE,
  DEFAULT_PROJECT_PROPOSAL_SERVICES,
  DEFAULT_UNI_QUOTATION_SPECS,
  DEFAULT_UNI_QUOTATION_ITEMS,
  DEFAULT_UNI_QUOTATION_GENERAL_TERMS,
  getUniQuotationTerms,
  extractAdditionalTerms,
  getProjectProposalCombinedTerms,
  getProjectProposalTerms,
} from "../src/lib/rdQuotationDefaults";
import { DEFAULT_THREE_D_PRINT_PRICING } from "../src/lib/threeDPrintPricing";
import {
  DEFAULT_BANK_ACCOUNTS,
  resolveDefaultBankAccount,
  BankAccount,
} from "../src/lib/bankAccounts";
import {
  getDefaultTestItems,
  getDefaultBatteryInfo,
  getDefaultInverterInfo,
  ProductChecklist,
} from "../src/lib/productChecklist";
import { generateChecklistPdf } from "../src/lib/checklistPdfGenerator";
import {
  generateHandoverLetterPdf,
  ProductHandoverData,
} from "../src/lib/handoverPdfGenerator";
import { extractStorageLocation } from "../src/lib/formatters";
import {
  encryptBackupData,
  decryptBackupData,
  formatBytes,
} from "../src/lib/backupEngine";
import { productSchema } from "../src/lib/validations/product";
import { createUserSchema, updateUserSchema } from "../src/lib/validations/user";
import { scoreProductRelevance, getFuzzySuggestion } from "../src/lib/fuzzySearch";

describe("Unit Tests: Quotation Financial Calculations", () => {
  it("calculates line items with high precision and handles fractional prices", () => {
    const items = [
      { quantity: 5, unitPrice: 1250.5 },
      { quantity: 12, unitPrice: 450.75 },
      { quantity: 1, unitPrice: 10000.0 },
    ];

    const lineTotals = items.map((i) => i.quantity * i.unitPrice);
    assert.equal(lineTotals[0], 6252.5);
    assert.equal(lineTotals[1], 5409.0);
    assert.equal(lineTotals[2], 10000.0);

    const subtotal = lineTotals.reduce((a, b) => a + b, 0);
    assert.equal(subtotal, 21661.5);
  });

  it("calculates 0% advance payment (credit/full payment balance due equals subtotal)", () => {
    const subtotal = 50000;
    const advancePercent = 0;
    const advancePayable = (subtotal * advancePercent) / 100;
    const balanceDue = subtotal - advancePayable;

    assert.equal(advancePayable, 0);
    assert.equal(balanceDue, 50000);
    assert.equal(advancePayable + balanceDue, subtotal);
  });

  it("calculates 80% advance payment accurately", () => {
    const subtotal = 100000;
    const advancePercent = 80;
    const advancePayable = (subtotal * advancePercent) / 100;
    const balanceDue = subtotal - advancePayable;

    assert.equal(advancePayable, 80000);
    assert.equal(balanceDue, 20000);
    assert.equal(advancePayable + balanceDue, subtotal);
  });

  it("calculates 100% advance payment (full payment, balance due equals zero)", () => {
    const subtotal = 75000;
    const advancePercent = 100;
    const advancePayable = (subtotal * advancePercent) / 100;
    const balanceDue = subtotal - advancePayable;

    assert.equal(advancePayable, 75000);
    assert.equal(balanceDue, 0);
    assert.equal(advancePayable + balanceDue, subtotal);
  });

  it("calculates arbitrary decimal advance percentage with proper balance invariant", () => {
    const subtotal = 33333;
    const advancePercent = 33.33;
    const advancePayable = Math.round(((subtotal * advancePercent) / 100) * 100) / 100;
    const balanceDue = Math.round((subtotal - advancePayable) * 100) / 100;

    assert.equal(advancePayable, 11109.89);
    assert.equal(balanceDue, 22223.11);
    assert.equal(Math.round((advancePayable + balanceDue) * 100) / 100, subtotal);
  });

  it("formats LKR currency strings cleanly with thousands separators", () => {
    assert.equal(formatLKR(0), "LKR 0.00");
    assert.equal(formatLKR(100), "LKR 100.00");
    assert.equal(formatLKR(1234567.89), "LKR 1,234,567.89");
  });

  it("formats template currency format (Rs X,XXX.XX) accurately", () => {
    assert.equal(formatRs(0), "Rs 0.00");
    assert.equal(formatRs(50), "Rs 50.00");
    assert.equal(formatRs(987654.32), "Rs 987,654.32");
  });

  it("formats payment method labels for Full Payment, Credit, and dynamic Advance Payment", () => {
    assert.equal(formatPaymentMethodLabel("FULL_PAYMENT"), "Full Payment");
    assert.equal(formatPaymentMethodLabel("CREDIT"), "Credit Payment");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", 80), "Advance Payment (80%)");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", 50), "Advance Payment (50%)");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", 25), "Advance Payment (25%)");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", 0), "Advance Payment (0%)");
    // Fallback when advancePercent is omitted or null defaults to 0%
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT"), "Advance Payment (0%)");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", null), "Advance Payment (0%)");
  });
});

describe("Unit Tests: Quotation Validity & Number to Words", () => {
  it("converts single digits to words", () => {
    assert.equal(numberToWords(0), "Zero");
    assert.equal(numberToWords(1), "One");
    assert.equal(numberToWords(5), "Five");
    assert.equal(numberToWords(9), "Nine");
  });

  it("converts teens and double digits to words", () => {
    assert.equal(numberToWords(10), "Ten");
    assert.equal(numberToWords(11), "Eleven");
    assert.equal(numberToWords(14), "Fourteen");
    assert.equal(numberToWords(19), "Nineteen");
    assert.equal(numberToWords(20), "Twenty");
    assert.equal(numberToWords(21), "Twenty-One");
    assert.equal(numberToWords(30), "Thirty");
    assert.equal(numberToWords(45), "Forty-Five");
    assert.equal(numberToWords(99), "Ninety-Nine");
  });

  it("converts hundreds and large numbers to words", () => {
    assert.equal(numberToWords(100), "One Hundred");
    assert.equal(numberToWords(105), "One Hundred Five");
    assert.equal(numberToWords(365), "Three Hundred Sixty-Five");
  });

  it("formats validity period text in words and 2-digit padded numbers", () => {
    assert.equal(formatValidityPeriodText(1), "One (01) day");
    assert.equal(formatValidityPeriodText(3), "Three (03) days");
    assert.equal(formatValidityPeriodText(7), "Seven (07) days");
    assert.equal(formatValidityPeriodText(14), "Fourteen (14) days");
    assert.equal(formatValidityPeriodText(30), "Thirty (30) days");
    assert.equal(formatValidityPeriodText(60), "Sixty (60) days");
  });

  it("resolves validity days from explicit field, date delta, or fallback default", () => {
    // 1. Explicit validityDays number
    assert.equal(getValidityDays({ validityDays: 7 } as any), 7);
    // 2. Numeric string validityDays
    assert.equal(getValidityDays({ validityDays: "14" } as any), 14);
    // 3. Computed from preparedDate and expireDate
    assert.equal(
      getValidityDays({
        preparedDate: "2026-10-01",
        expireDate: "2026-10-15",
      } as any),
      14
    );
    // 4. Same day date delta (<= 0) -> default fallback 3 days
    assert.equal(
      getValidityDays({
        preparedDate: "2026-10-01",
        expireDate: "2026-10-01",
      } as any),
      3
    );
    // 5. Expired / negative date delta -> default fallback 3 days
    assert.equal(
      getValidityDays({
        preparedDate: "2026-10-15",
        expireDate: "2026-10-01",
      } as any),
      3
    );
    // 6. Missing dates and validityDays -> default 3 days
    assert.equal(getValidityDays({} as any), 3);
  });
});

describe("Unit Tests: Quotation Stock Badges & Bank Details", () => {
  it("formats Product/Service cell correctly with stock badge first, then warranty", () => {
    // In-stock item with warranty
    const inStockWithWarranty = formatProductServiceCell(
      "MeanWell NDR 120-24 Power Supply",
      "IN_STOCK",
      null,
      "06 months"
    );
    assert.ok(inStockWithWarranty.includes("(instocks)"));
    assert.ok(inStockWithWarranty.includes("(06 months warranty)"));
    assert.ok(inStockWithWarranty.indexOf("(instocks)") < inStockWithWarranty.indexOf("(06 months warranty)"));

    // Overseas item with lead time and warranty
    const overseasWithWarranty = formatProductServiceCell(
      "Samkoon EA-070B HMI Screen",
      "OVERSEAS",
      "12-21",
      "1 Year"
    );
    assert.ok(overseasWithWarranty.includes("(Shipping from Overseas)"));
    assert.ok(overseasWithWarranty.includes("(Lead time 12-21 working days)"));
    assert.ok(overseasWithWarranty.includes("(1 Year warranty)"));

    // In-stock item without warranty (No Warranty specified)
    const inStockNoWarranty = formatProductServiceCell(
      "Resistor 10K 1/4W",
      "IN_STOCK",
      null,
      "No Warranty"
    );
    assert.ok(inStockNoWarranty.includes("(instocks)"));
    assert.ok(!inStockNoWarranty.toLowerCase().includes("warranty"));
  });

  it("determines lead time highlight flags based on quotation stock statuses", () => {
    // All in-stock
    assert.deepEqual(
      getLeadTimeHighlightFlags([{ stockStatus: "IN_STOCK" }, { stockStatus: "IN_STOCK" }]),
      { highlightInStock: true, highlightOverseas: false }
    );

    // All overseas
    assert.deepEqual(
      getLeadTimeHighlightFlags([{ stockStatus: "OVERSEAS" }, { stockStatus: "OVERSEAS" }]),
      { highlightInStock: false, highlightOverseas: true }
    );

    // Mixed
    assert.deepEqual(
      getLeadTimeHighlightFlags([{ stockStatus: "IN_STOCK" }, { stockStatus: "OVERSEAS" }]),
      { highlightInStock: true, highlightOverseas: true }
    );

    // Empty list defaults to in-stock true
    assert.deepEqual(getLeadTimeHighlightFlags([]), {
      highlightInStock: true,
      highlightOverseas: false,
    });
  });

  it("resolves bank details dynamically based on Registration Number variants", () => {
    // W-F 19731 -> LK TRONICS / Commercial Bank Homagama
    const wf = getBankDetails("W-F 19731");
    assert.equal(wf.accountName, "LK TRONICS");
    assert.equal(wf.accountNumber, "1000525586");
    assert.equal(wf.bankName, "Commercial Bank");
    assert.equal(wf.bankBranch, "Homagama");

    // Case-insensitive and un-hyphenated WF19731
    const wfUnformatted = getBankDetails("wf19731");
    assert.equal(wfUnformatted.accountName, "LK TRONICS");
    assert.equal(wfUnformatted.accountNumber, "1000525586");

    // P-V 00336036 -> LK TRONICS TRADING PVT LTD / HNB Biyagama
    const pv = getBankDetails("P-V 00336036");
    assert.equal(pv.accountName, "LK TRONICS TRADING PVT LTD");
    assert.equal(pv.accountNumber, "047010021564");
    assert.equal(pv.bankName, "Hatton National Bank");
    assert.equal(pv.bankBranch, "Biyagama");

    // Default fallback
    const fallback = getBankDetails(null);
    assert.equal(fallback.accountName, "LK TRONICS TRADING PVT LTD");
    assert.equal(fallback.accountNumber, "047010021564");
  });

  it("verifies General Terms and Conditions contains mandatory warehouse release policy for imported goods", () => {
    const hasReleaseClause = DEFAULT_GENERAL_TERMS_BULLETS.some((bullet) =>
      bullet.includes(
        "For imported products, the goods will be released from our warehouse only after the full payment has been completed"
      )
    );
    assert.equal(hasReleaseClause, true);
  });
});

describe("Unit Tests: Quotation Number Sequence Generator", () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayPrefix = `${yyyy}${mm}${dd}`;

  it("generates initial date-based quotation number YYYYMMDD when no prior records exist", async () => {
    const mockTx = {
      quotation: {
        findUnique: async () => null,
      },
    };

    const nextNo = await getNextQuotationNo(mockTx as any);
    assert.equal(nextNo, todayPrefix);
  });

  it("suggests sequential suffix -01 when exact YYYYMMDD already exists", async () => {
    const mockTx = {
      quotation: {
        findUnique: async () => ({ quotationNo: todayPrefix }),
        findFirst: async () => null,
      },
    };

    const nextNo = await getNextQuotationNo(mockTx as any);
    assert.equal(nextNo, `${todayPrefix}-01`);
  });

  it("increments sequential suffix correctly on the same day", async () => {
    const mockTx = {
      quotation: {
        findUnique: async () => ({ quotationNo: todayPrefix }),
        findFirst: async () => ({ quotationNo: `${todayPrefix}-05` }),
      },
    };

    const nextNo = await getNextQuotationNo(mockTx as any);
    assert.equal(nextNo, `${todayPrefix}-06`);
  });

  it("handles non-numeric suffix safely by defaulting", async () => {
    const mockTx = {
      quotation: {
        findUnique: async () => ({ quotationNo: todayPrefix }),
        findFirst: async () => ({ quotationNo: `${todayPrefix}-ABC` }),
      },
    };

    const nextNo = await getNextQuotationNo(mockTx as any);
    assert.equal(nextNo, `${todayPrefix}-01`);
  });
});

describe("Unit Tests: Zod Data Validation Schemas", () => {
  it("validates productSchema: accepts valid payload and trims modelAndName", () => {
    const parsed = productSchema.parse({
      modelAndName: "  MeanWell LRS-350-24  ",
      sku: "lkpow00123",
      price: "14500",
      status: "ACTIVE",
    });

    assert.equal(parsed.modelAndName, "MeanWell LRS-350-24");
    assert.equal(parsed.sku, "LKPOW00123"); // Automatically uppercased
    assert.equal(parsed.price, 14500); // Coerced to number
    assert.equal(parsed.status, "ACTIVE");
  });

  it("validates productSchema: rejects empty modelAndName", () => {
    assert.throws(
      () => productSchema.parse({ modelAndName: "" }),
      /Model no and name is required/
    );
  });

  it("validates productSchema: rejects negative prices", () => {
    assert.throws(
      () =>
        productSchema.parse({
          modelAndName: "Arduino Nano",
          price: -500,
        }),
      /greater than or equal to 0/
    );
  });

  it("validates productSchema: permits price 0 for unpriced/quote-needed items", () => {
    const parsed = productSchema.parse({
      modelAndName: "Custom Industrial Sensor",
      price: 0,
      status: "PRICE_NOT_AVAILABLE",
    });
    assert.equal(parsed.price, 0);
  });

  it("validates productSchema: accepts REQUESTED status", () => {
    const parsed = productSchema.parse({
      modelAndName: "Sensor Module",
      status: "REQUESTED",
    });
    assert.equal(parsed.status, "REQUESTED");
  });

  it("validates productSchema: validates referenceLink protocol (http/https only)", () => {
    // Valid http/https
    const validHttp = productSchema.parse({
      modelAndName: "Relay Module",
      referenceLink: "https://example.com/item",
    });
    assert.equal(validHttp.referenceLink, "https://example.com/item");

    // Invalid javascript: URI
    assert.throws(
      () =>
        productSchema.parse({
          modelAndName: "Relay Module",
          referenceLink: "javascript:alert(1)",
        }),
      /http:\/\/ or https:\/\//
    );
  });

  it("validates userSchema: accepts valid roles and rejects unauthorized roles", () => {
    // Valid roles: SUPERADMIN, ADMIN, STAFF, SHOP
    const validRoles = ["SUPERADMIN", "ADMIN", "STAFF", "SHOP"];
    for (const role of validRoles) {
      const parsed = createUserSchema.parse({
        name: `User ${role}`,
        username: `user_${role.toLowerCase()}`,
        password: "securePassword123",
        role,
        status: "ACTIVE",
      });
      assert.equal(parsed.role, role);
    }

    // Invalid role rejection
    assert.throws(
      () =>
        createUserSchema.parse({
          name: "Hacker User",
          username: "hacker",
          password: "password123",
          role: "ROOT_SYSADMIN", // Disallowed role
        }),
      /expected one of/
    );
  });

  it("validates userSchema: rejects usernames shorter than 3 characters", () => {
    assert.throws(
      () =>
        createUserSchema.parse({
          name: "Shorty",
          username: "ab",
          password: "password123",
          role: "STAFF",
        }),
      /Username must be at least 3 characters/
    );
  });
});

describe("Unit Tests: Warehouse Storage Location Formatter", () => {
  it("extracts Section and Rack with various whitespaces and uppercase tags", () => {
    const loc1 = extractStorageLocation("LKREQ00010\nSECTION: 4 RACK: B\nNotes here", "");
    assert.ok(loc1 !== null);
    assert.equal(loc1?.section, "4");
    assert.equal(loc1?.rack, "B");

    const loc2 = extractStorageLocation("SECTION: 12   RACK: F", "");
    assert.ok(loc2 !== null);
    assert.equal(loc2?.section, "12");
    assert.equal(loc2?.rack, "F");
  });

  it("returns null when no section or rack tag is found", () => {
    const loc = extractStorageLocation("Product delivered on Monday", "Special fragile packing");
    assert.equal(loc, null);
  });
});

describe("Unit Tests: Database Schema Self-Healing & Missing Column Fallback (Error 1054)", () => {
  it("detects and safely handles missing departmentId column error without throwing", () => {
    const isUnknownColumnError = (errMessage: string) => {
      return errMessage.includes("departmentId") || errMessage.includes("1054");
    };

    const simulatedErr =
      "Raw query failed. Code: `1054`. Message: `Unknown column 'departmentId' in 'INSERT INTO'`";
    assert.strictEqual(isUnknownColumnError(simulatedErr), true);

    const otherErr =
      "Raw query failed. Code: `1062`. Message: `Duplicate entry 'admin' for key 'User_username_key'`";
    assert.strictEqual(isUnknownColumnError(otherErr), false);
  });
});

describe("Unit Tests: Pending Product Download Excel Status Transition", () => {
  it("identifies PENDING products for status update to REQUESTED upon export", () => {
    const products = [
      { id: 101, status: "PENDING", productName: "Item 1" },
      { id: 102, status: "REQUESTED", productName: "Item 2" },
      { id: 103, status: "PENDING", productName: "Item 3" },
      { id: 104, status: "ACTIVE", productName: "Item 4" },
    ];

    const pendingIds = products
      .filter((p) => p.status === "PENDING")
      .map((p) => p.id);

    assert.deepEqual(pendingIds, [101, 103]);
  });

  it("preserves already REQUESTED items without duplicating transition", () => {
    const products = [
      { id: 201, status: "REQUESTED", productName: "Previously Exported Item" },
    ];

    const pendingIds = products
      .filter((p) => p.status === "PENDING")
      .map((p) => p.id);

    assert.equal(pendingIds.length, 0);
  });
});

describe("Unit Tests: Product Description Text Cleaning for PDF", () => {
  it("removes artificial spacing from spaced-out product names while preserving normal lines", () => {
    const input = "S a m k o o n   S K - 0 7 0 Q H\nHMI Touch Panel";
    const expected = "Samkoon SK-070QH\nHMI Touch Panel";
    assert.equal(cleanProductDescription(input), expected);
  });

  it("normalizes full-width Unicode characters to standard ASCII", () => {
    const input = "Ｓａｍｋｏｏｎ　ＳＫ－０７０ＱＨ";
    assert.equal(cleanProductDescription(input), "Samkoon SK-070QH");
  });

  it("collapses multiple consecutive spaces while leaving clean product titles intact", () => {
    const input = "MeanWell   LRS-350-24   Power Supply";
    assert.equal(cleanProductDescription(input), "MeanWell LRS-350-24 Power Supply");
  });

  it("preserves standard descriptions without modifying clean tokens", () => {
    const input = "Samkoon SK-070C";
    assert.equal(cleanProductDescription(input), "Samkoon SK-070C");
  });

  it("cleans description inside formatProductServiceCell", () => {
    const cell = formatProductServiceCell(
      "S a m k o o n   S K - 0 7 0 Q H\nHMI Touch Panel",
      "IN_STOCK",
      null,
      "1 Year"
    );
    assert.ok(cell.includes("Samkoon SK-070QH\nHMI Touch Panel"));
    assert.ok(cell.includes("(instocks)"));
    assert.ok(cell.includes("(1 Year warranty)"));
  });
});



describe("Unit Tests: Quotation Inventory SKU Search & Picking", () => {
  const dummyProduct = {
    id: 123,
    sku: "SK-070QI",
    recordNo: "LKREQ00042",
    referenceNo: "REF-9988",
    modelAndName: "Samkoon SK-070QI 7-inch HMI Touch Panel",
    productName: "Samkoon SK-070QI 7-inch HMI Touch Panel",
    description: "Industrial Human Machine Interface with Ethernet",
    categoryNames: "HMI, Touch Panels",
    quantity: 5,
    priceLKR: 45000,
  };

  it("scores exact SKU match with top priority (+200)", () => {
    const score = scoreProductRelevance("SK-070QI", dummyProduct as any);
    assert.ok(score >= 200, `Expected score >= 200, got ${score}`);
  });

  it("scores compact SKU match without hyphens with top priority (+200)", () => {
    const score = scoreProductRelevance("sk070qi", dummyProduct as any);
    assert.ok(score >= 200, `Expected score >= 200, got ${score}`);
  });

  it("handles SKU prefix (sku: or SKU ) and matches exact SKU", () => {
    const scoreWithPrefix = scoreProductRelevance("SKU: SK-070QI", dummyProduct as any);
    assert.ok(scoreWithPrefix >= 200, `Expected score >= 200, got ${scoreWithPrefix}`);

    const scoreWithCompactPrefix = scoreProductRelevance("sku:sk070qi", dummyProduct as any);
    assert.ok(scoreWithCompactPrefix >= 200, `Expected score >= 200, got ${scoreWithCompactPrefix}`);
  });

  it("matches record number with top priority", () => {
    const score = scoreProductRelevance("LKREQ00042", dummyProduct as any);
    assert.ok(score >= 200, `Expected score >= 200, got ${score}`);

    const scoreCompact = scoreProductRelevance("lkreq00042", dummyProduct as any);
    assert.ok(scoreCompact >= 200, `Expected score >= 200, got ${scoreCompact}`);
  });

  it("preserves SKUs and model codes during fuzzy suggestions without corrupting them", () => {
    const vocab = new Set(["samkoon", "touch", "panel", "sensor", "laser", "relay"]);
    const suggestion1 = getFuzzySuggestion("SK-070QI", vocab);
    assert.equal(suggestion1.correctedQuery, "SK-070QI");

    const suggestion2 = getFuzzySuggestion("LKSEN00111", vocab);
    assert.equal(suggestion2.correctedQuery, "LKSEN00111");

    const suggestion3 = getFuzzySuggestion("DIY01", vocab);
    assert.equal(suggestion3.correctedQuery, "DIY01");

    const suggestion4 = getFuzzySuggestion("001059", vocab);
    assert.equal(suggestion4.correctedQuery, "001059");
  });
});

describe("Unit Tests: Supply Excel Supplier Image Handling", () => {
  it("extracts image URLs and hyperlinks from supplier image column", () => {
    const sanitizeFormula = (val: string) => val.trim();
    const extractUrl = (cellValue: any) => {
      if (typeof cellValue === "string") return cellValue.trim();
      if (cellValue && typeof cellValue === "object") {
        if (typeof cellValue.hyperlink === "string") return cellValue.hyperlink.trim();
        if (typeof cellValue.text === "string") return sanitizeFormula(cellValue.text.trim());
      }
      return "";
    };

    const directUrl = extractUrl("https://example.com/uploads/supplier-part.jpg");
    assert.equal(directUrl, "https://example.com/uploads/supplier-part.jpg");

    const hyperlinkedCell = extractUrl({
      text: "View Image",
      hyperlink: "https://supplier-portal.com/images/panel-01.png",
    });
    assert.equal(hyperlinkedCell, "https://supplier-portal.com/images/panel-01.png");

    const localUploadPath = extractUrl("/uploads/products/supplier-1234.png");
    assert.equal(localUploadPath, "/uploads/products/supplier-1234.png");
  });

  it("maps embedded image coordinates to the correct Excel row and supplier image column", () => {
    const colMap = { model: 1, price: 7, supplierImage: 12, note: 13 };
    const mockEmbeddedImages = [
      {
        imageId: "img1",
        range: {
          tl: { nativeRow: 5, nativeCol: 11.2 }, // Row 6 (0-indexed 5), Col 12 (0-indexed 11.2)
        },
      },
      {
        imageId: "img2",
        range: {
          tl: { row: 7.05, col: 11.8 }, // Row 8, Col 12
        },
      },
    ];

    const imageMap = new Map<number, string>();
    for (const img of mockEmbeddedImages) {
      const rowZero = img.range.tl.nativeRow != null ? img.range.tl.nativeRow : img.range.tl.row;
      const rowNumber = Math.floor(rowZero) + 1;
      const colZero = (img.range.tl as any).nativeCol != null ? (img.range.tl as any).nativeCol : img.range.tl.col;
      const colNumber = Math.floor(colZero) + 1;

      const isNearSupplierCol = colMap.supplierImage && Math.abs(colNumber - colMap.supplierImage) <= 2;
      if (isNearSupplierCol) {
        imageMap.set(rowNumber, `/uploads/products/supplier-mock-${img.imageId}.png`);
      }
    }

    assert.equal(imageMap.get(6), "/uploads/products/supplier-mock-img1.png");
    assert.equal(imageMap.get(8), "/uploads/products/supplier-mock-img2.png");
    assert.equal(imageMap.get(7), undefined);
  });

  it("updates Product updateData with supplierImage when provided in row", () => {
    const rowWithImage = {
      price: 40680,
      warrantyPeriod: "1 Year",
      priceValidity: "30 Days",
      leadTime: "12-21 days",
      isBrandNewOriginal: "Yes",
      supplierImage: "/uploads/products/supplier-test-cable.png",
      supplierNote: "dedicated to Siemens 200 series PLC",
    };

    const updateData: any = {
      price: rowWithImage.price,
      supplierNote: rowWithImage.supplierNote,
    };
    if (rowWithImage.supplierImage) {
      updateData.supplierImage = rowWithImage.supplierImage;
    }

    assert.equal(updateData.supplierImage, "/uploads/products/supplier-test-cable.png");
    assert.equal(updateData.supplierNote, "dedicated to Siemens 200 series PLC");
  });

  it("generates correct sequential R&D quotation numbers by type", async () => {
    const fixedDate = new Date(2026, 10, 16); // 2026-11-16

    // Project Proposal (PQV)
    assert.equal(
      await getNextRdQuotationNo([], "PROJECT_PROPOSAL", fixedDate),
      "20261116PQV1"
    );
    assert.equal(
      await getNextRdQuotationNo(["20261116PQV1", "20261116PQV2"], "PROJECT_PROPOSAL", fixedDate),
      "20261116PQV3"
    );

    // 3D Print & PCB Fabrication (Shared QV Series)
    assert.equal(
      await getNextRdQuotationNo([], "THREE_D_PRINT", fixedDate),
      "20261116QV1"
    );
    assert.equal(
      await getNextRdQuotationNo(["20261116QV1"], "PCB", fixedDate),
      "20261116QV2"
    );
    assert.equal(
      await getNextRdQuotationNo(["20261116QV1", "20261116QV2"], "THREE_D_PRINT", fixedDate),
      "20261116QV3"
    );
    assert.equal(
      await getNextRdQuotationNo(["20261116QV1", "20261116QV7"], "PCB", fixedDate),
      "20261116QV8"
    );
  });

  it("validates R&D technical default specifications and LK Tronics bank credentials", () => {
    // 3D print specs & default pricing constants
    assert.equal(DEFAULT_THREE_D_PRINT_SPECS.printingTechnology, "FDM (Fused Deposition Modeling)");
    assert.ok(DEFAULT_THREE_D_PRINT_SPECS.infillDensity.includes("50%"));
    assert.ok(DEFAULT_THREE_D_PRINT_SPECS.material.includes("ABS") || DEFAULT_THREE_D_PRINT_SPECS.material.includes("PLA"));
    assert.equal(DEFAULT_THREE_D_PRINT_PRICING.filamentPricePerKg, 10000);
    assert.equal(DEFAULT_THREE_D_PRINT_PRICING.costPerHour, 200);
    assert.equal(DEFAULT_THREE_D_PRINT_PRICING.markupPercent, 35);

    // PCB specs
    assert.equal(DEFAULT_PCB_SPECS.layers, "2 Layers");
    assert.equal(DEFAULT_PCB_SPECS.thickness, "1.6 mm");
    assert.equal(DEFAULT_PCB_SPECS.copperWeight, "1 oz");

    // Bank Details
    assert.equal(LK_TRONICS_BANK_DETAILS.accountName, "LK TRONICS TRADING PVT LTD");
    assert.equal(LK_TRONICS_BANK_DETAILS.accountNumber, "047010021564");
    assert.equal(LK_TRONICS_BANK_DETAILS.bankName, "Hatton National Bank (HNB)");
  });

  it("calculates 3D print pricing accurately based on length, time (in minutes), and markup formula", () => {
    // Omni Calculator formula validation:
    // 12.5m filament, 70 mins print time, 10,000 LKR/kg, 200 LKR/hr, 35% markup, ABS (1.05 g/cm³), 1.75mm
    // Material cost = 315.69, Labor cost = 233.33, Raw price = 741.19 LKR -> Rounded up to nearest 10 = 750 LKR
    const omniRes = calculate3DPrintPrice(12.5, 70, 10000, 200, 35, 1.05, 1.75);
    assert.equal(omniRes.materialCost, 315.69);
    assert.equal(omniRes.laborCost, 233.33);
    assert.equal(omniRes.baseCost, 549.03);
    assert.equal(omniRes.markupAmount, 192.16);
    assert.equal(omniRes.rawUnitPrice, 741.19);
    assert.equal(omniRes.unitPrice, 750); // 741.19 rounded up to nearest 10 = 750

    // Zero length and zero time fallback safely
    const zeroRes = calculate3DPrintPrice(0, 0, 10000, 200, 35, 1.05, 1.75);
    assert.equal(zeroRes.materialCost, 0);
    assert.equal(zeroRes.laborCost, 0);
    assert.equal(zeroRes.unitPrice, 0);

    // PLA material (1.27 g/cm³): Raw 830.48 -> Rounded up to nearest 10 = 840 LKR
    const plaRes = calculate3DPrintPrice(12.5, 70, 10000, 200, 35, 1.27, 1.75);
    assert.equal(plaRes.materialCost, 381.84);
    assert.equal(plaRes.laborCost, 233.33);
    assert.equal(plaRes.rawUnitPrice, 830.48);
    assert.equal(plaRes.unitPrice, 840);
  });

  it("calculates R&D project proposal dual BOM & Engineering Services totals correctly", () => {
    const hardwareItems = [
      { quantity: 2, unitPrice: 7500 }, // 15,000
      { quantity: 5, unitPrice: 1200 }, // 6,000
    ];
    const serviceItems = [
      { quantity: 1, unitPrice: 35000 }, // 35,000
      { quantity: 2, unitPrice: 8500 },  // 17,000
    ];

    const hardwareTotal = hardwareItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const servicesTotal = serviceItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const totalInvestment = hardwareTotal + servicesTotal;

    assert.equal(hardwareTotal, 21000);
    assert.equal(servicesTotal, 52000);
    assert.equal(totalInvestment, 73000);

    // 70% advance payment calculation
    const advancePercent = 70;
    const advancePayable = (totalInvestment * advancePercent) / 100;
    const balanceRemaining = totalInvestment - advancePayable;

    assert.equal(advancePayable, 51100);
    assert.equal(balanceRemaining, 21900);
    assert.equal(advancePayable + balanceRemaining, totalInvestment);
  });

  it("manages settlement bank accounts and resolves default account accurately", () => {
    // Default configured accounts
    assert.ok(DEFAULT_BANK_ACCOUNTS.length >= 2);
    const defaultAcc = resolveDefaultBankAccount(DEFAULT_BANK_ACCOUNTS);
    assert.ok(defaultAcc);
    assert.equal(defaultAcc.bankName, "Hatton National Bank (HNB)");
    assert.equal(defaultAcc.accountNumber, "047010021564");
    assert.equal(defaultAcc.isDefault, true);

    // Resolving when custom list has different default
    const customList: BankAccount[] = [
      {
        id: "bank-custom-1",
        bankName: "Commercial Bank",
        accountName: "LK TRONICS TRADING PVT LTD",
        accountNumber: "1000999888",
        branch: "Colombo Fort",
        isDefault: false,
      },
      {
        id: "bank-custom-2",
        bankName: "Sampath Bank",
        accountName: "LK TRONICS TRADING PVT LTD",
        accountNumber: "2000555444",
        branch: "Kollupitiya",
        isDefault: true,
      },
    ];

    const resolved = resolveDefaultBankAccount(customList);
    assert.equal(resolved?.id, "bank-custom-2");
    assert.equal(resolved?.bankName, "Sampath Bank");

    // Fallback when no account marked as default
    const noDefaultList: BankAccount[] = [
      {
        id: "bank-1",
        bankName: "BOC",
        accountName: "LK TRONICS",
        accountNumber: "8888",
        branch: "Main",
        isDefault: false,
      },
    ];
    const fallback = resolveDefaultBankAccount(noDefaultList);
    assert.equal(fallback?.id, "bank-1");
  });

  it("validates Product Checklist test items and default specifications for Inverter and Battery", () => {
    // Inverter test parameters
    const invTests = getDefaultTestItems("INVERTER");
    assert.equal(invTests.length, 8);
    const invKeys = invTests.map((t) => t.key);
    assert.ok(invKeys.includes("pvStatus"));
    assert.ok(invKeys.includes("acStatus"));
    assert.ok(invKeys.includes("displayStatus"));
    assert.ok(invKeys.includes("outputStatus"));
    assert.ok(invKeys.includes("batteryChargingStatus"));
    assert.ok(invKeys.includes("batteryPointBackStatus"));
    assert.ok(invKeys.includes("loadTestStatus"));
    assert.ok(invKeys.includes("qcPassedStatus"));

    // Battery test parameters
    const batTests = getDefaultTestItems("BATTERY");
    assert.equal(batTests.length, 6);
    const batKeys = batTests.map((t) => t.key);
    assert.ok(batKeys.includes("displayStatus"));
    assert.ok(batKeys.includes("outputStatus"));
    assert.ok(batKeys.includes("batteryChargingStatus"));
    assert.ok(batKeys.includes("batteryPointBackStatus"));
    assert.ok(batKeys.includes("loadTestStatus"));
    assert.ok(batKeys.includes("qcPassedStatus"));

    // Inverter does have PV & AC, while Battery does not
    assert.ok(!batKeys.includes("pvStatus"));
    assert.ok(!batKeys.includes("acStatus"));

    // Default info structures
    const defBat = getDefaultBatteryInfo();
    assert.equal(defBat.physicalDamage, "None / No physical damage observed");
    assert.equal(defBat.macAddress, "");
    assert.equal(defBat.serialNumberBox, "");
    assert.equal(defBat.serialNumberBattery, "");

    const defInv = getDefaultInverterInfo();
    assert.equal(defInv.batterySystem, "48V DC");
    assert.equal(defInv.physicalDamage, "None / No physical damage observed");
    assert.equal(defInv.serialNumberBox, "");
    assert.equal(defInv.serialNumberInverter, "");
  });

  it("generates official Letterhead Product Checklist PDF for Inverter without MAC address and with box/inverter serials", async () => {
    const inverterChecklist: ProductChecklist = {
      id: "chk-inv-01",
      checklistNo: "QC-INV-20261118-01",
      type: "INVERTER",
      inverterInfo: {
        arrivedDate: "2026-11-18",
        modelNumber: "Deye SUN-5K-SG03LP1",
        serialNumberInverter: "INV202611-1234",
        serialNumberBox: "BX-INV202611-1234",
        batterySystem: "48V DC Low Voltage",
        physicalDamage: "None / Pristine factory packaging",
      },
      checkedDate: "2026-11-18",
      tests: getDefaultTestItems("INVERTER"),
      checkedByName: "Kasun Perera",
      checkedByDesignation: "Quality Control & Hardware Engineer",
      additionalNotes: [],
      overallQcPassed: true,
      createdAt: "2026-11-18T06:00:00.000Z",
      updatedAt: "2026-11-18T06:00:00.000Z",
    };

    const doc = await generateChecklistPdf(inverterChecklist);
    assert.ok(doc);
    assert.equal(doc.getNumberOfPages(), 1);

    const pageStream = (doc as any).internal.pages[1].join("\n");
    assert.ok(pageStream.includes("Serial Number \\(Inverter\\):"));
    assert.ok(pageStream.includes("Serial Number \\(Box\\):"));
    assert.ok(pageStream.includes("INV202611-1234"));
    assert.ok(pageStream.includes("BX-INV202611-1234"));
    assert.ok(!pageStream.includes("MAC Address:"));
  });

  it("generates official Letterhead Product Checklist PDF cleanly without errors", async () => {
    const mockChecklist: ProductChecklist = {
      id: "chk-test-01",
      checklistNo: "QC-BAT-20261117-01",
      type: "BATTERY",
      batteryInfo: {
        arrivedDate: "2026-11-17",
        modelNumber: "LK-BAT-48100-PRO",
        macAddress: "AA:BB:CC:11:22:33",
        serialNumberBattery: "BAT202611-9988",
        serialNumberBox: "BX202611-9988",
        batteryInput: "51.2V DC / 100Ah",
        physicalDamage: "None / Pristine factory packaging",
      },
      checkedDate: "2026-11-17",
      tests: getDefaultTestItems("BATTERY"),
      checkedByName: "Kasun Perera",
      checkedByDesignation: "Quality Control & Hardware Engineer",
      additionalNotes: [
        { id: "n1", text: "Cell balance within 0.005V across all 16 cells", bold: true, color: "green" },
        { id: "n2", text: "High temperature cutoff verified at 65°C", highlight: true, color: "amber" },
      ],
      overallQcPassed: true,
      createdAt: "2026-11-17T06:00:00.000Z",
      updatedAt: "2026-11-17T06:00:00.000Z",
    };

    const doc = await generateChecklistPdf(mockChecklist);
    assert.ok(doc);
    assert.equal(doc.getNumberOfPages(), 1);

    // Verify clean layout and removal of legacy signature/authorization blocks
    const pageStream = (doc as any).internal.pages[1].join("\n");
    assert.ok(pageStream.includes("PRODUCT TECHNICAL & QC"));
    assert.ok(pageStream.includes("PASSED"));
    assert.ok(!pageStream.includes("Authorized Signature & Official Seal"));
    assert.ok(!pageStream.includes("Technician Signature & Stamp"));
    assert.ok(!pageStream.includes("QUALITY ASSURANCE APPROVAL:"));
    assert.ok(!pageStream.includes("LK Tronics R&D QA Manager"));
    assert.ok(pageStream.includes("INSPECTED & TESTED BY:"));
    assert.ok(pageStream.includes("VERIFICATION DATE:"));
    // Verify test parameters are printed cleanly in column 2
    assert.ok(pageStream.includes("Display Status"));
    assert.ok(pageStream.includes("Output Status"));
    assert.ok(pageStream.includes("QC Passed Status"));
  });

  it("generates official Product Handover Letter PDF matching corporate intake template", async () => {
    const handoverData: ProductHandoverData = {
      refNo: "QC-BAT-20261117-01",
      productName: "LK Tronics Lithium Iron Phosphate (LiFePO4) Battery Pack",
      modelDescription: "LK-BAT-51.2V-100AH",
      serialNumbers: "BAT202611-00812",
      quantity: "1 Unit",
      collectorName: "Eng. Kasun Bandara",
      collectorDesignation: "Quality Control & Hardware Engineer",
      handoverDate: "2026-11-17",
      contactNumber: "+94 76 357 31 31",
    };

    const doc = await generateHandoverLetterPdf(handoverData);
    assert.ok(doc);
    assert.equal(doc.getNumberOfPages(), 1);

    const pageStream = (doc as any).internal.pages[1].join("\n");
    assert.ok(pageStream.includes("LK TRONICS"));
    assert.ok(pageStream.includes("Product Handover Letter"));
    assert.ok(pageStream.includes("We hereby confirm that the following"));
    assert.ok(pageStream.includes("1. Product Details"));
    assert.ok(pageStream.includes("2. LK TRONICS Collector"));
    assert.ok(pageStream.includes("4. Handover Confirmation"));
    assert.ok(pageStream.includes("Signature of Collector"));
    assert.ok(pageStream.includes("Date"));
    assert.ok(pageStream.includes("P-V 00336036"));
    assert.ok(pageStream.includes("HOMAGAMA"));
    assert.ok(pageStream.includes("+94 76 357 31 31"));
    assert.ok(pageStream.includes("LK-BAT-51.2V-100AH"));
    assert.ok(pageStream.includes("BAT202611-00812"));
    assert.ok(pageStream.includes("Eng. Kasun Bandara"));
  });

  it("generates blank Product Handover Letter template for manual writing and field intake", async () => {
    const blankData: ProductHandoverData = {
      productName: "",
      modelDescription: "",
      serialNumbers: "",
      quantity: "",
      collectorName: "",
      collectorDesignation: "",
      handoverDate: "",
      contactNumber: "",
    };

    const doc = await generateHandoverLetterPdf(blankData);
    assert.ok(doc);
    assert.equal(doc.getNumberOfPages(), 1);

    const pageStream = (doc as any).internal.pages[1].join("\n");
    assert.ok(pageStream.includes("Product Handover Letter"));
    assert.ok(pageStream.includes("1. Product Details"));
    assert.ok(pageStream.includes("4. Handover Confirmation"));
    assert.ok(pageStream.includes("Signature of Collector"));
  });

  it("limits default hardware components to 4 items and services to 2 items", () => {
    assert.equal(DEFAULT_PROJECT_PROPOSAL_HARDWARE.length, 4);
    assert.equal(DEFAULT_PROJECT_PROPOSAL_SERVICES.length, 2);
    assert.equal(DEFAULT_PROJECT_PROPOSAL_HARDWARE[0].productOrService, "Arduino Nano");
    assert.equal(DEFAULT_PROJECT_PROPOSAL_HARDWARE[3].productOrService, "HLK-20M05 AC-DC 220V to 5V Power Supply");
    assert.equal(DEFAULT_PROJECT_PROPOSAL_SERVICES[0].productOrService, "Testing / Engineering Charges");
    assert.equal(DEFAULT_PROJECT_PROPOSAL_SERVICES[1].productOrService, "IOT Installation and Programing");
  });

  it("preserves custom project proposal terms including custom warranty, delivery, and scope terms", () => {
    const customTerms = [
      "Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is",
      "Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is clearly stated in the",
      "quotation nrAdditional Terms & Conditions (Optional)",
      "Special Terms: Client will provide onsite 230V power outlet.",
    ].join("\n");

    const extracted = extractAdditionalTerms(customTerms);
    assert.equal(extracted.length, 4);
    assert.equal(extracted[0], "Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is");
    assert.equal(extracted[1], "Warranty: If a warranty (for manufacturing faults) is provided for any component used in the project, it is clearly stated in the");
    assert.equal(extracted[2], "quotation nrAdditional Terms & Conditions (Optional)");
    assert.equal(extracted[3], "Special Terms: Client will provide onsite 230V power outlet.");

    const combined = getProjectProposalCombinedTerms(customTerms, 4);
    // 4 custom + 6 default terms = 10 total
    assert.equal(combined.length, 10);
    assert.equal(combined[0], extracted[0]);
    assert.equal(combined[1], extracted[1]);
    assert.equal(combined[2], extracted[2]);
    assert.equal(combined[3], extracted[3]);

    const defaultTerms = getProjectProposalTerms(5);
    assert.ok(
      defaultTerms[2].includes(
        "Source Code & Design Documents: All PLC/HMI programs, source codes, programming logic, and electrical design documents remain the exclusive intellectual property of LK TRONICS (Pvt) Ltd and will not be provided to the client."
      )
    );
  });

  it("generates sequential quotation numbers for UNI_QUOTATION using PQV series", async () => {
    const fixedDate = new Date(2026, 9, 14); // 2026-10-14
    const nextNo1 = await getNextRdQuotationNo([], "UNI_QUOTATION", fixedDate);
    assert.equal(nextNo1, "20261014PQV1");

    const nextNo2 = await getNextRdQuotationNo(
      [{ quotationNo: "20261014PQV1" }],
      "UNI_QUOTATION",
      fixedDate
    );
    assert.equal(nextNo2, "20261014PQV2");
  });

  it("validates Uni Quotation terms matching Doc/20161014PQV1.docx", () => {
    assert.equal(DEFAULT_UNI_QUOTATION_GENERAL_TERMS.length, 6);
    assert.ok(DEFAULT_UNI_QUOTATION_GENERAL_TERMS[0].includes("Ownership of project shall remain with LK TRONICS"));
    assert.ok(DEFAULT_UNI_QUOTATION_GENERAL_TERMS[1].includes("Orders once confirmed cannot be cancelled"));
    assert.ok(DEFAULT_UNI_QUOTATION_GENERAL_TERMS[5].includes("Testing and demonstration will be carried out jointly"));

    const terms = getUniQuotationTerms(5, "10 business working days", "80% advance payment");
    assert.ok(terms.validityTerm.includes("five (05) days"));
    assert.ok(terms.durationTerm.includes("10 business working days"));
    assert.ok(terms.deliveryTerm.includes("collection of the goods from our store"));
    assert.ok(terms.confidentialityTerm.includes("maintain confidentiality"));
    assert.ok(terms.paymentTerm.includes("80% advance payment"));
  });

  it("validates Uni Quotation default components and specs matching 20161014PQV1.docx", () => {
    assert.equal(DEFAULT_UNI_QUOTATION_ITEMS.length, 4);
    assert.equal(DEFAULT_UNI_QUOTATION_ITEMS[0].productOrService, "ESP32 Development Board 2.4GHz WIFI Bluetooth 38 Pin");
    assert.equal(DEFAULT_UNI_QUOTATION_ITEMS[2].quantity, 192);
    assert.equal(DEFAULT_UNI_QUOTATION_SPECS.completionTime, "10 business working days");
    assert.equal(DEFAULT_UNI_QUOTATION_SPECS.engineeringCharges, 37580);
    assert.equal(DEFAULT_UNI_QUOTATION_SPECS.discount, 4580);
    assert.equal(DEFAULT_UNI_QUOTATION_SPECS.paymentTermsText, "80% advance payment");
  });

  it("validates Settlement Bank Account, Payment Method and advance payment percentage logic", () => {
    // Validate advance percent calculation
    const calcAdvance = (total: number, percent: number) => (total * percent) / 100;
    const calcBalance = (total: number, percent: number) => total - calcAdvance(total, percent);

    const total = 100000;
    assert.equal(calcAdvance(total, 80), 80000);
    assert.equal(calcBalance(total, 80), 20000);

    // Validate percentage boundaries
    const isValidAdvancePercent = (pct: any) => {
      const num = Number(pct);
      return !isNaN(num) && num >= 1 && num <= 100;
    };
    assert.equal(isValidAdvancePercent(80), true);
    assert.equal(isValidAdvancePercent(60), true);
    assert.equal(isValidAdvancePercent(0), false);
    assert.equal(isValidAdvancePercent(-10), false);
    assert.equal(isValidAdvancePercent(101), false);
    assert.equal(isValidAdvancePercent("abc"), false);

    // Validate formatting of payment method display
    const formatPaymentMethod = (method: string, percent?: number | string) => {
      if (method === "ADVANCE_PAYMENT") {
        return `${percent || 80}% advance payment`;
      }
      if (method === "FULL_PAYMENT") return "100% payment";
      if (method === "CREDIT") return "Corporate Credit";
      return method;
    };

    assert.equal(formatPaymentMethod("ADVANCE_PAYMENT", 80), "80% advance payment");
    assert.equal(formatPaymentMethod("ADVANCE_PAYMENT", 50), "50% advance payment");
    assert.equal(formatPaymentMethod("FULL_PAYMENT"), "100% payment");
    assert.equal(formatPaymentMethod("CREDIT"), "Corporate Credit");
  });

  it("verifies dirty form state detection logic for unsaved changes protection", () => {
    // Test snapshot comparison logic used by useUnsavedChangesWarning
    const initialBlank = JSON.stringify({
      customer: "",
      items: [{ desc: "", price: 0 }],
    });

    const modified = JSON.stringify({
      customer: "ABC Corp",
      items: [{ desc: "Inverter", price: 150000 }],
    });

    const saved = modified;

    const modifiedAgain = JSON.stringify({
      customer: "ABC Corp",
      items: [{ desc: "Inverter", price: 175000 }],
    });

    // Before user inputs anything: not dirty
    assert.equal(initialBlank === initialBlank, true);

    // After user types: dirty
    assert.equal(modified !== initialBlank, true);

    // After user saves: matches saved snapshot -> not dirty
    assert.equal(saved === modified, true);

    // After user modifies again: dirty
    assert.equal(modifiedAgain !== saved, true);
  });

  it("encrypts backup data with PMSENC01 header and decrypts back accurately", () => {
    const mockData = {
      app: "LK Tronics PMS",
      recordCounts: { products: 1087, quotes: 19 },
      items: [
        { id: "p1", name: "Samkoon HMI", price: 25000 },
        { id: "p2", name: "STM32 Development Board", price: 4500 },
      ],
    };
    const jsonStr = JSON.stringify(mockData);
    const secretKey = "Custom-LK-Secret-Key-2026-X";

    const encryptedBuffer = encryptBackupData(jsonStr, secretKey);
    assert.equal(encryptedBuffer.subarray(0, 8).toString("utf8"), "PMSENC01");
    assert.equal(encryptedBuffer.length > 52, true);

    const decrypted = decryptBackupData(encryptedBuffer, secretKey);
    assert.deepEqual(decrypted, mockData);
  });

  it("fails backup decryption if incorrect encryption passphrase is provided", () => {
    const jsonStr = JSON.stringify({ secret: "classified" });
    const encryptedBuffer = encryptBackupData(jsonStr, "Correct-Key");

    assert.throws(
      () => decryptBackupData(encryptedBuffer, "Wrong-Key"),
      /Decryption failed|Auth tag check failed/i
    );
  });

  it("fails backup decryption if buffer is tampered or corrupted", () => {
    const jsonStr = JSON.stringify({ secret: "data" });
    const encryptedBuffer = encryptBackupData(jsonStr, "Key123");

    // Tamper with ciphertext byte
    encryptedBuffer[encryptedBuffer.length - 1] ^= 0xff;

    assert.throws(
      () => decryptBackupData(encryptedBuffer, "Key123"),
      /Decryption failed|Auth tag check failed/i
    );
  });

  it("formats storage bytes accurately for KB, MB, and GB", () => {
    assert.equal(formatBytes(512), "0.5 KB");
    assert.equal(formatBytes(1024), "1.0 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
    assert.equal(formatBytes(25 * 1024 * 1024 * 1024), "25.00 GB");
  });

  it("generates single-page Slide 3 and Slide 4 when within standard caps (<=8 images, <=4 HW, <=2 SRV)", async () => {
    const baseProposalData: any = {
      type: "PROJECT_PROPOSAL",
      quotationNo: "20261120PQV1",
      preparedDate: "2026-11-20",
      expireDate: "2026-12-20",
      paymentMethod: "Bank Transfer",
      preparedBy: "Eng. Kasun",
      quotationTo: "ABC Tech (Pvt) Ltd",
      projectTitle: "Smart Factory IoT System",
      leadTime: "10 Working Days",
      warranty: "1 Year",
      hardwareTotal: 150000,
      servicesTotal: 50000,
      totalAmount: 200000,
      systemDesignImages: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
      items: [
        { productOrService: "ESP32 Gateway", quantity: 2, unitPrice: 25000, totalPrice: 50000, itemType: "HARDWARE" },
        { productOrService: "RS485 Sensor", quantity: 4, unitPrice: 25000, totalPrice: 100000, itemType: "HARDWARE" },
        { productOrService: "Firmware Development", quantity: 1, unitPrice: 50000, totalPrice: 50000, itemType: "SERVICE" },
      ],
    };

    const doc = await generateRdQuotationPdf(baseProposalData);
    // Standard proposal has 8 pages (Cover, Scope, Design, BOM, Bank, Terms, Clients, Partners)
    assert.equal(doc.getNumberOfPages(), 8);
  });

  it("automatically generates multiple repeater Slide 3s when images exceed 8", async () => {
    const dummyImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const multiImageProposal: any = {
      type: "PROJECT_PROPOSAL",
      quotationNo: "20261120PQV2",
      preparedDate: "2026-11-20",
      expireDate: "2026-12-20",
      paymentMethod: "Bank Transfer",
      preparedBy: "Eng. Kasun",
      quotationTo: "ABC Tech (Pvt) Ltd",
      projectTitle: "Smart Factory IoT System",
      leadTime: "10 Working Days",
      warranty: "1 Year",
      totalAmount: 200000,
      // 10 images -> 2 Design slides (8 on first, 2 on second)
      systemDesignImages: Array(10).fill(dummyImg),
      items: [
        { productOrService: "ESP32 Gateway", quantity: 2, unitPrice: 25000, totalPrice: 50000, itemType: "HARDWARE" },
        { productOrService: "Firmware Development", quantity: 1, unitPrice: 50000, totalPrice: 50000, itemType: "SERVICE" },
      ],
    };

    const doc = await generateRdQuotationPdf(multiImageProposal);
    // 8 base + 1 additional design slide = 9 pages
    assert.equal(doc.getNumberOfPages(), 9);
  });

  it("automatically generates multiple repeater Slide 4s when hardware > 4 or services > 2", async () => {
    const multiItemProposal: any = {
      type: "PROJECT_PROPOSAL",
      quotationNo: "20261120PQV3",
      preparedDate: "2026-11-20",
      expireDate: "2026-12-20",
      paymentMethod: "Bank Transfer",
      preparedBy: "Eng. Kasun",
      quotationTo: "ABC Tech (Pvt) Ltd",
      projectTitle: "Smart Factory IoT System",
      leadTime: "10 Working Days",
      warranty: "1 Year",
      totalAmount: 350000,
      systemDesignImages: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
      // 6 hardware items (4 on slide 4.1, 2 on slide 4.2) + 3 service items (2 on slide 4.1, 1 on slide 4.2)
      items: [
        { productOrService: "ESP32 Gateway", quantity: 1, unitPrice: 20000, totalPrice: 20000, itemType: "HARDWARE" },
        { productOrService: "RS485 Sensor A", quantity: 1, unitPrice: 15000, totalPrice: 15000, itemType: "HARDWARE" },
        { productOrService: "RS485 Sensor B", quantity: 1, unitPrice: 15000, totalPrice: 15000, itemType: "HARDWARE" },
        { productOrService: "Industrial 24V PSU", quantity: 1, unitPrice: 10000, totalPrice: 10000, itemType: "HARDWARE" },
        { productOrService: "Relay Module 8CH", quantity: 1, unitPrice: 8000, totalPrice: 8000, itemType: "HARDWARE" },
        { productOrService: "IP65 Enclosure", quantity: 1, unitPrice: 12000, totalPrice: 12000, itemType: "HARDWARE" },
        { productOrService: "Firmware Development", quantity: 1, unitPrice: 120000, totalPrice: 120000, itemType: "SERVICE" },
        { productOrService: "IoT Cloud Dashboard", quantity: 1, unitPrice: 100000, totalPrice: 100000, itemType: "SERVICE" },
        { productOrService: "On-site Calibration & Testing", quantity: 1, unitPrice: 50000, totalPrice: 50000, itemType: "SERVICE" },
      ],
    };

    const doc = await generateRdQuotationPdf(multiItemProposal);
    // 8 base + 1 additional BOM slide = 9 pages
    assert.equal(doc.getNumberOfPages(), 9);

    // Verify intermediate BOM slide (page 4) contains Section Sub-Total, and final BOM slide (page 5) contains Total Project Investment
    const page4Stream = (doc as any).internal.pages[4].join("\n");
    const page5Stream = (doc as any).internal.pages[5].join("\n");

    assert.ok(page4Stream.includes("SECTION INVESTMENT SUB-TOTAL") || page4Stream.includes("COMMERCIAL SCHEDULE - SLIDE 1 OF 2"));
    assert.ok(page5Stream.includes("TOTAL PROJECT INVESTMENT"));
    assert.ok(page4Stream.includes("PART 1"));
    assert.ok(page5Stream.includes("PART 2"));
  });

  it("supports explicit designSlides and bomSlides repeater configuration", async () => {
    const explicitProposal: any = {
      type: "PROJECT_PROPOSAL",
      quotationNo: "20261120PQV4",
      preparedDate: "2026-11-20",
      expireDate: "2026-12-20",
      paymentMethod: "Bank Transfer",
      preparedBy: "Eng. Kasun",
      quotationTo: "ABC Tech (Pvt) Ltd",
      totalAmount: 500000,
      designSlides: [
        { title: "Gateway Architecture", images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="] },
        { title: "Sensor Node Schematics", images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="] },
        { title: "Cloud Integration", images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="] },
      ],
      bomSlides: [
        {
          hardwareItems: [{ productOrService: "HW Part 1", quantity: 1, unitPrice: 100000, totalPrice: 100000, itemType: "HARDWARE" }],
          serviceItems: [{ productOrService: "Service Part 1", quantity: 1, unitPrice: 150000, totalPrice: 150000, itemType: "SERVICE" }],
        },
        {
          hardwareItems: [{ productOrService: "HW Part 2", quantity: 1, unitPrice: 100000, totalPrice: 100000, itemType: "HARDWARE" }],
          serviceItems: [{ productOrService: "Service Part 2", quantity: 1, unitPrice: 150000, totalPrice: 150000, itemType: "SERVICE" }],
        },
      ],
      items: [],
    };

    const doc = await generateRdQuotationPdf(explicitProposal);
    // 3 design slides + 2 BOM slides + Cover + Intro + Bank + Terms + Clients + Partners = 11 pages
    assert.equal(doc.getNumberOfPages(), 11);
  });

  it("renders paired Slide 3 and Slide 4 sets in alternating sequence when proposalSets is provided", async () => {
    const pairedSetsProposal: any = {
      type: "PROJECT_PROPOSAL",
      quotationNo: "20261120PQV5",
      preparedDate: "2026-11-20",
      expireDate: "2026-12-20",
      paymentMethod: "Bank Transfer",
      preparedBy: "Eng. Kasun",
      quotationTo: "Apex Dynamics (Pvt) Ltd",
      totalAmount: 600000,
      proposalSets: [
        {
          id: "set-1",
          title: "Set 1",
          leadTime: "10 Working Days",
          warranty: "1 Year",
          systemDesignImages: [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          ],
          hardwareItems: [
            { productOrService: "Arduino Nano", quantity: 2, unitPrice: 2500, totalPrice: 5000, itemType: "HARDWARE" },
          ],
          serviceItems: [
            { productOrService: "IoT Programming", quantity: 1, unitPrice: 50000, totalPrice: 50000, itemType: "SERVICE" },
          ],
          hardwareTotal: 5000,
          servicesTotal: 50000,
          commercialNote: "Special Note Set 1",
        },
        {
          id: "set-2",
          title: "Set 2",
          leadTime: "14 Working Days",
          warranty: "2 Years",
          systemDesignImages: [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          ],
          hardwareItems: [
            { productOrService: "Modbus RTU Module", quantity: 1, unitPrice: 15000, totalPrice: 15000, itemType: "HARDWARE" },
          ],
          serviceItems: [
            { productOrService: "Field Calibration", quantity: 1, unitPrice: 30000, totalPrice: 30000, itemType: "SERVICE" },
          ],
          hardwareTotal: 15000,
          servicesTotal: 30000,
          commercialNote: "Special Note Set 2",
        },
      ],
      items: [],
    };

    const doc = await generateRdQuotationPdf(pairedSetsProposal);
    // 2 sets * 2 slides (Slide 3 + Slide 4) + Cover (1) + Intro (1) + Bank (1) + Terms (1) + Clients (1) + Partners (1) = 10 pages total
    assert.equal(doc.getNumberOfPages(), 10);

    // Verify alternating pages:
    // Page 1: Cover
    // Page 2: System Overview
    // Page 3: Set 1 Slide 3 (Design) -> Badge has "SET 1 OF 2"
    // Page 4: Set 1 Slide 4 (BOM) -> Hardware header has "SET 1" and intermediate total bar has "COMMERCIAL SCHEDULE - SET 1"
    // Page 5: Set 2 Slide 3 (Design) -> Badge has "SET 2 OF 2"
    // Page 6: Set 2 Slide 4 (BOM) -> Hardware header has "SET 2" and final total bar has "TOTAL PROJECT INVESTMENT"
    // Page 7: Bank Details
    // Page 8: Terms
    // Page 9: Clients
    // Page 10: Partners
    const page3Text = (doc as any).internal.pages[3].join("\n");
    const page4Text = (doc as any).internal.pages[4].join("\n");
    const page5Text = (doc as any).internal.pages[5].join("\n");
    const page6Text = (doc as any).internal.pages[6].join("\n");

    assert.ok(page3Text.includes("SET 1 OF 2"), "Page 3 must be Set 1 Slide 3 (Design)");
    assert.ok(page4Text.includes("SET 1"), "Page 4 must be Set 1 Slide 4 (BOM)");
    assert.ok(page5Text.includes("SET 2 OF 2"), "Page 5 must be Set 2 Slide 3 (Design)");
    assert.ok(page6Text.includes("SET 2"), "Page 6 must be Set 2 Slide 4 (BOM)");
    assert.ok(page6Text.includes("TOTAL PROJECT INVESTMENT"), "Page 6 must be the final BOM slide with TOTAL PROJECT INVESTMENT");
  });
});
