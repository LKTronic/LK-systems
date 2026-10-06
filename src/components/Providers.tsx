"use client";

import { SessionProvider } from "next-auth/react";
import React, { useEffect } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const path = window.location.pathname;
      if (!path.startsWith("/products")) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister().catch(() => {});
          }
        });
        if ("caches" in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              if (key.includes("pms-shop-cache-v5") || key.includes("pms-shop-cache-v6")) {
                caches.delete(key).catch(() => {});
              }
            }
          });
        }
      }
    }
  }, []);

  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  );
}
