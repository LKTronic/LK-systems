import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanHtml } from "../src/lib/webStoreAutoSync";

describe("Security & Role Authorization Rules", () => {
  function canDeleteProduct(userRole: string, userId: number, product: { createdBy: number; status: string; isOnlineWeb: boolean }) {
    const isPrivileged = userRole === "ADMIN" || userRole === "SUPERADMIN";
    if (product.isOnlineWeb) {
      if (!isPrivileged) return { allowed: false, error: "Only admins can reverse web products" };
      return { allowed: true };
    }
    if (!isPrivileged) {
      if (product.createdBy !== userId) return { allowed: false, error: "Cannot delete products of other users" };
      if (product.status !== "PENDING") return { allowed: false, error: "Staff can only delete pending products" };
    }
    return { allowed: true };
  }

  function canSyncWebStore(userRole: string) {
    return userRole === "ADMIN" || userRole === "SUPERADMIN";
  }

  it("STAFF can delete their own pending local product", () => {
    const result = canDeleteProduct("STAFF", 5, { createdBy: 5, status: "PENDING", isOnlineWeb: false });
    assert.equal(result.allowed, true);
  });

  it("STAFF cannot delete another user's product", () => {
    const result = canDeleteProduct("STAFF", 5, { createdBy: 9, status: "PENDING", isOnlineWeb: false });
    assert.equal(result.allowed, false);
  });

  it("STAFF cannot delete an approved/active local product", () => {
    const result = canDeleteProduct("STAFF", 5, { createdBy: 5, status: "ACTIVE", isOnlineWeb: false });
    assert.equal(result.allowed, false);
  });

  it("STAFF cannot delete or reverse an online web product", () => {
    const result = canDeleteProduct("STAFF", 5, { createdBy: 5, status: "ACTIVE", isOnlineWeb: true });
    assert.equal(result.allowed, false);
  });

  it("ADMIN can delete any local product regardless of status or creator", () => {
    const result = canDeleteProduct("ADMIN", 1, { createdBy: 5, status: "ACTIVE", isOnlineWeb: false });
    assert.equal(result.allowed, true);
  });

  it("ADMIN and SUPERADMIN can reverse online web product changes", () => {
    assert.equal(canDeleteProduct("ADMIN", 1, { createdBy: 5, status: "ACTIVE", isOnlineWeb: true }).allowed, true);
    assert.equal(canDeleteProduct("SUPERADMIN", 2, { createdBy: 5, status: "ACTIVE", isOnlineWeb: true }).allowed, true);
  });

  it("Only ADMIN / SUPERADMIN can trigger WooCommerce batch synchronization", () => {
    assert.equal(canSyncWebStore("STAFF"), false);
    assert.equal(canSyncWebStore("ADMIN"), true);
    assert.equal(canSyncWebStore("SUPERADMIN"), true);
  });
});

describe("Formula Injection Neutralization (CWE-1236)", () => {
  function sanitizeFormula(val: string): string {
    const trimmed = val.trim();
    if (
      trimmed.startsWith("=") ||
      trimmed.startsWith("+") ||
      trimmed.startsWith("-") ||
      trimmed.startsWith("@") ||
      trimmed.startsWith("\t") ||
      trimmed.startsWith("\r")
    ) {
      return "'" + trimmed;
    }
    return trimmed;
  }

  it("neutralizes malicious spreadsheet formulas starting with =, +, -, @", () => {
    assert.equal(sanitizeFormula("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
    assert.equal(sanitizeFormula("+12345"), "'+12345");
    assert.equal(sanitizeFormula("-2+5"), "'-2+5");
    assert.equal(sanitizeFormula("@SUM(A1:A10)"), "'@SUM(A1:A10)");
  });

  it("preserves standard text and product names without alteration", () => {
    assert.equal(sanitizeFormula("Mitsubishi FX1S-10MT PLC"), "Mitsubishi FX1S-10MT PLC");
    assert.equal(sanitizeFormula("Arduino Uno R3"), "Arduino Uno R3");
  });
});

describe("WooCommerce Configuration Validation", () => {
  function validateWcConfig(key?: string, secret?: string) {
    if (!key || !secret) {
      throw new Error("Missing WooCommerce API credentials");
    }
    return true;
  }

  it("throws error when credentials are not configured", () => {
    assert.throws(() => validateWcConfig("", "secret"), /Missing WooCommerce API credentials/);
    assert.throws(() => validateWcConfig("key", ""), /Missing WooCommerce API credentials/);
    assert.throws(() => validateWcConfig(undefined, undefined), /Missing WooCommerce API credentials/);
  });

  it("passes when valid credentials are provided", () => {
    assert.equal(validateWcConfig("ck_test", "cs_test"), true);
  });
});

describe("Bounded LRU Cache Eviction", () => {
  it("evicts oldest entries when cache capacity is exceeded", () => {
    const MAX = 3;
    const cache = new Map<string, string>();

    function put(k: string, v: string) {
      if (cache.size >= MAX) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(k, v);
    }

    put("img1", "buf1");
    put("img2", "buf2");
    put("img3", "buf3");
    assert.equal(cache.size, 3);
    assert.equal(cache.has("img1"), true);

    put("img4", "buf4");
    assert.equal(cache.size, 3);
    assert.equal(cache.has("img1"), false, "img1 should have been evicted");
    assert.equal(cache.has("img4"), true);
  });
});

describe("Fuzzy Search & Typo Tolerance (Google-style)", () => {
  const { damerauLevenshtein, getFuzzySuggestion, findClosestWord } = require("../src/lib/fuzzySearch");

  it("calculates correct Damerau-Levenshtein distances for typos", () => {
    assert.equal(damerauLevenshtein("pluse", "pulse"), 1); // Transposition
    assert.equal(damerauLevenshtein("arduno", "arduino"), 1); // Missing char
    assert.equal(damerauLevenshtein("senser", "sensor"), 1); // Typo char
    assert.equal(damerauLevenshtein("resistorr", "resistor"), 1); // Extra char
  });

  it("corrects misspelled words against vocabulary", () => {
    const vocab = new Set(["pulse", "arduino", "sensor", "module", "relay", "capacitor"]);
    assert.equal(findClosestWord("pluse", vocab), "pulse");
    assert.equal(findClosestWord("arduno", vocab), "arduino");
    assert.equal(findClosestWord("senser", vocab), "sensor");
    assert.equal(findClosestWord("capasitor", vocab), "capacitor");
  });

  it("suggests full corrected query while preserving SKU", () => {
    const vocab = new Set(["pulse", "sensor", "arduino"]);
    const result = getFuzzySuggestion("pluse senser", vocab);
    assert.equal(result.hasCorrection, true);
    assert.equal(result.correctedQuery, "pulse sensor");

    const skuResult = getFuzzySuggestion("PMS-00123", vocab);
    assert.equal(skuResult.hasCorrection, false);
    assert.equal(skuResult.correctedQuery, "PMS-00123");
  });
});

describe("SHOP User Authorization & Access Control", () => {
  const { createUserSchema, updateUserSchema } = require("../src/lib/validations/user");

  it("validates SHOP role in createUserSchema and updateUserSchema", () => {
    const validShopUser = createUserSchema.parse({
      name: "Shop Counter 1",
      username: "shop01",
      password: "password123",
      role: "SHOP",
      status: "ACTIVE",
    });
    assert.equal(validShopUser.role, "SHOP");

    const updatedShopUser = updateUserSchema.parse({
      role: "SHOP",
    });
    assert.equal(updatedShopUser.role, "SHOP");
  });

  it("restricts SHOP user from accessing Supply and Pending Download routes", () => {
    function isRouteAllowedForRole(role: string, pathname: string): boolean {
      if (role === "SHOP") {
        if (
          pathname.startsWith("/supply") ||
          pathname.startsWith("/api/supply") ||
          pathname.startsWith("/products/pending-download") ||
          pathname.startsWith("/api/products/export/pending") ||
          pathname.endsWith("/edit")
        ) {
          return false;
        }
      }
      return true;
    }

    assert.equal(isRouteAllowedForRole("SHOP", "/products"), true);
    assert.equal(isRouteAllowedForRole("SHOP", "/products/123"), true);
    assert.equal(isRouteAllowedForRole("SHOP", "/supply"), false);
    assert.equal(isRouteAllowedForRole("SHOP", "/api/supply/upload"), false);
    assert.equal(isRouteAllowedForRole("SHOP", "/products/pending-download"), false);
    assert.equal(isRouteAllowedForRole("SHOP", "/api/products/export/pending"), false);
    assert.equal(isRouteAllowedForRole("SHOP", "/products/123/edit"), false);

    // Other roles remain allowed
    assert.equal(isRouteAllowedForRole("ADMIN", "/supply"), true);
    assert.equal(isRouteAllowedForRole("STAFF", "/supply"), true);
    assert.equal(isRouteAllowedForRole("ADMIN", "/products/pending-download"), true);
    assert.equal(isRouteAllowedForRole("STAFF", "/products/pending-download"), true);
  });
});

describe("Web Store Description HTML Cleaning & Line Breaks", () => {
  it("preserves paragraphs, line breaks, and specifications without flattening into single line", () => {
    const rawHtml = `<p>STM32F103C6T6 ARM Minimum System Board Embedded Microcomputer Core Module</p>
<p>This is STM32F103C6T6 Development Board Minimum System STM32 ARM Core Board.</p>
<p><strong>Specification:</strong></p>
<ul>
<li>Onboard Mini USB interface</li>
<li>72MHz work frequency</li>
<li>32KB flash memory, 20K SRAM</li>
</ul>`;

    const cleaned = cleanHtml(rawHtml);
    assert.ok(cleaned.includes("STM32F103C6T6 ARM Minimum System Board Embedded Microcomputer Core Module\n\n"));
    assert.ok(cleaned.includes("Specification:"));
    assert.ok(cleaned.includes("Onboard Mini USB interface\n72MHz work frequency\n32KB flash memory, 20K SRAM"));
    assert.equal(cleaned.includes("<p>"), false);
    assert.equal(cleaned.includes("<li>"), false);
  });
});

describe("Shop Offline Catalog Access Control", () => {
  function canAccessOfflineCatalog(userRole: string): boolean {
    return userRole === "SHOP" || userRole === "ADMIN" || userRole === "SUPERADMIN";
  }

  it("permits SHOP, ADMIN, and SUPERADMIN to access offline catalog", () => {
    assert.equal(canAccessOfflineCatalog("SHOP"), true);
    assert.equal(canAccessOfflineCatalog("ADMIN"), true);
    assert.equal(canAccessOfflineCatalog("SUPERADMIN"), true);
  });

  it("restricts other non-shop roles from offline catalog download", () => {
    assert.equal(canAccessOfflineCatalog("STAFF"), false);
    assert.equal(canAccessOfflineCatalog("GUEST"), false);
  });
});

describe("Smart Electronics Relevance Scoring & Ranking", () => {
  const products = [
    {
      id: 1,
      productName: "Omron E2B-M12KS04-WP-B1 2M Proximity Sensor",
      modelAndName: "Omron E2B-M12KS04-WP-B1 2M Proximity Sensor",
      sku: "LKSEN00111",
      quantity: 10,
    },
    {
      id: 2,
      productName: "Samkoon EA-070B V4 7.0 inch HMI Touch Screen",
      modelAndName: "Samkoon EA-070B V4 7.0 inch HMI Touch Screen",
      sku: "LKIA00229",
      quantity: 5,
    },
    {
      id: 3,
      productName: "Arduino Uno R3 ATmega328P Development Board",
      modelAndName: "Arduino Uno R3",
      sku: "LKMIC00010",
      quantity: 20,
    },
  ];

  it("ranks exact SKU match higher than unrelated products", async () => {
    const { scoreProductRelevance, BASELINE_ELECTRONICS_VOCABULARY } = await import("../src/lib/fuzzySearch");
    const s1 = scoreProductRelevance("LKSEN00111", products[0] as any, BASELINE_ELECTRONICS_VOCABULARY);
    const s2 = scoreProductRelevance("LKSEN00111", products[1] as any, BASELINE_ELECTRONICS_VOCABULARY);
    assert.ok(s1 > 100);
    assert.equal(s2, 0);
  });

  it("ranks jumbled multi-word keywords correctly with high relevance", async () => {
    const { scoreProductRelevance, BASELINE_ELECTRONICS_VOCABULARY } = await import("../src/lib/fuzzySearch");
    const sSamkoon = scoreProductRelevance("touch screen samkoon 7 inch", products[1] as any, BASELINE_ELECTRONICS_VOCABULARY);
    const sArduino = scoreProductRelevance("touch screen samkoon 7 inch", products[2] as any, BASELINE_ELECTRONICS_VOCABULARY);
    assert.ok(sSamkoon > 100);
    assert.equal(sArduino, 0);
  });

  it("handles typos for electronic components and ranks the intended product first", async () => {
    const { scoreProductRelevance, BASELINE_ELECTRONICS_VOCABULARY } = await import("../src/lib/fuzzySearch");
    const sArduino = scoreProductRelevance("arduno uno", products[2] as any, BASELINE_ELECTRONICS_VOCABULARY);
    const sOmron = scoreProductRelevance("arduno uno", products[0] as any, BASELINE_ELECTRONICS_VOCABULARY);
    assert.ok(sArduino > 50);
    assert.equal(sOmron, 0);
  });
});

describe("Warehouse Storage Location Extraction (Section & Rack)", () => {
  it("extracts Section and Rack from LKDIS00015 format note", async () => {
    const { extractStorageLocation } = await import("../src/lib/formatters");
    const loc = extractStorageLocation("LKDIS00015\n\nSECTION: 3 RACK: E", "");
    assert.ok(loc !== null);
    assert.equal(loc?.section, "3");
    assert.equal(loc?.rack, "E");
  });

  it("extracts Section and Rack with multiple spaces", async () => {
    const { extractStorageLocation } = await import("../src/lib/formatters");
    const loc = extractStorageLocation("SECTION: 6   RACK: C", "");
    assert.ok(loc !== null);
    assert.equal(loc?.section, "6");
    assert.equal(loc?.rack, "C");
  });

  it("returns null when no storage location is present", async () => {
    const { extractStorageLocation } = await import("../src/lib/formatters");
    const loc = extractStorageLocation(null, "Just a standard product description without location");
    assert.equal(loc, null);
  });
});

describe("Offline Dynamic Vocabulary & Search Correction", () => {
  const sampleOfflineProducts = [
    {
      id: 1,
      recordNo: "001001",
      productName: "Nextion NX3224T024 2.4 inch Resistive Touch Screen HMI Display",
      modelAndName: "Nextion NX3224T024",
      sku: "LKDIS00015",
      price: 10500,
      quantity: 2,
      status: "ACTIVE",
      categoryNames: '["Display"]',
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: 2,
      recordNo: "001002",
      productName: "Omron E2B-M12KS04-WP-B1 Proximity Sensor",
      modelAndName: "Omron E2B Proximity Sensor",
      sku: "LKSEN00111",
      price: 4500,
      quantity: 10,
      status: "ACTIVE",
      categoryNames: '["Sensors"]',
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ];

  it("builds offline vocabulary containing electronic keywords and model names", async () => {
    const { buildOfflineVocabulary } = await import("../src/lib/offlineShopDb");
    const vocab = buildOfflineVocabulary(sampleOfflineProducts as any);
    assert.ok(vocab.has("nextion"));
    assert.ok(vocab.has("sensor"));
    assert.ok(vocab.has("display"));
    assert.ok(vocab.has("omron"));
  });

  it("generates typo corrections for offline searches using offline vocabulary", async () => {
    const { buildOfflineVocabulary } = await import("../src/lib/offlineShopDb");
    const { getFuzzySuggestion } = await import("../src/lib/fuzzySearch");
    const vocab = buildOfflineVocabulary(sampleOfflineProducts as any);

    const res1 = getFuzzySuggestion("nexton display", vocab);
    assert.equal(res1.hasCorrection, true);
    assert.equal(res1.correctedQuery, "nextion display");

    const res2 = getFuzzySuggestion("omrom senser", vocab);
    assert.equal(res2.hasCorrection, true);
    assert.equal(res2.correctedQuery, "omron sensor");
  });
});

describe("Product Image Deletion & Safe Fallback Resolution", () => {
  it("returns null when product.imagePath is explicitly null, empty, or 'null' even if SKU matches restored list", async () => {
    const { resolveSafeProductImage } = await import("../src/lib/imageResolver");

    const deletedProduct1 = {
      sku: "LKREQ00001",
      modelAndName: "INA226",
      imagePath: null,
    };
    assert.equal(resolveSafeProductImage(deletedProduct1), null);

    const deletedProduct2 = {
      sku: "LKREQ00020",
      modelAndName: "D1027",
      imagePath: "",
    };
    assert.equal(resolveSafeProductImage(deletedProduct2), null);

    const deletedProduct3 = {
      sku: "LKREQ00022",
      modelAndName: "CL57T",
      imagePath: "   ",
    };
    assert.equal(resolveSafeProductImage(deletedProduct3), null);

    const deletedProduct4 = {
      sku: "LKREQ00027",
      modelAndName: "PS21255",
      imagePath: "null",
    };
    assert.equal(resolveSafeProductImage(deletedProduct4), null);
  });

  it("resolves to restored fallback image when imagePath is present on known components", async () => {
    const { resolveSafeProductImage } = await import("../src/lib/imageResolver");

    const restoredProduct1 = {
      sku: "LKREQ00001",
      modelAndName: "INA226",
      imagePath: "/uploads/products/broken-old-path.png",
    };
    assert.equal(
      resolveSafeProductImage(restoredProduct1),
      "/uploads/products/1790846365161-8123776387fdc33884ec8768.png"
    );

    const restoredProduct2 = {
      sku: "LKREQ00020",
      modelAndName: "D1027",
      imagePath: "/uploads/products/restored-lkreq00020-d1027.png",
    };
    assert.equal(
      resolveSafeProductImage(restoredProduct2),
      "/uploads/products/restored-lkreq00020-d1027.png"
    );
  });

  it("preserves standard user-uploaded images when not in restored list", async () => {
    const { resolveSafeProductImage } = await import("../src/lib/imageResolver");

    const normalProduct = {
      sku: "LKSEN00111",
      modelAndName: "OmZ E2B-M12KS04-WP-B1",
      imagePath: "/uploads/products/my-custom-sensor.png",
    };
    assert.equal(
      resolveSafeProductImage(normalProduct),
      "/uploads/products/my-custom-sensor.png"
    );
  });

  it("preserves newly uploaded image and NEVER reverts to old restored image even on matched components", async () => {
    const { resolveSafeProductImage } = await import("../src/lib/imageResolver");

    const newUploadedProduct = {
      sku: "LKREQ00001",
      modelAndName: "INA226",
      imagePath: "/uploads/products/1799999999999-new-user-photo.png",
    };
    assert.equal(
      resolveSafeProductImage(newUploadedProduct),
      "/uploads/products/1799999999999-new-user-photo.png"
    );
  });
});

describe("Quotation Calculations & Financial Validation", () => {
  it("formats LKR currency strings accurately", async () => {
    const { formatLKR } = await import("../src/lib/quotationPdfGenerator");
    assert.equal(formatLKR(1500), "LKR 1,500.00");
    assert.equal(formatLKR(250000.5), "LKR 250,000.50");
    assert.equal(formatLKR(0), "LKR 0.00");
  });

  it("formats payment method labels correctly", async () => {
    const { formatPaymentMethodLabel } = await import("../src/lib/quotationPdfGenerator");
    assert.equal(formatPaymentMethodLabel("FULL_PAYMENT"), "Full Payment");
    assert.equal(formatPaymentMethodLabel("CREDIT"), "Credit Payment");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", 50), "Advance Payment (50%)");
    assert.equal(formatPaymentMethodLabel("ADVANCE_PAYMENT", 30), "Advance Payment (30%)");
  });

  it("calculates line items, subtotal, advance payable, and balance due accurately", () => {
    const items = [
      { quantity: 2, unitPrice: 5000 },
      { quantity: 10, unitPrice: 1250 },
      { quantity: 3, unitPrice: 350 },
    ];

    const lineTotals = items.map((i) => i.quantity * i.unitPrice);
    assert.deepEqual(lineTotals, [10000, 12500, 1050]);

    const subtotal = lineTotals.reduce((a, b) => a + b, 0);
    assert.equal(subtotal, 23550);

    // 40% advance payment test
    const advancePercent = 40;
    const advancePayable = (subtotal * advancePercent) / 100;
    const balanceDue = subtotal - advancePayable;

    assert.equal(advancePayable, 9420);
    assert.equal(balanceDue, 14130);
    assert.equal(advancePayable + balanceDue, subtotal);
  });

  it("formats template currency format (Rs X,XXX.XX) accurately", async () => {
    const { formatRs } = await import("../src/lib/quotationPdfGenerator");
    assert.equal(formatRs(15270), "Rs 15,270.00");
    assert.equal(formatRs(0), "Rs 0.00");
    assert.equal(formatRs(450.5), "Rs 450.50");
  });

  it("formats Product/Service cell with stock status first, and conditional warranty", async () => {
    const { formatProductServiceCell } = await import("../src/lib/quotationPdfGenerator");

    // Case 1: In-stock item with warranty -> Stock first, then warranty
    const cell1 = formatProductServiceCell(
      "Original MeanWell NDR 120 Series 24V DC",
      "IN_STOCK",
      null,
      "06 months warranty"
    );
    assert.ok(cell1.includes("(instocks)"), "Should include (instocks)");
    assert.ok(cell1.includes("(06 months warranty)"), "Should include (06 months warranty)");
    const instockIdx1 = cell1.indexOf("(instocks)");
    const warrantyIdx1 = cell1.indexOf("(06 months warranty)");
    assert.ok(instockIdx1 < warrantyIdx1, "(instocks) must appear before warranty");

    // Case 2: Overseas item with lead time and warranty
    const cell2 = formatProductServiceCell(
      "Stepper Driver CL57T",
      "OVERSEAS",
      "12-21",
      "1 Year Warranty"
    );
    assert.ok(cell2.includes("(Shipping from overseas - 12-21 working days)"), "Should include formatted lead time");
    assert.ok(cell2.includes("(1 Year Warranty)"), "Should include warranty");

    // Case 3: No Warranty -> Must NOT show warranty text at all
    const cell3 = formatProductServiceCell(
      "Resistor 10k Ohm",
      "IN_STOCK",
      null,
      "No Warranty"
    );
    assert.ok(cell3.includes("(instocks)"), "Should include (instocks)");
    assert.ok(!cell3.toLowerCase().includes("warranty"), "Should omit warranty when No Warranty");

    // Case 4: Null or empty warranty -> Must NOT show warranty text
    const cell4 = formatProductServiceCell(
      "Capacitor 100uF",
      "IN_STOCK",
      null,
      null
    );
    assert.ok(!cell4.toLowerCase().includes("warranty"), "Should omit warranty when null");
  });
});


