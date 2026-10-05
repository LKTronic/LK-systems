"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  LogOut,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  Clock,
  X,
  Database,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  getShopOfflineMeta,
  getShopCacheDetails,
  forceSyncShopImages,
  syncShopCatalogToIndexedDb,
  ShopCacheDetailedStatus,
} from "@/lib/offlineShopDb";
import { formatDateDMY } from "@/lib/formatters";
import { getEffectiveRole, cacheCurrentPageAssets } from "@/lib/offlineAuth";

export function Header({ title, description }: { title: string; description?: string }) {
  const { data: session } = useSession();
  const role = getEffectiveRole(session);
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

  // Modal & Detailed Cache State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [cacheDetails, setCacheDetails] = useState<ShopCacheDetailedStatus | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const loadDetails = async () => {
    setIsLoadingDetails(true);
    try {
      const details = await getShopCacheDetails();
      setCacheDetails(details);
      if (details.totalProducts > 0) setOfflineCount(details.totalProducts);
    } catch (err) {
      console.warn("Failed to load shop cache details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    loadDetails();
  };

  const handleManualForceSync = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      if (isOnline) {
        await syncShopCatalogToIndexedDb();
      } else {
        await forceSyncShopImages((done, total) => {
          setImageProgress({ done, total });
        });
      }
      await loadDetails();
    } catch (err) {
      console.warn("Manual sync error:", err);
    } finally {
      setIsManualSyncing(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("idle");
      if (isShop) {
        syncShopCatalogToIndexedDb().catch(() => {});
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial load of cached product count & auto-sync when online
    if (isShop) {
      getShopOfflineMeta().then((meta) => {
        if (meta.count > 0) setOfflineCount(meta.count);
      });
      if (navigator.onLine) {
        syncShopCatalogToIndexedDb().catch(() => {});
      }
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

    // Register Service Worker and cache page assets for offline resilience
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          if (navigator.onLine) {
            cacheCurrentPageAssets().catch(() => {});
          }
        })
        .catch((err) => {
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
    <>
      <header className="relative h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 transition-colors">
        {/* Top Edge Glowing Progress Bar for Download/Sync */}
        {(syncStatus === "syncing" || syncStatus === "downloading_images") && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800/80 overflow-hidden z-30">
            <div
              className={`h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 shadow-md shadow-sky-400/50 transition-all duration-300 ${
                syncStatus === "syncing" ? "w-1/3 animate-pulse" : ""
              }`}
              style={{
                width:
                  syncStatus === "downloading_images" && imageProgress.total > 0
                    ? `${Math.max(4, Math.round((imageProgress.done / imageProgress.total) * 100))}%`
                    : undefined,
              }}
            />
          </div>
        )}

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
            <button
              onClick={handleOpenModal}
              type="button"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                syncStatus === "syncing" || syncStatus === "downloading_images"
                  ? "bg-sky-950/50 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-950/50 animate-pulse"
                  : !isOnline || syncStatus === "offline"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
              title="Click to view Offline Sync & Image Cache details"
            >
              {syncStatus === "syncing" ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                  <span className="font-medium text-slate-200">Syncing catalog...</span>
                </div>
              ) : syncStatus === "downloading_images" ? (
                <div className="flex flex-col gap-1 min-w-[170px]">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold text-sky-300">
                      <Loader2 className="w-3 h-3 animate-spin text-sky-400 shrink-0" />
                      Caching Images
                    </span>
                    <span className="font-mono font-bold text-sky-400 text-[10px]">
                      {Math.round(
                        (imageProgress.done / Math.max(1, imageProgress.total)) * 100
                      )}
                      %
                    </span>
                  </div>
                  {/* Mini Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-sky-400 to-indigo-400 h-full rounded-full transition-all duration-200 shadow-sm shadow-sky-400/50"
                      style={{
                        width: `${Math.round(
                          (imageProgress.done / Math.max(1, imageProgress.total)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>Progress</span>
                    <span>
                      {imageProgress.done} / {imageProgress.total}
                    </span>
                  </div>
                </div>
              ) : !isOnline || syncStatus === "offline" ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>⚡ Offline Ready {offlineCount > 0 ? `(${offlineCount})` : ""}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>⚡ Offline Ready ({offlineCount > 0 ? offlineCount : "All"})</span>
                </>
              )}
            </button>
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

      {/* Offline Sync & Image Cache Status Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            ref={modalRef}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Offline Sync & Storage</h3>
                  <p className="text-xs text-slate-400">Shop Counter Fast Local Cache</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Connection Status Card */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <div className="flex items-center gap-3">
                  {isOnline ? (
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Wifi className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <WifiOff className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {isOnline ? "Online (Connected)" : "Offline Mode (Local)"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isOnline
                        ? "Automatic real-time background catalog sync"
                        : "Operating 100% from local IndexedDB cache"}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isOnline
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {isOnline ? "LIVE" : "OFFLINE"}
                </span>
              </div>

              {/* Status Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Catalog Products */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-medium">Cached Catalog</span>
                    <Database className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {isLoadingDetails ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline" />
                    ) : (
                      cacheDetails?.totalProducts || offlineCount || 0
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Products ready locally</p>
                </div>

                {/* Cached Images */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-medium">Offline Images</span>
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {isLoadingDetails ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline" />
                    ) : (
                      `${cacheDetails?.cachedImages || 0} / ${cacheDetails?.totalImages || 0}`
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {cacheDetails && cacheDetails.totalImages > 0
                      ? `${Math.round(
                          (cacheDetails.cachedImages / cacheDetails.totalImages) * 100
                        )}% ready offline`
                      : "Available in cache"}
                  </p>
                </div>
              </div>

              {/* Active Image Progress Bar (if syncing or caching) */}
              {(syncStatus === "downloading_images" || isManualSyncing) && (
                <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      Downloading Missing Images...
                    </span>
                    <span className="font-mono text-sky-400">
                      {imageProgress.total > 0
                        ? `${Math.round((imageProgress.done / imageProgress.total) * 100)}%`
                        : "Working..."}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm shadow-sky-400/50"
                      style={{
                        width:
                          imageProgress.total > 0
                            ? `${Math.max(
                                5,
                                Math.round((imageProgress.done / imageProgress.total) * 100)
                              )}%`
                            : "30%",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Cached Progress</span>
                    <span>
                      {imageProgress.done} / {imageProgress.total || "All"}
                    </span>
                  </div>
                </div>
              )}

              {/* Last Sync Timestamp */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 py-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Last Catalog Sync:
                </span>
                <span className="font-mono font-medium text-slate-300">
                  {cacheDetails?.lastSyncTime
                    ? formatDateDMY(cacheDetails.lastSyncTime)
                    : "Not synced yet"}
                </span>
              </div>

              {/* Offline Assurance Badge */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-300 leading-relaxed">
                  All cached products and images remain fully accessible even if the internet connection is lost.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={loadDetails}
                disabled={isLoadingDetails}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetails ? "animate-spin" : ""}`} />
                <span>Refresh Status</span>
              </button>

              <button
                type="button"
                onClick={handleManualForceSync}
                disabled={isManualSyncing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md shadow-sky-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isManualSyncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Download All Images</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
