// PMS Shop Offline Service Worker v7
// Provides high-reliability offline browsing for PMS Shop Counter while never blocking live dashboard or auth

const CACHE_NAME = "pms-shop-cache-v7";
const STATIC_ASSETS = [
  "/products",
  "/favicon.ico",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "include" });
            if (res && res.status === 200) {
              await cache.put(url, res);
            }
          } catch (e) {
            console.warn("Pre-cache single item warning:", url, e);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests or Next.js development HMR / webpack updates
  if (event.request.method !== "GET" || url.pathname.includes("webpack-hmr")) {
    return;
  }

  // 1. CRITICAL: NEVER intercept authentication, dashboard, login, or admin routes!
  // These MUST always pass directly to the live server.
  if (
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/users") ||
    url.pathname.startsWith("/supply") ||
    url.pathname.startsWith("/brands") ||
    url.pathname.startsWith("/categories") ||
    url.pathname.startsWith("/audit-logs")
  ) {
    return;
  }

  // 2. Next.js Static Assets (JS / CSS bundles) - Cache First with Network Fallback
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone()).catch(() => {});
            return networkRes;
          }
        } catch (err) {
          // Network failed
        }

        return (
          cached ||
          new Response("", {
            status: 200,
            headers: {
              "Content-Type": url.pathname.endsWith(".css")
                ? "text/css"
                : "application/javascript",
            },
          })
        );
      })
    );
    return;
  }

  // 3. Next.js App Router RSC payload requests (?_rsc=...)
  // Only handle RSC requests on /products to provide smooth offline browsing
  if (url.searchParams.has("_rsc") && url.pathname.startsWith("/products")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone()).catch(() => {});
            return networkRes;
          }
        } catch (err) {
          // Network offline
        }

        const cached = await cache.match(event.request, { ignoreSearch: false });
        if (cached) return cached;

        // Clean empty RSC response to prevent router crash
        return new Response("0:\"\"\n", {
          status: 200,
          headers: { "Content-Type": "text/x-component" },
        });
      })
    );
    return;
  }

  // 4. Product & Web Images - Cache First
  const isImage =
    event.request.destination === "image" ||
    url.pathname.match(/\.(webp|png|jpg|jpeg|svg|gif|avif|ico)$/i) ||
    url.hostname.includes("lk-tronics.com");

  if (isImage) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        let cached = await cache.match(event.request, {
          ignoreVary: true,
          ignoreSearch: true,
        });
        if (!cached) {
          cached = await cache.match(event.request.url, {
            ignoreVary: true,
            ignoreSearch: true,
          });
        }
        if (!cached) {
          cached = await cache.match(url.href, {
            ignoreVary: true,
            ignoreSearch: true,
          });
        }
        if (cached) return cached;

        try {
          let networkRes;
          try {
            networkRes = await fetch(event.request);
          } catch {
            networkRes = await fetch(
              new Request(event.request.url, { mode: "no-cors", credentials: "omit" })
            );
          }

          if (networkRes) {
            try {
              cache.put(event.request.url, networkRes.clone()).catch(() => {});
              cache.put(url.href, networkRes.clone()).catch(() => {});
            } catch (e) {}
            return networkRes;
          }
        } catch (err) {
          // Network failed
        }

        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
          {
            status: 200,
            headers: { "Content-Type": "image/svg+xml" },
          }
        );
      })
    );
    return;
  }

  // Skip other /api/ routes
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 5. Navigation & HTML Page Requests - Network first, only offline fallback for /products
  const isNavigation =
    event.request.mode === "navigate" ||
    event.request.headers.get("accept")?.includes("text/html");

  if (isNavigation && url.pathname.startsWith("/products")) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/products", resClone).catch(() => {});
              cache.put(event.request, resClone).catch(() => {});
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // Truly offline: serve cached /products
          const cache = await caches.open(CACHE_NAME);
          const cached =
            (await cache.match("/products", { ignoreSearch: true })) ||
            (await cache.match(event.request, { ignoreSearch: true }));

          if (cached) return cached;

          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PMS Shop Counter (Offline)</title><style>body{background:#020617;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}.box{background:#0f172a;border:1px solid #1e293b;padding:32px;border-radius:16px;max-width:440px}h1{font-size:18px;margin-bottom:8px;color:#38bdf8}p{font-size:14px;color:#94a3b8;line-height:1.5}a{display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px}</style></head><body><div class="box"><h1>Shop Counter Offline Mode</h1><p>You are working offline. Your product catalog and search are saved locally.</p><a href="/products">Go to Products Catalog</a></div></body></html>`,
            {
              status: 200,
              headers: { "Content-Type": "text/html" },
            }
          );
        })
    );
    return;
  }
});
