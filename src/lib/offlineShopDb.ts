/**
 * Client-side IndexedDB Storage & Search Engine for SHOP Users (Offline Mode)
 * Stores full product catalog locally in the browser so that search, filtering,
 * and viewing product specifications work 100% offline without network connection.
 */

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

/**
 * Downloads latest product catalog from server and persists into browser's IndexedDB.
 */
export async function syncShopCatalogToIndexedDb(): Promise<{ count: number; timestamp: string }> {
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

    return { count: products.length, timestamp };
  } catch (err) {
    console.warn("Shop offline sync warning (will use existing cached data):", err);
    throw err;
  }
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

      // Multi-word keyword search
      if (search) {
        const keywords = search.split(/\s+/).filter(Boolean);
        items = items.filter((p) => {
          const skuText = (p.sku || p.recordNo || p.referenceNo || "").toLowerCase();
          const nameText = (p.modelAndName || p.productName || "").toLowerCase();
          const descText = (p.description || "").toLowerCase();
          const catText = (p.categoryNames || p.category?.name || "").toLowerCase();

          const combined = `${skuText} ${nameText} ${descText} ${catText}`;
          return keywords.every((kw) => combined.includes(kw));
        });
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
