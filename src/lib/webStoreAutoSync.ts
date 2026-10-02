import { prisma } from "@/lib/prisma";
import { getNextRecordNo, withSequenceLock } from "@/lib/recordNo";

export function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|blockquote)>\s*/gi, "\n\n")
    .replace(/<\/li>\s*<li[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<\/(li|ul|ol|table|thead|tbody)>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&#39;|&apos;/gi, "'")
    .replace(/&bull;/gi, "•")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&ldquo;|&#8220;|&rdquo;|&#8221;/gi, '"')
    .replace(/&lsquo;|&#8216;|&rsquo;|&#8217;/gi, "'")
    .replace(/&deg;/gi, "°")
    .replace(/VISIT OUR (?:FACEBOOK PAGE|SHOP).*$/gim, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\b(?:Specification|Specifications|Features|Package Included|Package Includes|Package Content|Pinout|Pinouts|Overview|Note|Description):\s*)\n\n+/gi, "$1\n")
    .trim();
}

export function getWooCommerceConfig() {
  const storeUrl = process.env.WC_STORE_URL || "https://lk-tronics.com";
  const consumerKey = process.env.WC_CONSUMER_KEY;
  const consumerSecret = process.env.WC_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error(
      "Missing WooCommerce credentials: WC_CONSUMER_KEY and WC_CONSUMER_SECRET must be configured in environment variables."
    );
  }

  const authHeader =
    "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  return { storeUrl, consumerKey, consumerSecret, authHeader };
}

let lastAutoSyncTimestamp = 0;
let isAutoSyncRunning = false;
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function syncWebStoreBatch(options: {
  page?: number;
  perPage?: number;
  syncAll?: boolean;
  maxPages?: number;
  userId?: number;
}) {
  const { storeUrl, authHeader } = getWooCommerceConfig();
  const page = Math.max(1, options.page || 1);
  const perPage = Math.min(100, Math.max(1, options.perPage || 50));
  const syncAll = Boolean(options.syncAll);
  const maxPages = syncAll ? Math.min(20, options.maxPages || 10) : 1;

  // Find a fallback user id (Admin or system) if not provided
  let userId = options.userId;
  if (!userId) {
    const adminUser = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "SUPERADMIN"] } },
      select: { id: true },
    });
    userId = adminUser?.id || 1;
  }

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;
  let storeTotalProducts = 0;
  let storeTotalPages = 1;

  const categoryCache = new Map<string, number>();
  const existingCategories = await prisma.category.findMany();
  for (const cat of existingCategories) {
    categoryCache.set(cat.name.toLowerCase().trim(), cat.id);
  }

  const pagesToFetch = syncAll ? maxPages : 1;

  for (let p = 0; p < pagesToFetch; p++) {
    const pageToQuery = syncAll ? p + 1 : page;
    const url = `${storeUrl}/wp-json/wc/v3/products?page=${pageToQuery}&per_page=${perPage}&status=publish`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(`WebStore Sync: Failed page ${pageToQuery}: HTTP ${response.status}`);
        break;
      }

      storeTotalProducts = parseInt(
        response.headers.get("x-wp-total") || String(storeTotalProducts),
        10
      );
      storeTotalPages = parseInt(
        response.headers.get("x-wp-totalpages") || "1",
        10
      );

      const items: any[] = await response.json();
      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items) {
        try {
          const externalId = String(item.id);
          const rawSku = item.sku?.trim();
          const sku = rawSku && rawSku.length > 0 ? rawSku : `LKW-${item.id}`;
          const name = (item.name || "").trim() || `Product ${item.id}`;

          // Price parsing
          let priceNum = 0;
          if (item.price) {
            priceNum = parseFloat(item.price);
          } else if (item.regular_price) {
            priceNum = parseFloat(item.regular_price);
          }
          if (isNaN(priceNum) || priceNum < 0) priceNum = 0;
          const productStatus = priceNum > 0 ? "ACTIVE" : "PRICE_NOT_AVAILABLE";

          // Quantity & Stock Status
          let qty = 1;
          if (item.stock_quantity !== null && item.stock_quantity !== undefined) {
            qty = Math.max(0, parseInt(item.stock_quantity, 10));
          } else if (item.stock_status === "outofstock") {
            qty = 0;
          }
          const stockStatus = item.stock_status || (qty > 0 ? "instock" : "outofstock");
          const shippingClass =
            item.shipping_class ||
            (item.shipping_class_id === 2738 ? "over-the-sea" : null) ||
            null;

          // Web site permalink used as reference link
          const permalink = item.permalink || `${storeUrl}/?post_type=product&p=${item.id}`;
          const imageUrl = item.images?.[0]?.src || null;
          const description = cleanHtml(item.description || item.short_description || "");
          const weightNum = item.weight ? parseFloat(item.weight) : null;

          // Category mapping (supports multiple categories per product)
          let primaryCategoryId: number | null = null;
          const allCatNames: string[] = [];

          if (Array.isArray(item.categories) && item.categories.length > 0) {
            const rawNames = item.categories
              .map((c: any) => c?.name?.trim())
              .filter((n: any): n is string => Boolean(n && n.length > 0));
            const uniqueCatNames: string[] = Array.from(new Set(rawNames));

            for (const catName of uniqueCatNames) {
              allCatNames.push(catName);
              const lowerCat = catName.toLowerCase();
              let cId: number | null = null;

              if (categoryCache.has(lowerCat)) {
                cId = categoryCache.get(lowerCat)!;
              } else {
                try {
                  const newCat = await prisma.category.create({
                    data: { name: catName },
                  });
                  cId = newCat.id;
                  categoryCache.set(lowerCat, newCat.id);
                } catch {
                  const existingCat = await prisma.category.findUnique({
                    where: { name: catName },
                  });
                  if (existingCat) {
                    cId = existingCat.id;
                    categoryCache.set(lowerCat, existingCat.id);
                  }
                }
              }

              if (primaryCategoryId === null && cId !== null) {
                primaryCategoryId = cId;
              }
            }
          }

          const categoryNamesJson = allCatNames.length > 0 ? JSON.stringify(allCatNames) : null;

          // Check if product exists by externalId or SKU
          const existing = await prisma.product.findFirst({
            where: {
              OR: [
                { externalId: externalId },
                ...(rawSku ? [{ sku: rawSku }] : []),
              ],
            },
          });

          if (existing) {
            // If the product is PENDING (awaiting supplier quote) or EXPIRED,
            // preserve that status so web store sync does not overwrite it back to ACTIVE
            const targetStatus =
              existing.status === "PENDING"
                ? "PENDING"
                : existing.status === "EXPIRED"
                ? "EXPIRED"
                : productStatus;

            // Update existing product with latest online web data
            await prisma.product.update({
              where: { id: existing.id },
              data: {
                productName: name,
                modelAndName: name,
                price: priceNum,
                priceLKR: priceNum,
                quantity: qty,
                stockStatus: stockStatus,
                status: targetStatus,
                shippingClass: shippingClass || existing.shippingClass,
                externalId: externalId,
                externalUrl: permalink,
                referenceLink: permalink, // Use website product link as reference link
                imagePath: imageUrl || existing.imagePath,
                source: "ONLINE_WEB",
                description: description || existing.description,
                ...(existing.status !== "PENDING" ? { priceUpdatedAt: new Date() } : {}),
                ...(primaryCategoryId ? { categoryId: primaryCategoryId } : {}),
                ...(categoryNamesJson ? { categoryNames: categoryNamesJson } : {}),
                ...(weightNum !== null && !isNaN(weightNum) ? { weight: weightNum } : {}),
              },
            });
            totalUpdated++;
          } else {
            // Create new Online Web product
            await withSequenceLock(prisma, async () => {
              const recordNo = await getNextRecordNo(prisma);

              await prisma.product.create({
                data: {
                  recordNo,
                  productName: name,
                  modelAndName: name,
                  sku: sku,
                  price: priceNum,
                  priceLKR: priceNum,
                  quantity: qty,
                  weight: weightNum !== null && !isNaN(weightNum) ? weightNum : null,
                  description: description || null,
                  referenceLink: permalink, // Product link on web site
                  imagePath: imageUrl,
                  source: "ONLINE_WEB",
                  externalId: externalId,
                  externalUrl: permalink,
                  stockStatus: stockStatus,
                  shippingClass: shippingClass,
                  categoryId: primaryCategoryId,
                  categoryNames: categoryNamesJson,
                  productDate: new Date(),
                  createdBy: userId,
                  status: productStatus,
                  priceUpdatedAt: new Date(),
                },
              });
            });
            totalAdded++;
          }

          totalProcessed++;
        } catch (itemErr) {
          console.error(`WebStore Sync: Error on item ${item.id}:`, itemErr);
        }
      }

      if (pageToQuery >= storeTotalPages) break;
    } catch (pageErr) {
      console.error(`WebStore Sync: Fetch error page ${pageToQuery}:`, pageErr);
      break;
    }
  }

  lastAutoSyncTimestamp = Date.now();

  return {
    success: true,
    added: totalAdded,
    updated: totalUpdated,
    processed: totalProcessed,
    storeTotalProducts,
    storeTotalPages,
    message: `Successfully synced ${totalProcessed} products (${totalAdded} added, ${totalUpdated} updated) from ${storeUrl}`,
  };
}

/**
 * Triggers automatic background sync if more than 15 minutes have elapsed since the last sync.
 * Non-blocking, executes asynchronously in the background.
 */
export async function triggerAutoSyncIfStale(): Promise<void> {
  const now = Date.now();
  if (isAutoSyncRunning) return;
  if (now - lastAutoSyncTimestamp < AUTO_SYNC_INTERVAL_MS) return;

  isAutoSyncRunning = true;
  lastAutoSyncTimestamp = now;

  // Run in background without awaiting to keep UI requests fast
  (async () => {
    try {
      console.log("[AutoSync] Starting automatic background sync from lk-tronics.com...");
      // Quick sync of newest 50 products and updates
      const res = await syncWebStoreBatch({ page: 1, perPage: 50 });
      console.log(`[AutoSync] Completed: ${res.message}`);
    } catch (err) {
      console.error("[AutoSync] Background sync error:", err);
    } finally {
      isAutoSyncRunning = false;
    }
  })();
}

/**
 * Fetches original published product data directly from the WooCommerce web store.
 * Used when reverting PMS modifications to restore original web price, name, and stock status.
 */
export async function fetchOriginalWebProduct(externalId: string | number) {
  if (!externalId) return null;

  try {
    const { storeUrl, authHeader } = getWooCommerceConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${storeUrl}/wp-json/wc/v3/products/${externalId}`, {
      headers: { Authorization: authHeader },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const item = await response.json();

    let priceNum = 0;
    if (item.price !== undefined && item.price !== null && item.price !== "") {
      priceNum = parseFloat(item.price);
    } else if (
      item.regular_price !== undefined &&
      item.regular_price !== null &&
      item.regular_price !== ""
    ) {
      priceNum = parseFloat(item.regular_price);
    }
    if (isNaN(priceNum) || priceNum < 0) priceNum = 0;

    let qty = 1;
    if (item.stock_quantity !== null && item.stock_quantity !== undefined) {
      qty = Math.max(0, parseInt(item.stock_quantity, 10));
    } else if (item.stock_status === "outofstock") {
      qty = 0;
    }
    const stockStatus = item.stock_status || (qty > 0 ? "instock" : "outofstock");
    const shippingClass =
      item.shipping_class ||
      (item.shipping_class_id === 2738 ? "over-the-sea" : null) ||
      null;

    const imageUrl = item.images?.[0]?.src || null;
    const description = cleanHtml(item.description || item.short_description || "");
    const weightNum = item.weight ? parseFloat(item.weight) : null;

    return {
      name: item.name || "",
      sku: item.sku || null,
      price: priceNum,
      quantity: qty,
      stockStatus,
      shippingClass,
      imageUrl,
      description,
      weight: weightNum !== null && !isNaN(weightNum) ? weightNum : null,
      permalink: item.permalink || null,
    };
  } catch (err) {
    console.error(`Failed to fetch original web product for externalId ${externalId}:`, err);
    return null;
  }
}
