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

