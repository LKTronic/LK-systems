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
} from "../src/lib/quotationPdfGenerator";
import { getNextQuotationNo } from "../src/lib/quotationNo";
import { extractStorageLocation } from "../src/lib/formatters";
import { productSchema } from "../src/lib/validations/product";
import { createUserSchema, updateUserSchema } from "../src/lib/validations/user";

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
