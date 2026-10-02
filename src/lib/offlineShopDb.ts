/**
 * Client-side IndexedDB Storage & Search Engine for SHOP Users (Offline Mode)
 * Stores full product catalog locally in the browser so that search, filtering,
 * and viewing product specifications work 100% offline without network connection.
 */

import {
  scoreProductRelevance,
  BASELINE_ELECTRONICS_VOCABULARY,
} from "./fuzzySearch";

const DB_NAME = "PMS_SHOP_OFFLINE_DB";
const DB_VERSION = 1;
const STORE_PRODUCTS = "products";
const STORE_META = "metadata";

export interface ShopOfflineProduct {
  id: number;
  recordNo: string;
  referenceNo?: string | null;
  productName: string;
  modelAndName?: string | null;
  sku?: string | null;
  productDate?: string | null;
  price: number;
  priceLKR?: number | null;
  quantity: number;
  imagePath?: string | null;
  source?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  referenceLink?: string | null;
  description?: string | null;
  additionalNote?: string | null;
  stockStatus?: string | null;
  shippingClass?: string | null;
  status: string;
  categoryNames?: string | null;
  category?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineSearchResult {
  products: ShopOfflineProduct[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  fromOfflineCache: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const productStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: "id" });
        productStore.createIndex("sku", "sku", { unique: false });
        productStore.createIndex("source", "source", { unique: false });
        productStore.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

export type ShopOfflineSyncStatus =
  | "idle"
  | "syncing"
  | "downloading_images"
  | "synced"
  | "offline";

export function notifyShopSyncStatus(
  status: ShopOfflineSyncStatus,
  detail?: { count?: number; doneImages?: number; totalImages?: number } | number
) {
  if (typeof window === "undefined") return;
  const count = typeof detail === "number" ? detail : detail?.count ?? 0;
  const doneImages = typeof detail === "object" ? detail.doneImages ?? 0 : 0;
  const totalImages = typeof detail === "object" ? detail.totalImages ?? 0 : 0;

  window.dispatchEvent(
    new CustomEvent("pms_shop_offline_status", {
      detail: {
        status,
        count,
        doneImages,
        totalImages,
        timestamp: new Date().toISOString(),
      },
    })
  );
}

/**
 * Downloads latest product catalog from server and persists into browser's IndexedDB,
 * and caches all product images locally for 100% offline image viewing.
 */
export async function syncShopCatalogToIndexedDb(): Promise<{ count: number; timestamp: string }> {
  notifyShopSyncStatus("syncing");
  try {
    const res = await fetch("/api/shop/offline-catalog", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Catalog fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    const products: ShopOfflineProduct[] = data.products || [];
    const timestamp = data.timestamp || new Date().toISOString();

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PRODUCTS, STORE_META], "readwrite");
      const productStore = tx.objectStore(STORE_PRODUCTS);
      const metaStore = tx.objectStore(STORE_META);

      // Clear existing cached products and bulk insert updated list
      productStore.clear();
      for (const p of products) {
        productStore.put(p);
      }

      metaStore.put({ key: "lastSyncTime", value: timestamp });
      metaStore.put({ key: "productCount", value: products.length });
      metaStore.put({ key: "version", value: data.version || Date.now() });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Failed to write to IndexedDB"));
    });

    // Filter strictly to Web Store products (ONLINE_WEB / LK_TRONICS)
    // Do not download internal PMS-added product images
    const webProducts = products.filter(
      (p) => p.source === "ONLINE_WEB" || p.source === "LK_TRONICS" || Boolean(p.externalId)
    );
    const imageUrls = Array.from(
      new Set(
        webProducts
          .map((p) => p.imagePath)
          .filter(
            (u): u is string =>
              Boolean(u && (u.startsWith("http://") || u.startsWith("https://")))
          )
      )
    );

    if (imageUrls.length > 0 && typeof window !== "undefined" && "caches" in window) {
      // Check and download only missing images in the background without blocking
      preCacheProductImages(imageUrls, (done, total) => {
        if (done < total) {
          notifyShopSyncStatus("downloading_images", {
            count: products.length,
            doneImages: done,
            totalImages: total,
          });
        } else {
          notifyShopSyncStatus("synced", {
            count: products.length,
            doneImages: total,
            totalImages: total,
          });
        }
      })
        .then((result) => {
          notifyShopSyncStatus("synced", {
            count: products.length,
            doneImages: result.cachedCount,
            totalImages: result.total,
          });
        })
        .catch(() => {
          notifyShopSyncStatus("synced", { count: products.length });
        });
    } else {
      notifyShopSyncStatus("synced", { count: products.length });
    }

    return { count: products.length, timestamp };
  } catch (err) {
    console.warn("Shop offline sync warning (will use existing cached data):", err);
    getShopOfflineMeta().then((meta) => {
      notifyShopSyncStatus("offline", { count: meta.count });
    });
    throw err;
  }
}

/**
 * Pre-caches web image URLs into browser Cache Storage in controlled batches.
 * Skips images that are already present in Cache Storage to minimize network usage and avoid re-downloading on refresh.
 */
export async function preCacheProductImages(
  images: string[],
  onProgress?: (cachedCount: number, total: number) => void
): Promise<{ cachedCount: number; total: number }> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { cachedCount: 0, total: images.length };
  }
  try {
    const cache = await caches.open("pms-shop-cache-v3");
    // Filter strictly to external Web Store URLs (http:// or https://)
    const validUrls = images
      .filter(Boolean)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http://") || u.startsWith("https://"));

    const uniqueUrls = Array.from(new Set(validUrls));
    const total = uniqueUrls.length;
    if (total === 0) return { cachedCount: 0, total: 0 };

    // Step 1: Fast parallel check to identify ONLY images not yet stored in cache
    const missingUrls: string[] = [];
    const checkBatchSize = 40;
    for (let i = 0; i < uniqueUrls.length; i += checkBatchSize) {
      const batch = uniqueUrls.slice(i, i + checkBatchSize);
      const results = await Promise.all(
        batch.map(async (url) => {
          try {
            const match = await cache.match(url, { ignoreVary: true, ignoreSearch: true });
            return match ? null : url;
          } catch {
            return url;
          }
        })
      );
      for (const r of results) {
        if (r) missingUrls.push(r);
      }
    }

    const alreadyCachedCount = total - missingUrls.length;

    // If all images are already cached (e.g. on page refresh), return immediately with 0 network calls!
    if (missingUrls.length === 0) {
      if (onProgress) onProgress(total, total);
      return { cachedCount: total, total };
    }

    // Step 2: Download only the missing images in controlled batches of 10
    if (onProgress) {
      onProgress(alreadyCachedCount, total);
    }

    let newlyCached = 0;
    const downloadBatchSize = 10;

    for (let i = 0; i < missingUrls.length; i += downloadBatchSize) {
      const batch = missingUrls.slice(i, i + downloadBatchSize);
      await Promise.all(
        batch.map(async (url) => {
          try {
            const req = new Request(url, { mode: "no-cors", credentials: "omit" });
            const res = await fetch(req);
            if (
              res &&
              (res.status === 200 || res.type === "opaque" || res.status === 0)
            ) {
              await cache.put(url, res.clone());
              await cache.put(req, res);
            }
          } catch (e) {
            // Soft-fail individual image fetch error without interrupting overall sync
          } finally {
            newlyCached++;
            if (onProgress && (newlyCached % 4 === 0 || alreadyCachedCount + newlyCached === total)) {
              onProgress(alreadyCachedCount + newlyCached, total);
            }
          }
        })
      );
    }
    return { cachedCount: alreadyCachedCount + newlyCached, total };
  } catch (err) {
    console.warn("Image pre-caching warning:", err);
    return { cachedCount: 0, total: images.length };
  }
}

/**
 * Detailed status of local offline database and cached images.
 */
export interface ShopCacheDetailedStatus {
  totalProducts: number;
  totalImages: number;
  cachedImages: number;
  lastSyncTime: string | null;
}

/**
 * Checks exact count of products and web images stored in IndexedDB and Service Worker Cache Storage.
 */
export async function getShopCacheDetails(): Promise<ShopCacheDetailedStatus> {
  try {
    const db = await openDb();
    const products: ShopOfflineProduct[] = await new Promise((resolve) => {
      const tx = db.transaction([STORE_PRODUCTS], "readonly");
      const store = tx.objectStore(STORE_PRODUCTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const meta = await getShopOfflineMeta();
    // Count only Web Store product images
    const webProducts = products.filter(
      (p) => p.source === "ONLINE_WEB" || p.source === "LK_TRONICS" || Boolean(p.externalId)
    );
    const imageUrls = Array.from(
      new Set(
        webProducts
          .map((p) => p.imagePath)
          .filter(
            (u): u is string =>
              Boolean(u && (u.startsWith("http://") || u.startsWith("https://")))
          )
      )
    );

    let cachedCount = 0;
    if (typeof window !== "undefined" && "caches" in window) {
      const cache = await caches.open("pms-shop-cache-v3");
      const batchSize = 40;
      for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        const matchResults = await Promise.all(
          batch.map(async (url) => {
            try {
              const match = await cache.match(url, { ignoreVary: true, ignoreSearch: true });
              return match ? 1 : 0;
            } catch {
              return 0;
            }
          })
        );
        cachedCount += matchResults.reduce((sum: number, val: number) => sum + val, 0);
      }
    }

    return {
      totalProducts: products.length,
      totalImages: imageUrls.length,
      cachedImages: cachedCount,
      lastSyncTime: meta.lastSyncTime,
    };
  } catch (err) {
    return {
      totalProducts: 0,
      totalImages: 0,
      cachedImages: 0,
      lastSyncTime: null,
    };
  }
}

/**
 * Manually forces re-downloading and caching of all web catalog images.
 */
export async function forceSyncShopImages(
  onProgress?: (done: number, total: number) => void
): Promise<{ done: number; total: number }> {
  const db = await openDb();
  const products: ShopOfflineProduct[] = await new Promise((resolve) => {
    const tx = db.transaction([STORE_PRODUCTS], "readonly");
    const store = tx.objectStore(STORE_PRODUCTS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  const webProducts = products.filter(
    (p) => p.source === "ONLINE_WEB" || p.source === "LK_TRONICS" || Boolean(p.externalId)
  );
  const imageUrls = Array.from(
    new Set(
      webProducts
        .map((p) => p.imagePath)
        .filter(
          (u): u is string =>
            Boolean(u && (u.startsWith("http://") || u.startsWith("https://")))
        )
    )
  );

  const result = await preCacheProductImages(imageUrls, (done, total) => {
    notifyShopSyncStatus("downloading_images", {
      count: products.length,
      doneImages: done,
      totalImages: total,
    });
    if (onProgress) onProgress(done, total);
  });

  notifyShopSyncStatus("synced", {
    count: products.length,
    doneImages: result.cachedCount,
    totalImages: result.total,
  });

  return { done: result.cachedCount, total: result.total };
}

/**
 * Retrieves metadata about the local offline store.
 */
export async function getShopOfflineMeta(): Promise<{ lastSyncTime: string | null; count: number }> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_META], "readonly");
      const metaStore = tx.objectStore(STORE_META);

      let lastSyncTime: string | null = null;
      let count = 0;

      const reqSync = metaStore.get("lastSyncTime");
      reqSync.onsuccess = () => {
        if (reqSync.result) lastSyncTime = reqSync.result.value;
      };

      const reqCount = metaStore.get("productCount");
      reqCount.onsuccess = () => {
        if (reqCount.result) count = reqCount.result.value;
      };

      tx.oncomplete = () => resolve({ lastSyncTime, count });
      tx.onerror = () => resolve({ lastSyncTime: null, count: 0 });
    });
  } catch {
    return { lastSyncTime: null, count: 0 };
  }
}

/**
 * Searches and filters products directly inside IndexedDB when offline.
 */
export async function searchShopIndexedDb(params: {
  search?: string;
  status?: string;
  source?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}): Promise<OfflineSearchResult> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUCTS], "readonly");
    const store = tx.objectStore(STORE_PRODUCTS);
    const req = store.getAll();

    req.onsuccess = () => {
      let items: ShopOfflineProduct[] = req.result || [];

      const search = (params.search || "").trim().toLowerCase();
      const status = params.status || "ALL";
      const source = params.source || "ONLINE_WEB";
      const categoryId = params.categoryId || "ALL";
      const page = Math.max(1, params.page || 1);
      const limit = Math.max(1, params.limit || 25);

      // Filter by Source (ONLINE_WEB, PMS, ALL)
      if (source !== "ALL") {
        if (source === "PMS") {
          items = items.filter((p) => p.source !== "ONLINE_WEB" && p.source !== "LK_TRONICS" && !p.externalId);
        } else {
          items = items.filter(
            (p) => p.source === "ONLINE_WEB" || p.source === "LK_TRONICS" || Boolean(p.externalId)
          );
        }
      }

      // Filter by Status
      if (status !== "ALL") {
        if (status === "PRICE_NOT_AVAILABLE") {
          items = items.filter(
            (p) => p.status === "PRICE_NOT_AVAILABLE" || !p.price || Number(p.priceLKR || p.price) === 0
          );
        } else if (status === "ACTIVE") {
          items = items.filter((p) => p.status === "ACTIVE" && Number(p.priceLKR || p.price) > 0);
        } else {
          items = items.filter((p) => p.status === status);
        }
      }

      // Filter by Category
      if (categoryId !== "ALL") {
        const catIdNum = parseInt(categoryId, 10);
        if (!isNaN(catIdNum)) {
          items = items.filter((p) => {
            if (p.category?.id === catIdNum) return true;
            if (p.categoryNames && p.categoryNames.toLowerCase().includes(categoryId.toLowerCase())) return true;
            return false;
          });
        }
      }

      // Smart Weighted Relevance & Fuzzy Search for Electronics
      if (search) {
        const scoredItems: { product: ShopOfflineProduct; score: number }[] = [];
        for (const p of items) {
          const score = scoreProductRelevance(search, p, BASELINE_ELECTRONICS_VOCABULARY);
          if (score > 0) {
            scoredItems.push({ product: p, score });
          }
        }
        // Sort descending: closest/best matches appear first
        scoredItems.sort((a, b) => b.score - a.score);
        items = scoredItems.map((s) => s.product);
      }

      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const skip = (page - 1) * limit;
      const paginated = items.slice(skip, skip + limit);

      resolve({
        products: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
        fromOfflineCache: true,
      });
    };

    req.onerror = () => reject(req.error || new Error("Failed to read from IndexedDB"));
  });
}

/**
 * Retrieves a single product by ID from local IndexedDB storage.
 */
export async function getShopProductFromIndexedDb(id: number): Promise<ShopOfflineProduct | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUCTS], "readonly");
    const store = tx.objectStore(STORE_PRODUCTS);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error(`Failed to load product ${id} from IndexedDB`));
  });
}
