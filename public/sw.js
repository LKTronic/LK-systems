// PMS Shop Offline Service Worker
const CACHE_NAME = "pms-shop-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/products",
  "/login",
  "/favicon.ico",
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

  // Handle API requests: network-first (IndexedDB handles offline data)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Handle Images: Cache-first with network fallback
  if (
    event.request.destination === "image" ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkRes;
          })
          .catch(() => cached || new Response("", { status: 404 }));
      })
    );
    return;
  }

  // Navigation and static scripts: Network-first with Cache fallback for offline browsing
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
        if (event.request.mode === "navigate") {
          const productsPage = await caches.match("/products");
          if (productsPage) return productsPage;
        }

        return new Response("Offline mode active", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});
