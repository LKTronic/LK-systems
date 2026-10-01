import { describe, it } from "node:test";
import assert from "node:assert/strict";

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
