/**
 * Offline Auth & Asset Persistence Helper for PMS Shop Counter
 * Ensures that shop users remain authenticated and all Next.js assets
 * are fully cached so the page NEVER drops or crashes when offline.
 */

export const OFFLINE_ROLE_KEY = "pms_offline_role";
export const OFFLINE_USER_KEY = "pms_offline_user";
export const CACHE_NAME = "pms-shop-cache-v7";

export interface CachedUser {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
}

/**
 * Retrieves the persisted role from localStorage
 */
export function getPersistedRole(): string {
  if (typeof window === "undefined") return "STAFF";
  try {
    const saved = localStorage.getItem(OFFLINE_ROLE_KEY);
    if (saved) return saved;
  } catch (e) {}
  return "STAFF";
}

/**
 * Retrieves the persisted user from localStorage
 */
export function getPersistedUser(): CachedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OFFLINE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

/**
 * Persists user session information to localStorage so that offline usage remains uninterrupted
 */
export function persistAuthSession(session: any) {
  if (typeof window === "undefined" || !session?.user) return;
  try {
    const role = (session.user as any)?.role;
    if (role) {
      localStorage.setItem(OFFLINE_ROLE_KEY, role);
    }
    localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(session.user));
  } catch (e) {}
}

/**
 * Returns the effective user role: session role if available, or persisted role from localStorage
 */
export function getEffectiveRole(session: any): string {
  const sessionRole = (session?.user as any)?.role;
  if (sessionRole) {
    persistAuthSession(session);
    return sessionRole;
  }
  return getPersistedRole();
}

/**
 * Returns true if the user is a SHOP counter user (either live session or offline cached)
 */
export function isEffectiveShop(session: any): boolean {
  return getEffectiveRole(session) === "SHOP";
}

/**
 * Scans the active document for all Next.js static scripts and stylesheets,
 * caching them directly into Cache Storage so full-page reloads and offline browsing work 100%.
 */
export async function cacheCurrentPageAssets() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);

    // 1. Gather all Next.js scripts and stylesheets currently in DOM
    const urlsToCache: string[] = [];

    document.querySelectorAll<HTMLScriptElement>('script[src*="/_next/static/"]').forEach((el) => {
      if (el.src) urlsToCache.push(el.src);
    });

    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/_next/static/"]').forEach((el) => {
      if (el.href) urlsToCache.push(el.href);
    });

    // Also include critical routes
    const baseOrigin = window.location.origin;
    const criticalUrls = [
      `${baseOrigin}/products`,
      `${baseOrigin}/manifest.json`,
      `${baseOrigin}/favicon.ico`,
    ];

    const allUrls = Array.from(new Set([...urlsToCache, ...criticalUrls]));

    // Cache missing items in parallel without blocking
    await Promise.all(
      allUrls.map(async (url) => {
        try {
          const match = await cache.match(url, { ignoreSearch: true });
          if (!match) {
            const res = await fetch(url, { credentials: "include" });
            if (res && res.status === 200) {
              await cache.put(url, res.clone());
              // Also cache clean pathname
              try {
                const parsed = new URL(url);
                await cache.put(parsed.pathname, res);
              } catch (e) {}
            }
          }
        } catch (e) {
          // ignore individual fetch errors
        }
      })
    );
  } catch (err) {
    console.warn("Failed to pre-cache page assets:", err);
  }
}
