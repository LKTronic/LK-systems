// PMS Shop Offline Service Worker
const CACHE_NAME = "pms-shop-cache-v3";
const STATIC_ASSETS = [
  "/",
  "/products",
  "/login",
  "/favicon.ico",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Pre-cache error:", err);
      });
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

  // Handle NextAuth Session requests: cache session so user stays authenticated offline
  if (url.pathname === "/api/auth/session") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              user: { name: "Shop", email: "shop@lktronics.com", role: "SHOP" },
              expires: new Date(Date.now() + 30 * 86400000).toISOString(),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      })
    );
    return;
  }

  // Handle other API requests: network-first (IndexedDB handles offline product queries)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Handle Images (both local and cross-origin like lk-tronics.com): Cache-first with network fallback
  const isImage =
    event.request.destination === "image" ||
    url.pathname.match(/\.(webp|png|jpg|jpeg|svg|gif|avif|ico)$/i) ||
    url.hostname.includes("lk-tronics.com");

  if (isImage) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          // Fetch with no-cors if cross-origin to ensure opaque image responses can be cached
          const networkRes = await fetch(event.request);
          if (
            networkRes &&
            (networkRes.status === 200 || networkRes.type === "opaque" || networkRes.status === 0)
          ) {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          return (
            cached ||
            new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
              { headers: { "Content-Type": "image/svg+xml" } }
            )
          );
        }
      })
    );
    return;
  }

  // Handle Next.js static bundles and assets (JS/CSS chunks)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          return cached || new Response("", { status: 404 });
        }
      })
    );
    return;
  }

  // Navigation and dynamic pages: Network-first with Cache fallback for offline browsing
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkRes;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Fallback to cached products page for offline navigation
        if (
          event.request.mode === "navigate" ||
          url.pathname.startsWith("/products") ||
          url.searchParams.has("_rsc")
        ) {
          const productsPage = await caches.match("/products");
          if (productsPage) return productsPage;
        }

        return new Response("Offline mode active", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      })
  );
});
