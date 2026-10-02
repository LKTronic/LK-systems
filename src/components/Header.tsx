"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, Wifi, WifiOff, Loader2, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getShopOfflineMeta } from "@/lib/offlineShopDb";

export function Header({ title, description }: { title: string; description?: string }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "STAFF";
  const isShop = role === "SHOP";

  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "downloading_images" | "synced" | "offline"
  >("idle");
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [imageProgress, setImageProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("idle");
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial load of cached product count
    if (isShop) {
      getShopOfflineMeta().then((meta) => {
        if (meta.count > 0) setOfflineCount(meta.count);
      });
    }

    // Listen to real-time sync events from offline catalog manager
    const handleStatusEvent = (e: any) => {
      const detail = e.detail;
      if (detail?.status) {
        setSyncStatus(detail.status);
        if (detail.count > 0) setOfflineCount(detail.count);
        if (detail.totalImages > 0) {
          setImageProgress({ done: detail.doneImages || 0, total: detail.totalImages });
        }
      }
    };
    window.addEventListener("pms_shop_offline_status", handleStatusEvent);

    // Register Service Worker for SHOP role
    if (isShop && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("ServiceWorker registration:", err);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pms_shop_offline_status", handleStatusEvent);
    };
  }, [isShop]);

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-10 transition-colors">
      <div className="flex items-center gap-4">
        {isShop && (
          <div className="flex items-center gap-3 pr-4 border-r border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-600/30">
              S
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide leading-tight">
                PMS Enterprise
              </h1>
              <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
                Shop Counter
              </p>
            </div>
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <ThemeToggle />

        {/* Live Network & Offline Sync Status Indicator for Shop */}
        {isShop ? (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              syncStatus === "syncing" || syncStatus === "downloading_images"
                ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                : !isOnline || syncStatus === "offline"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            }`}
          >
            {syncStatus === "syncing" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>Syncing catalog...</span>
              </>
            ) : syncStatus === "downloading_images" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>
                  Downloading Images ({imageProgress.done}/{imageProgress.total})
                </span>
              </>
            ) : !isOnline || syncStatus === "offline" ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>⚡ Offline Ready {offlineCount > 0 ? `(${offlineCount})` : ""}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>⚡ Offline Ready ({offlineCount > 0 ? offlineCount : "All"})</span>
              </>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>System Active</span>
          </div>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-200">
              {session?.user?.name || "User"}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  isShop
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : role === "SUPERADMIN"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                    : role === "ADMIN"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                }`}
              >
                {role}
              </span>
              <span className="text-[10px] text-slate-400">
                @{(session?.user as any)?.username || "user"}
              </span>
            </div>
          </div>
        </div>

        {isShop && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 border border-rose-500/25 transition-all cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        )}
      </div>
    </header>
  );
}
