"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Loader2 } from "lucide-react";
import {
  getEffectiveRole,
  isEffectiveShop,
  persistAuthSession,
  cacheCurrentPageAssets,
} from "@/lib/offlineAuth";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  requireAdmin?: boolean;
}

export function AppLayout({
  children,
  title,
  description,
  requireAdmin = false,
}: AppLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loadingDelayed, setLoadingDelayed] = useState(false);

  // Persistent role detection: keeps SHOP role stable even when offline or NextAuth session drops
  const role = getEffectiveRole(session);
  const isShop = role === "SHOP";

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pms_login_loop_count");
      sessionStorage.removeItem("pms_login_loop_time");
    }
    if (session?.user) {
      persistAuthSession(session);
    }
    // Pre-cache current page scripts and styles for offline stability
    if (typeof window !== "undefined" && navigator.onLine) {
      cacheCurrentPageAssets().catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === "loading") {
      timer = setTimeout(() => {
        setLoadingDelayed(true);
      }, 4000);
    } else {
      setLoadingDelayed(false);
    }
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!isMounted) return;

    // SHOP users should NEVER be kicked to /login while operating the shop counter
    if (isShop) return;

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (status === "unauthenticated") {
      if (isOffline) {
        return;
      }
      router.push("/login");
    } else if (status === "authenticated") {
      if (requireAdmin && role !== "ADMIN" && role !== "SUPERADMIN") {
        router.push(isShop ? "/products" : "/dashboard");
      }
    }
  }, [isMounted, status, session, router, requireAdmin, role, isShop]);


  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  // For Shop users, never show blocking loading screen if mounted
  if (!isMounted || (status === "loading" && !isOffline && !isShop)) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 p-4"
      >
        <div suppressHydrationWarning className="flex flex-col items-center gap-3 text-center max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-white">Verifying authorization...</p>
          {loadingDelayed && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-xs text-amber-400">
                Authorization check is taking longer than expected.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors cursor-pointer"
                >
                  Reload Page
                </button>
                <a
                  href="/login"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
                >
                  Return to Login
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" && !isOffline && !isShop) {
    return null;
  }

  return (
    <div suppressHydrationWarning className="flex min-h-screen bg-slate-950 text-slate-100">
      {!isShop && <Sidebar />}
      <div suppressHydrationWarning className="flex-1 flex flex-col min-w-0 w-full">
        <Header title={title} description={description} />
        <main suppressHydrationWarning className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
