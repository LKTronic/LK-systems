"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/AppLayout";
import { CategorySearchDropdown } from "@/components/CategorySearchDropdown";
import { formatLKR, formatDateDMY, extractStorageLocation } from "@/lib/formatters";
import { syncShopCatalogToIndexedDb, searchShopIndexedDb } from "@/lib/offlineShopDb";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  X,
  RotateCcw,
  Upload,
  FileSpreadsheet,
  FileCheck,
  Check,
  Info,
  Globe,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  LayoutGrid,
  List,
  MapPin,
} from "lucide-react";

interface Product {
  id: number;
  recordNo: string;
  referenceNo?: string | null;
  productName: string;
  modelAndName?: string | null;
  sku?: string | null;
  productDate?: string | null;
  price: number;
  priceLKR?: number | null;
  priceUpdatedAt?: string | null;
  quantity: number;
  imagePath?: string | null;
  source?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  referenceLink?: string | null;
  description?: string | null;
  stockStatus?: string | null;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "PRICE_NOT_AVAILABLE" | "NOT_REQUESTED" | "QUOTED";
  createdAt: string;
  supplierNote?: string | null;
  additionalNote?: string | null;
  category?: {
    id: number;
    name: string;
  } | null;
  categoryNames?: string | null;
  shippingClass?: string | null;
  supplierId?: number | null;
  supplier?: {
    id: number;
    name: string;
  } | null;
}

interface Category {
  id: number;
  name: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "STAFF";
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const isShop = role === "SHOP";

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ONLINE_WEB"); // ONLINE_WEB (default), ALL, PMS
  const [categoryId, setCategoryId] = useState("ALL");
  const [addedBy, setAddedBy] = useState("ALL");
  const [users, setUsers] = useState<{ id: number; name: string; username: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isOffline, setIsOffline] = useState(false);
  const isInitialSearch = useRef(true);
  const hasRestoredScroll = useRef(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const offline = typeof navigator !== "undefined" ? !navigator.onLine : false;
      setIsOffline(offline);
      if (!offline && isShop) {
        syncShopCatalogToIndexedDb().catch(() => {});
      }
    };
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [isShop]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pms_product_view_mode");
      if (saved === "list" || saved === "grid") {
        setViewMode(saved);
      }
    } catch (e) {}
  }, []);

  const handleToggleViewMode = (mode: "list" | "grid") => {
    setViewMode(mode);
    try {
      localStorage.setItem("pms_product_view_mode", mode);
    } catch (e) {}
  };

  const saveScrollState = (productId?: number) => {
    try {
      const pos =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        document.querySelector("main")?.scrollTop ||
        0;
      sessionStorage.setItem("pms_products_scroll_pos", pos.toString());
      if (productId) {
        sessionStorage.setItem("pms_last_viewed_product_id", productId.toString());
      }
    } catch (e) {
      console.warn("Failed to save scroll position:", e);
    }
  };

  const saveScrollPosToTop = () => {
    try {
      sessionStorage.setItem("pms_products_scroll_pos", "0");
      sessionStorage.removeItem("pms_last_viewed_product_id");
      hasRestoredScroll.current = true;
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: "smooth" });
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTop = 0;
  };

  // Web Store (lk-tronics.com) Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState<"quick" | "full">("quick");
  const [syncStats, setSyncStats] = useState<{
    connected: boolean;
    storeUrl: string;
    totalStoreProducts: number;
    totalPages: number;
    syncedInPms: number;
    pmsTotalCount: number;
    lastSyncedAt: string | null;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    added: number;
    updated: number;
    processed: number;
    message: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Superadmin Data Cleanup Modal State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearCounts, setClearCounts] = useState<{
    total: number;
    webSyncCount: number;
    pmsCount: number;
  } | null>(null);
  const [isLoadingClearCounts, setIsLoadingClearCounts] = useState(false);
  const [selectedClearTarget, setSelectedClearTarget] = useState<"WEB_SYNC" | "PMS" | "ALL">("WEB_SYNC");
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [isExecutingClear, setIsExecutingClear] = useState(false);
  const [clearResult, setClearResult] = useState<{
    success: boolean;
    deletedCount: number;
    message: string;
  } | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);

  // Categories & Suppliers
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  // Product Excel Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCategoryId, setImportCategoryId] = useState<string>("ALL");
  const [importSupplierId, setImportSupplierId] = useState<string>("ALL");
  const [isValidatingImport, setIsValidatingImport] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    summary: {
      totalRows: number;
      activeCount: number;
      notRequestedCount: number;
      alreadyExistsCount: number;
      errorCount: number;
    };
    previewRows: any[];
  } | null>(null);
  const importPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (importPreview) {
      const timer = setTimeout(() => {
        importPreviewRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [importPreview]);

  // Image and Product Instant Preview Modal States
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);

  // Admin Price Validity Period Modal State
  const [isValidityModalOpen, setIsValidityModalOpen] = useState(false);
  const [validityMonths, setValidityMonths] = useState(6);
  const [isSavingValidity, setIsSavingValidity] = useState(false);
  const [validityMessage, setValidityMessage] = useState<string | null>(null);

  // Action status state
  const [requestingPriceId, setRequestingPriceId] = useState<number | null>(null);
  const [pageToast, setPageToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchFiltersAndSettings = async () => {
    try {
      const [catRes, setRes, usersRes, supRes] = await Promise.all([
        fetch("/api/categories").catch(() => null),
        fetch("/api/settings").catch(() => null),
        fetch("/api/users/list").catch(() => null),
        fetch("/api/suppliers").catch(() => null),
      ]);
      if (catRes && catRes.ok) {
        const catData = await catRes.json().catch(() => ({}));
        const raw: Category[] = catData.categories || [];
        const sorted = [...raw].sort((a, b) => {
          const aName = a.name.trim().toLowerCase();
          const bName = b.name.trim().toLowerCase();
          const aIsOther = aName === "others" || aName === "other";
          const bIsOther = bName === "others" || bName === "other";
          if (aIsOther && !bIsOther) return 1;
          if (!aIsOther && bIsOther) return -1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
        setCategories(sorted);
      }
      if (setRes && setRes.ok) {
        const setData = await setRes.json().catch(() => ({}));
        if (setData.priceValidityMonths) {
          setValidityMonths(setData.priceValidityMonths);
        }
      }
      if (usersRes && usersRes.ok) {
        const uData = await usersRes.json().catch(() => ({}));
        setUsers(uData.users || []);
      }
      if (supRes && supRes.ok) {
        const sData = await supRes.json().catch(() => ({}));
        setSuppliers(sData.suppliers || []);
      }
    } catch (e) {
      console.warn("Failed to load metadata:", e);
    }
  };

  const fetchStoreStats = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/products/sync-web-store").catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data) setSyncStats(data);
      }
    } catch (e) {
      console.warn("Failed to fetch web store stats (offline mode active)", e);
    }
  };

  const handleSyncWebStore = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/products/sync-web-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncAll: syncMode === "full",
          perPage: syncMode === "full" ? 100 : 50,
          maxPages: syncMode === "full" ? 15 : 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }
      setSyncResult(data);
      fetchProducts();
      fetchStoreStats();
    } catch (err: any) {
      setSyncError(err.message || "Failed to sync products from web store");
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchClearCounts = async () => {
    try {
      setIsLoadingClearCounts(true);
      setClearError(null);
      const res = await fetch("/api/admin/clear-data");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch counts");
      setClearCounts(data);
    } catch (err: any) {
      setClearError(err.message || "Failed to load counts");
    } finally {
      setIsLoadingClearCounts(false);
    }
  };

  const handleExecuteClear = async () => {
    if (clearConfirmText.trim() !== "DELETE") {
      setClearError("Please type 'DELETE' in capital letters to confirm.");
      return;
    }

    try {
      setIsExecutingClear(true);
      setClearError(null);
      setClearResult(null);

      const res = await fetch("/api/admin/clear-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: selectedClearTarget }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear data");

      setClearResult(data);
      setClearConfirmText("");
      // Refresh products table and counts
      fetchProducts();
      fetchClearCounts();
    } catch (err: any) {
      setClearError(err.message || "Failed to execute cleanup");
    } finally {
      setIsExecutingClear(false);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status,
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (categoryId !== "ALL") params.set("categoryId", categoryId);
      if (addedBy !== "ALL") params.set("createdBy", addedBy);

      // In offline mode for shop users, query local IndexedDB directly
      if (isShop && typeof navigator !== "undefined" && !navigator.onLine) {
        const localResult = await searchShopIndexedDb({
          search: debouncedSearch,
          status,
          source: sourceFilter,
          categoryId,
          page,
          limit,
        });
        setProducts(localResult.products as any);
        setTotal(localResult.pagination.total);
        setTotalPages(localResult.pagination.totalPages);
        setDidYouMean(localResult.didYouMean || null);
        setIsLoading(false);
        return;
      }

      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        setDidYouMean(data.didYouMean || null);
      } else if (isShop) {
        const localResult = await searchShopIndexedDb({
          search: debouncedSearch,
          status,
          source: sourceFilter,
          categoryId,
          page,
          limit,
        });
        setProducts(localResult.products as any);
        setTotal(localResult.pagination.total);
        setTotalPages(localResult.pagination.totalPages);
        setDidYouMean(localResult.didYouMean || null);
      }
    } catch (err) {
      console.warn("Network request failed, falling back to offline IndexedDB:", err);
      if (isShop) {
        try {
          const localResult = await searchShopIndexedDb({
            search: debouncedSearch,
            status,
            source: sourceFilter,
            categoryId,
            page,
            limit,
          });
          setProducts(localResult.products as any);
          setTotal(localResult.pagination.total);
          setTotalPages(localResult.pagination.totalPages);
          setDidYouMean(localResult.didYouMean || null);
        } catch (dbErr) {
          console.error("Failed to read from local offline store:", dbErr);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Restore filter state from URL parameters or sessionStorage on initial mount
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const hasUrlParams =
        urlParams.has("page") ||
        urlParams.has("status") ||
        urlParams.has("categoryId") ||
        urlParams.has("source") ||
        urlParams.has("search") ||
        urlParams.has("createdBy");

      if (hasUrlParams) {
        const p = parseInt(urlParams.get("page") || "1", 10) || 1;
        const st = urlParams.get("status") || "ALL";
        const sf = urlParams.get("source") || "ONLINE_WEB";
        const cat = urlParams.get("categoryId") || "ALL";
        const ab = urlParams.get("createdBy") || "ALL";
        const q = urlParams.get("search") || "";

        if (p !== 1) setPage(p);
        if (st !== "ALL") setStatus(st);
        if (sf) setSourceFilter(sf);
        if (cat !== "ALL") setCategoryId(cat);
        if (ab !== "ALL") setAddedBy(ab);
        if (q) {
          setSearch(q);
          setDebouncedSearch(q);
        }
      } else {
        const saved = sessionStorage.getItem("pms_products_filter_state");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.page && parsed.page !== 1) setPage(parsed.page);
          if (parsed.status && parsed.status !== "ALL") setStatus(parsed.status);
          if (parsed.sourceFilter) setSourceFilter(parsed.sourceFilter);
          if (parsed.categoryId && parsed.categoryId !== "ALL") setCategoryId(parsed.categoryId);
          if (parsed.addedBy && parsed.addedBy !== "ALL") setAddedBy(parsed.addedBy);
          if (parsed.search) {
            setSearch(parsed.search);
            setDebouncedSearch(parsed.search);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to restore filter state:", e);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    fetchFiltersAndSettings();
    if (!isShop && isAdmin) {
      fetchStoreStats();
    }
    // Background sync of IndexedDB catalog for SHOP users
    if (isShop) {
      syncShopCatalogToIndexedDb().catch((err) => {
        console.warn("Background catalog sync failed (using offline store):", err);
      });
    }
  }, [isShop, isAdmin]);

  // Persist filter state to sessionStorage and URL query params
  useEffect(() => {
    if (!isReady) return;
    try {
      const stateToSave = {
        page,
        limit,
        status,
        sourceFilter,
        categoryId,
        addedBy,
        search: debouncedSearch,
      };
      sessionStorage.setItem("pms_products_filter_state", JSON.stringify(stateToSave));

      const params = new URLSearchParams();
      if (page > 1) params.set("page", page.toString());
      if (status !== "ALL") params.set("status", status);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (categoryId !== "ALL") params.set("categoryId", categoryId);
      if (addedBy !== "ALL") params.set("createdBy", addedBy);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const queryStr = params.toString();
      const newUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    } catch (e) {
      console.warn("Failed to persist filter state:", e);
    }
  }, [isReady, page, limit, status, sourceFilter, categoryId, addedBy, debouncedSearch]);

  // Live search debouncing: as user types, update debouncedSearch after 250ms
  useEffect(() => {
    if (!isReady) return;
    if (isInitialSearch.current) {
      isInitialSearch.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, isReady]);

  // Fetch products whenever filters or pagination change (once filters are ready)
  useEffect(() => {
    if (!isReady) return;
    fetchProducts();
  }, [isReady, page, limit, status, sourceFilter, categoryId, addedBy, debouncedSearch]);

  // Track scroll position continuously while scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (isLoading || products.length === 0) return;
      const pos =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        document.querySelector("main")?.scrollTop ||
        0;
      if (pos > 0) {
        sessionStorage.setItem("pms_products_scroll_pos", pos.toString());
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (mainEl) mainEl.removeEventListener("scroll", handleScroll);
    };
  }, [isLoading, products.length]);

  // Restore scroll position after products have finished loading and rendering
  useEffect(() => {
    if (!isLoading && products.length > 0 && !hasRestoredScroll.current) {
      try {
        const savedPos = sessionStorage.getItem("pms_products_scroll_pos");
        const lastViewedId = sessionStorage.getItem("pms_last_viewed_product_id");

        if (savedPos || lastViewedId) {
          hasRestoredScroll.current = true;
          const targetY = savedPos ? parseInt(savedPos, 10) : 0;

          const restoreScroll = () => {
            if (targetY > 0) {
              window.scrollTo({ top: targetY, behavior: "instant" });
              const mainEl = document.querySelector("main");
              if (mainEl) mainEl.scrollTop = targetY;
            }

            if (lastViewedId) {
              const row = document.getElementById(`product-row-${lastViewedId}`);
              if (row && targetY <= 0) {
                row.scrollIntoView({ block: "center", behavior: "instant" });
              }
            }
          };

          requestAnimationFrame(restoreScroll);
          setTimeout(restoreScroll, 50);
          setTimeout(restoreScroll, 150);
        }
      } catch (e) {
        console.warn("Failed to restore scroll position:", e);
      }
    }
  }, [products, isLoading]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPage(1);
  };

  // Request Price Action: Transition product to PENDING for supplier re-quotation
  const canRequestPrice = (p: Product) => {
    const isOnlineWeb =
      p.source === "ONLINE_WEB" ||
      p.source === "LK_TRONICS" ||
      Boolean(p.externalId);
    if (!isOnlineWeb) {
      return true; // Local PMS products can always request price
    }
    const isOverTheSea =
      p.shippingClass === "over-the-sea" || p.shippingClass === "Over the Sea";
    const isPriceNotAvailable =
      p.status === "PRICE_NOT_AVAILABLE" ||
      Number(p.priceLKR || p.price) === 0;
    const isPmsUpdated = Boolean(
      p.supplierId ||
      (p.supplier && p.supplier.name) ||
      p.additionalNote?.includes("PMS Updated")
    );

    return isOverTheSea || isPriceNotAvailable || isPmsUpdated;
  };

  const handleRequestPrice = async (id: number, identifier: string) => {
    if (!confirm(`Request updated price quotation for ${identifier}? This will move it to Pending status.`)) {
      return;
    }

    setRequestingPriceId(id);
    try {
      const res = await fetch(`/api/products/${id}/request-price`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        fetchProducts();
      } else {
        alert(data.error || "Failed to request price.");
      }
    } catch (err) {
      console.error("Error requesting price:", err);
    } finally {
      setRequestingPriceId(null);
    }
  };

  const handleDelete = async (id: number, name: string, isOnlineWeb?: boolean) => {
    const confirmMsg = isOnlineWeb
      ? `This is an Online Web product with PMS modifications.\n\nDeleting will remove all PMS supplier quotations, notes, and price updates, reverting it back to the original web product.\n\nThe product will NOT be removed from PMS.\n\nProceed to remove PMS modifications?`
      : `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        fetchProducts();
      } else {
        alert(data.error || "Failed to process request.");
      }
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  const handleSaveValidityPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingValidity(true);
    setValidityMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceValidityMonths: validityMonths }),
      });
      const data = await res.json();
      if (res.ok) {
        setValidityMessage(data.message || "Setting saved successfully.");
        fetchProducts();
        setTimeout(() => {
          setIsValidityModalOpen(false);
          setValidityMessage(null);
        }, 1500);
      } else {
        alert(data.error || "Failed to update validity period.");
      }
    } catch (e: any) {
      alert(e.message || "Network error");
    } finally {
      setIsSavingValidity(false);
    }
  };

  const getStatusBadge = (st: Product["status"]) => {
    switch (st) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
            <Clock className="w-3 h-3 shrink-0" />
            Pending
          </span>
        );
      case "ACTIVE":
      case "QUOTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Active
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap" title={`Expired after ${validityMonths}m validity`}>
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Expired
          </span>
        );
      case "PRICE_NOT_AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-rose-400 border border-rose-500/20 whitespace-nowrap" title="Price Not Available">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Price N/A
          </span>
        );
      case "NOT_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
            <Clock className="w-3 h-3 shrink-0" />
            Not Req
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {st}
          </span>
        );
    }
  };

  return (
    <AppLayout
      title="Product Repository"
      description="Manage product requests, track quotation lifecycles, and request price updates"
    >
      <div className="space-y-6">
        {pageToast && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm shadow-lg shadow-emerald-500/5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{pageToast.message}</span>
            </div>
            <button
              onClick={() => setPageToast(null)}
              className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">
              Total Products:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs border border-slate-700">
              {total}
            </span>

            {/* Admin Setting: Price Validity Period Badge/Button */}
            {isAdmin && (
              <button
                onClick={() => setIsValidityModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-all"
                title="Configure after how many months an active price expires"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-400" />
                Price Validity: <span className="font-bold text-white">{validityMonths} Months</span>
              </button>
            )}

            {/* Superadmin Data Cleanup Button */}
            {role === "SUPERADMIN" && (
              <button
                onClick={() => {
                  setIsClearModalOpen(true);
                  setClearConfirmText("");
                  setClearError(null);
                  setClearResult(null);
                  fetchClearCounts();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-xs font-semibold text-rose-300 border border-rose-800/60 transition-all hover:text-white"
                title="Superadmin Data Cleanup: Clear PMS and Web Store data separately"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Data Cleanup</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isShop && (
              <>
                {/* Download Pending Requests Page */}
                <Link
                  href="/products/pending-download"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download Pending Requests
                </Link>

                {/* Sync Web Store (lk-tronics.com) */}
                <button
                  onClick={() => {
                    setIsSyncModalOpen(true);
                    setSyncResult(null);
                    setSyncError(null);
                    fetchStoreStats();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all"
                  title="Import or synchronize products from https://lk-tronics.com"
                >
                  <Globe className="w-4 h-4 text-violet-200" />
                  Sync Web Store
                </button>

                {/* Import Products from Excel */}
                <button
                  onClick={() => {
                    setIsImportModalOpen(true);
                    setImportError(null);
                    setImportSuccess(null);
                    setImportPreview(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold shadow-lg transition-all"
                >
                  <Upload className="w-4 h-4 text-sky-400" />
                  Import Excel
                </button>
              </>
            )}

            {/* Add Product Request */}
            {!isShop && (
              <Link
                href="/products/add"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all"
              >
                <Plus className="w-4 h-4" />
                PMS Data Adding
              </Link>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3">
            {/* Search Input (Live as user types) */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by SKU, Name, Description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Google-style Typo Tolerance Suggestion */}
            {didYouMean && (
              <div className="w-full flex items-center gap-2 px-3.5 py-2 bg-indigo-950/70 border border-indigo-500/40 rounded-xl text-xs text-indigo-200">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Showing results for{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(didYouMean);
                      setDebouncedSearch(didYouMean);
                    }}
                    className="font-bold underline text-amber-300 hover:text-white"
                  >
                    {didYouMean}
                  </button>
                  {" "}&bull; Search instead for{" "}
                  <span className="italic opacity-80">"{debouncedSearch}"</span>
                </span>
              </div>
            )}

            {/* Source Filter: ONLINE_WEB (Default), ALL, PMS */}
            <div className="w-48">
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
              >
                <option value="ONLINE_WEB">🌐 Online Web</option>
                <option value="ALL">All Sources (PMS + Web)</option>
                <option value="PMS">PMS Products Only</option>
              </select>
            </div>

            {/* Status Filter: 3 primary statuses + All */}
            <div className="w-48">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active (Quoted)</option>
                <option value="NOT_REQUESTED">Not Requested</option>
                <option value="PENDING">Pending (Awaiting Quote)</option>
                <option value="PRICE_NOT_AVAILABLE">Price Not Available</option>
                <option value="EXPIRED">Expired (After {validityMonths}m)</option>
              </select>
            </div>

            {/* Category Filter (Searchable Dropdown) */}
            <div className="w-52">
              <CategorySearchDropdown
                categories={categories}
                value={categoryId}
                onChange={(val) => {
                  setCategoryId(val);
                  setPage(1);
                }}
                placeholder="All Categories"
              />
            </div>

            {/* Added by Filter */}
            {!isShop && (
              <div className="w-44">
                <select
                  value={addedBy}
                  onChange={(e) => {
                    setAddedBy(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                >
                  <option value="ALL">Added by: All</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id.toString()}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Apply
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem("pms_products_filter_state");
                  sessionStorage.removeItem("pms_products_scroll_pos");
                  sessionStorage.removeItem("pms_last_viewed_product_id");
                } catch (e) {}
                hasRestoredScroll.current = true;
                setSearch("");
                setDebouncedSearch("");
                setStatus("ALL");
                setSourceFilter("ONLINE_WEB");
                setCategoryId("ALL");
                setAddedBy("ALL");
                setPage(1);
                window.history.replaceState(null, "", window.location.pathname);
                window.scrollTo({ top: 0, behavior: "smooth" });
                const mainEl = document.querySelector("main");
                if (mainEl) mainEl.scrollTop = 0;
              }}
              className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-all"
            >
              Reset
            </button>

            {/* View Mode Toggle: List (Table) vs Grid (Cards) */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl sm:ml-auto">
              <button
                type="button"
                onClick={() => handleToggleViewMode("list")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                title="List View (Table)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">List</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode("grid")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
                title="Grid View (Cards)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Grid</span>
              </button>
            </div>
          </form>
        </div>

        {/* Product Display: Grid View vs List View */}
        {viewMode === "grid" ? (
          <div className="space-y-6">
            {isLoading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center shadow-xl">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-xl">
                No products found matching the criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map((p) => {
                  const skuDisplay = p.sku ? p.sku : "—";
                  const nameDisplay = p.modelAndName || p.productName;
                  const isOnlineWeb =
                    p.source === "ONLINE_WEB" ||
                    p.source === "LK_TRONICS" ||
                    Boolean(p.externalId);

                  return (
                    <div
                      key={p.id}
                      id={`product-card-${p.id}`}
                      onClick={() => {
                        const offline = typeof navigator !== "undefined" && !navigator.onLine;
                        if (isShop && offline) {
                          setPreviewProduct(p);
                        } else {
                          saveScrollState(p.id);
                          router.push(`/products/${p.id}`);
                        }
                      }}
                      className={`bg-slate-900 border rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 shadow-lg hover:shadow-indigo-950/40 group cursor-pointer relative overflow-hidden ${
                        isOnlineWeb
                          ? "border-orange-500/30 hover:border-orange-400/70"
                          : "border-slate-800 hover:border-indigo-500/60"
                      }`}
                    >
                      <div>
                        {/* Header: SKU / Source Badge */}
                        <div className="flex items-center justify-between gap-1.5 mb-2.5">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span
                              className={`font-mono font-bold text-xs truncate ${
                                isOnlineWeb ? "text-orange-400" : "text-blue-400"
                              }`}
                            >
                              {skuDisplay}
                            </span>
                            {isOnlineWeb ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 shrink-0">
                                <Globe className="w-2.5 h-2.5" />
                                Web
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                                PMS
                              </span>
                            )}
                          </div>

                          {!isShop && <div>{getStatusBadge(p.status)}</div>}
                        </div>

                        {/* Image */}
                        <div className="w-full h-40 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800/80 relative group/img">
                          {p.imagePath ? (
                            <>
                              <img
                                src={p.imagePath}
                                alt={nameDisplay}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-2 group-hover/img:scale-105 transition-transform duration-300"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(p.imagePath!);
                                }}
                                className="absolute bottom-1.5 right-1.5 p-1 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-300 hover:text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                                title="Zoom Image"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <div className="text-slate-600 flex flex-col items-center gap-1">
                              <ImageIcon className="w-8 h-8 stroke-1" />
                              <span className="text-[10px] text-slate-600">No image</span>
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <h4
                          className="font-semibold text-white group-hover:text-indigo-300 transition-colors text-xs line-clamp-2 leading-snug mt-2.5 min-h-[32px]"
                          title={nameDisplay}
                        >
                          {nameDisplay}
                        </h4>

                        {/* Category & Stock Tag */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {p.shippingClass === "over-the-sea" || p.shippingClass === "Over the Sea" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                              <span>🚢</span>
                              <span>Over Sea</span>
                            </span>
                          ) : p.stockStatus === "outofstock" || p.quantity === 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-[9.5px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              Qty: {p.quantity}
                            </span>
                          )}

                          {!isShop && (p.categoryNames || p.category?.name) && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[120px]">
                              {p.category?.name || "Category"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Price & Action Footer */}
                      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Price</div>
                          <div className="text-xs font-bold text-emerald-400">
                            {p.status === "NOT_REQUESTED" ? (
                              <span className="text-sky-400 text-[10px]">Not Req</span>
                            ) : p.status === "PRICE_NOT_AVAILABLE" || Number(p.priceLKR || p.price) === 0 ? (
                              <span className="text-rose-400 text-[10px]">Not Available</span>
                            ) : (
                              formatLKR(p.priceLKR || p.price)
                            )}
                          </div>
                        </div>

                        {/* Actions (Hidden for SHOP) */}
                        {!isShop && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {canRequestPrice(p) && (
                              <button
                                onClick={() => handleRequestPrice(p.id, nameDisplay)}
                                disabled={requestingPriceId === p.id}
                                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                  p.status === "PENDING"
                                    ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40"
                                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                                } ${requestingPriceId === p.id ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                                title="Request updated price quote"
                              >
                                {requestingPriceId === p.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                <span>Quote</span>
                              </button>
                            )}

                            <Link
                              href={`/products/${p.id}/edit`}
                              onClick={() => saveScrollState(p.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Link>

                            {(() => {
                              const isPmsModified = Boolean(
                                p.supplierId ||
                                (p.supplier && p.supplier.name) ||
                                p.additionalNote?.includes("PMS Updated") ||
                                p.status === "PENDING"
                              );

                              if (isOnlineWeb && !isPmsModified) return null;

                              return (
                                <button
                                  onClick={() => handleDelete(p.id, nameDisplay, isOnlineWeb)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isOnlineWeb
                                      ? "text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                                      : "text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                                  }`}
                                  title={isOnlineWeb ? "Revert to web" : "Delete Product"}
                                >
                                  {isOnlineWeb ? (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shared Pagination for Grid */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 shadow-xl">
              <div>
                Showing {products.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
                {Math.min(page * limit, total)} of {total} items
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    saveScrollPosToTop();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  className="p-2 rounded-lg border border-slate-800 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-white px-2">
                  Page {page} of {totalPages || 1}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => {
                    saveScrollPosToTop();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                  className="p-2 rounded-lg border border-slate-800 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-2.5 py-3 w-[110px]">Sku / Source</th>
                    <th className="px-3 py-3 min-w-[180px] max-w-[280px]">Name</th>
                    {!isShop && <th className="px-2 py-3 w-[120px]">Category</th>}
                    {!isShop && <th className="px-2 py-3 text-center w-[105px]">Status</th>}
                    <th className="px-2 py-3 text-center w-[90px]">Qty / Stock</th>
                    <th className="px-2.5 py-3 text-right w-[105px]">Price (LKR)</th>
                    <th className="px-2 py-3 text-center w-[95px]">Date</th>
                    <th className={`px-1.5 py-3 text-center ${isShop ? "w-[84px]" : "w-[52px]"}`}>Image</th>
                    {!isShop && <th className="px-2.5 py-3 text-right w-[85px]">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={isShop ? 6 : 9} className="py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                        <p className="text-xs text-slate-400 mt-2">Loading products...</p>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={isShop ? 6 : 9} className="py-16 text-center text-slate-400">
                        No products found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const skuDisplay = p.sku ? p.sku : "—";
                      const nameDisplay = p.modelAndName || p.productName;
                      const isOnlineWeb =
                        p.source === "ONLINE_WEB" ||
                        p.source === "LK_TRONICS" ||
                        Boolean(p.externalId);

                      return (
                        <tr
                          key={p.id}
                          id={`product-row-${p.id}`}
                          onClick={() => {
                            const offline = typeof navigator !== "undefined" && !navigator.onLine;
                            if (isShop && offline) {
                              setPreviewProduct(p);
                            } else {
                              saveScrollState(p.id);
                              router.push(`/products/${p.id}`);
                            }
                          }}
                          className={`cursor-pointer transition-colors group ${
                            isOnlineWeb
                              ? "border-l-4 border-l-orange-500 bg-orange-950/10 hover:bg-orange-950/20"
                              : "border-l-4 border-l-blue-500/50 hover:bg-slate-800/60"
                          }`}
                          title="Click row to view product details"
                        >
                          {/* 1. Sku / Source */}
                          <td className="px-2.5 py-2 font-mono whitespace-nowrap">
                            <div className="flex flex-col gap-0.5 items-start">
                              <span
                                className={`font-bold tracking-wide text-xs ${
                                  isOnlineWeb ? "text-orange-400" : "text-blue-400"
                                }`}
                              >
                                {skuDisplay}
                              </span>
                              {isOnlineWeb ? (
                                <div className="flex flex-col gap-0.5 items-start">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 shadow-sm"
                                    title="Product synced from Online Web (lk-tronics.com)"
                                  >
                                    <Globe className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                                    Online Web
                                  </span>
                                  {(p.supplierId || (p.supplier && p.supplier.name) || p.additionalNote?.includes("PMS Updated")) && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 shadow-sm"
                                      title={`Price updated via PMS ${p.supplier ? `(Supplier: ${p.supplier.name})` : ""}`}
                                    >
                                      PMS Updated
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                  title="PMS local product"
                                >
                                  PMS
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Name & Supply / Special Note */}
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors max-w-[220px] lg:max-w-[280px] truncate text-xs">
                              {nameDisplay}
                            </div>
                            {(p.referenceLink || p.externalUrl) && (
                              <div className="mt-0.5">
                                <a
                                  href={p.referenceLink || p.externalUrl!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 hover:underline transition-colors"
                                  title="Open product on web site"
                                >
                                  <span>View on Web Site</span>
                                  <ExternalLink className="w-3 h-3 text-violet-400 shrink-0" />
                                </a>
                              </div>
                            )}
                            {(p.supplierNote || p.additionalNote) && (
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-amber-300/90 max-w-[220px] lg:max-w-[280px] truncate font-normal">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] uppercase font-bold tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">
                                  {p.supplierNote ? "Note" : "Note"}
                                </span>
                                <span className="truncate text-slate-300" title={p.supplierNote || p.additionalNote || ""}>
                                  {p.supplierNote || p.additionalNote}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 3. Category (Hidden for SHOP) */}
                          {!isShop && (
                            <td className="px-2 py-2">
                              {(() => {
                                let catList: string[] = [];
                                if (p.categoryNames) {
                                  try {
                                    const parsed = JSON.parse(p.categoryNames);
                                    if (Array.isArray(parsed)) {
                                      catList = parsed.filter(Boolean);
                                    }
                                  } catch {
                                    catList = p.categoryNames
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                }
                              }
                              if (catList.length === 0 && p.category?.name) {
                                catList = [p.category.name];
                              }

                              if (catList.length === 0) {
                                return <span className="text-slate-500 font-mono text-[11px]">—</span>;
                              }

                              return (
                                <div className="w-[120px] max-w-[120px] flex flex-col gap-1">
                                  {catList.map((cat, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border break-words line-clamp-2 leading-tight ${
                                        idx === 0
                                          ? "bg-slate-800 text-slate-300 border-slate-700"
                                          : "bg-indigo-950/50 text-indigo-300 border-indigo-800/40"
                                      }`}
                                      title={catList.length > 1 ? `Category ${idx + 1}: ${cat}` : cat}
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        )}

                        {/* 4. Status (Hidden for SHOP) */}
                        {!isShop && (
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {getStatusBadge(p.status)}
                          </td>
                        )}

                        {/* 5. Qty / Stock */}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          {p.shippingClass === "over-the-sea" || p.shippingClass === "Over the Sea" ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm"
                              title="Shipping Class: Over the Sea"
                            >
                              <span>🚢</span>
                              <span>Over Sea</span>
                            </span>
                          ) : p.stockStatus === "outofstock" || p.quantity === 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                              {p.quantity}
                            </span>
                          )}
                        </td>

                        {/* 6. Price (LKR) */}
                        <td className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">
                          {p.status === "NOT_REQUESTED" ? (
                            <span className="text-sky-400/90 text-[10px] font-semibold">Not Req</span>
                          ) : p.status === "PRICE_NOT_AVAILABLE" || Number(p.priceLKR || p.price) === 0 ? (
                            <span className="text-rose-400 text-[10px]">Not Available</span>
                          ) : (
                            <span className="text-emerald-400 font-bold text-xs">
                              {formatLKR(p.priceLKR || p.price)}
                            </span>
                          )}
                        </td>

                        {/* 7. Date (Price update date or added date for pending request) */}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          {(() => {
                            const isPending = p.status === "PENDING";
                            const isPmsUpdatedWeb =
                              isOnlineWeb &&
                              Boolean(
                                p.supplierId ||
                                (p.supplier && p.supplier.name) ||
                                p.additionalNote?.includes("PMS Updated")
                              );

                            // Rule: For online web product, do not show date UNLESS it was requested by PMS and uploaded price via PMS (or pending)
                            if (isOnlineWeb && !isPmsUpdatedWeb && !isPending) {
                              return <span className="text-slate-600 font-mono">—</span>;
                            }

                            const dateToShow = isPending
                              ? (p.createdAt || p.productDate)
                              : (p.priceUpdatedAt || p.createdAt || p.productDate);

                            return (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono text-slate-200 text-[11px]">
                                  {dateToShow ? formatDateDMY(dateToShow) : "—"}
                                </span>
                                <span
                                  className={`text-[8.5px] uppercase tracking-wider font-semibold ${
                                    isPending
                                      ? "text-amber-400/80"
                                      : isPmsUpdatedWeb
                                      ? "text-indigo-400/90 font-bold"
                                      : p.priceUpdatedAt
                                      ? "text-emerald-400/80"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {isPending
                                    ? "Requested"
                                    : isPmsUpdatedWeb
                                    ? "PMS Updated"
                                    : p.priceUpdatedAt
                                    ? "Price Updated"
                                    : "Added Date"}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* 8. Image (Enlarged for SHOP) */}
                        <td className="px-1.5 py-1 text-center whitespace-nowrap">
                          {p.imagePath ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(p.imagePath!);
                              }}
                              className="inline-block relative group/img cursor-pointer"
                              title="Click to zoom image"
                            >
                              <img
                                src={p.imagePath}
                                alt={nameDisplay}
                                referrerPolicy="no-referrer"
                                className={`${
                                  isShop ? "w-16 h-16 rounded-xl" : "w-9 h-9 rounded-lg"
                                } object-cover border border-slate-700 bg-slate-950 group-hover:border-indigo-500 group-hover:scale-105 transition-all shadow-md mx-auto`}
                              />
                            </button>
                          ) : (
                            <div
                              className={`${
                                isShop ? "w-16 h-16 rounded-xl" : "w-9 h-9 rounded-lg"
                              } border border-slate-800 bg-slate-950/60 flex items-center justify-center mx-auto text-slate-600`}
                            >
                              <ImageIcon className={`${isShop ? "w-7 h-7" : "w-4 h-4"} stroke-1`} />
                            </div>
                          )}
                        </td>

                        {/* 9. Actions (Hidden for SHOP) */}
                        {!isShop && (
                          <td
                            className="px-2 py-2 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1">
                              {/* Request Price Button */}
                              {canRequestPrice(p) && (
                                <button
                                  onClick={() => handleRequestPrice(p.id, nameDisplay)}
                                  disabled={requestingPriceId === p.id}
                                  className="p-1.5 rounded-lg border transition-all bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 cursor-pointer"
                                  title={
                                    p.status === "PENDING"
                                      ? "Product is currently Pending: Click to re-request supplier quote"
                                      : "Request Price (moves to Pending)"
                                  }
                                >
                                  {requestingPriceId === p.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              {/* Edit (Hidden for SHOP) */}
                              <Link
                                href={`/products/${p.id}/edit`}
                                onClick={() => saveScrollState(p.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                                title="Edit Product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Link>

                              {/* Delete (Staff & Admin, Hidden for SHOP) */}
                              {(() => {
                                const isPmsModified = Boolean(
                                  p.supplierId ||
                                  (p.supplier && p.supplier.name) ||
                                  p.additionalNote?.includes("PMS Updated") ||
                                  p.status === "PENDING"
                                );

                                if (isOnlineWeb && !isPmsModified) {
                                  return null;
                                }

                                return (
                                  <button
                                    onClick={() => handleDelete(p.id, nameDisplay, isOnlineWeb)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isOnlineWeb
                                        ? "text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                                        : "text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                                    }`}
                                    title={
                                      isOnlineWeb
                                        ? "Remove PMS quotation & modifications (reverts to standard web product)"
                                        : "Delete Product"
                                    }
                                  >
                                    {isOnlineWeb ? (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              Showing {products.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, total)} of {total} items
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  saveScrollPosToTop();
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="p-2 rounded-lg border border-slate-800 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-white px-2">
                Page {page} of {totalPages || 1}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  saveScrollPosToTop();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                className="p-2 rounded-lg border border-slate-800 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Admin Setting: Price Validity Period Modal */}
      {isValidityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                Price Validity Period Setting
              </h3>
              <button
                onClick={() => setIsValidityModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validityMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                {validityMessage}
              </div>
            )}

            <form onSubmit={handleSaveValidityPeriod} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quotation Validity Duration (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={validityMonths}
                  onChange={(e) => setValidityMonths(parseInt(e.target.value, 10) || 6)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none font-bold"
                />
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Default is <strong>6 months</strong>. After this period from the supplier quotation date, products will automatically transition from <strong>Active</strong> to <strong>Expired</strong>, prompting for a re-quotation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsValidityModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingValidity}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
                >
                  {isSavingValidity ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save & Apply"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instant Product Preview Modal (0ms Offline Preview for Shop) */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full p-6 shadow-2xl shadow-black/80 relative max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1.5 pr-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs text-orange-400 bg-orange-950/60 px-2.5 py-1 rounded-lg border border-orange-500/40">
                    SKU: {previewProduct.sku || previewProduct.recordNo || "—"}
                  </span>
                  {previewProduct.shippingClass === "over-the-sea" || previewProduct.shippingClass === "Over the Sea" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                      🚢 Over the Sea
                    </span>
                  ) : null}
                  {previewProduct.stockStatus === "outofstock" || previewProduct.quantity === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      Out of Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                      Qty: {previewProduct.quantity}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white leading-snug pt-1">
                  {previewProduct.modelAndName || previewProduct.productName}
                </h3>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="py-4 space-y-5 overflow-y-auto max-h-[calc(85vh-160px)] pr-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Image Section */}
                <div className="md:col-span-5 bg-slate-950 rounded-2xl p-3 border border-slate-800 flex flex-col items-center justify-center min-h-[220px]">
                  {previewProduct.imagePath ? (
                    <div className="relative group/modalimg w-full flex items-center justify-center">
                      <img
                        src={previewProduct.imagePath}
                        alt={previewProduct.productName}
                        referrerPolicy="no-referrer"
                        className="max-h-56 w-auto object-contain rounded-xl"
                      />
                      <button
                        onClick={() => setPreviewImage(previewProduct.imagePath!)}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-300 hover:text-white transition-opacity"
                        title="Zoom Image"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-2 py-8">
                      <ImageIcon className="w-12 h-12 stroke-1" />
                      <span className="text-xs">No image available</span>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="md:col-span-7 space-y-4">
                  {/* Selling Price Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90 block mb-1">
                      Selling Price (LKR)
                    </span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      {previewProduct.status === "NOT_REQUESTED"
                        ? "Not Requested"
                        : previewProduct.status === "PRICE_NOT_AVAILABLE" ||
                          Number(previewProduct.priceLKR || previewProduct.price) === 0
                        ? "Price Not Available"
                        : formatLKR(previewProduct.priceLKR || previewProduct.price)}
                    </span>
                  </div>

                  {/* Categories */}
                  {previewProduct.categoryNames && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">Categories</span>
                      <div className="flex flex-wrap gap-1.5">
                        {previewProduct.categoryNames
                          .replace(/[\[\]"]/g, "")
                          .split(",")
                          .map((cat: string, i: number) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 border border-slate-700 font-medium"
                            >
                              {cat.trim()}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Storage Warehouse Location (Section & Rack) for Shop user */}
                  {isShop && (() => {
                    const loc = extractStorageLocation(
                      previewProduct.additionalNote,
                      previewProduct.description
                    );
                    if (!loc) return null;
                    return (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                            Storage Location
                          </span>
                          <div className="flex flex-wrap items-center gap-2 font-mono font-black text-xs text-white mt-0.5">
                            {loc.section && (
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300">
                                SECTION: <strong className="text-white font-bold">{loc.section}</strong>
                              </span>
                            )}
                            {loc.rack && (
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300">
                                RACK: <strong className="text-white font-bold">{loc.rack}</strong>
                              </span>
                            )}
                            {loc.shelf && (
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300">
                                SHELF: <strong className="text-white font-bold">{loc.shelf}</strong>
                              </span>
                            )}
                            {!loc.section && !loc.rack && !loc.shelf && (
                              <span className="text-slate-200">{loc.raw}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Description / Specifications */}
                  {previewProduct.description && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Specifications & Details
                      </span>
                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre-line leading-relaxed">
                        {previewProduct.description}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <div>
                {(previewProduct.referenceLink || previewProduct.externalUrl) && (
                  <a
                    href={previewProduct.referenceLink || previewProduct.externalUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium"
                  >
                    <span>View on Website</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewProduct(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = previewProduct.id;
                    setPreviewProduct(null);
                    saveScrollState(id);
                    router.push(`/products/${id}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Full Page View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Image Preview</h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden min-h-[250px]">
              <img
                src={previewImage}
                alt="Product Preview"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
      {/* Product Excel Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-sky-400" />
                  Import Products from Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload product sheets to PMS. Items with price become <span className="text-emerald-400 font-semibold">Active</span>; items without price become <span className="text-sky-400 font-semibold">Not Requested</span>.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                  setImportSuccess(null);
                  setImportPreview(null);
                  setImportFile(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* File Selector Zone */}
              <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 flex flex-col items-center justify-center text-center space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-sky-400" />
                <div>
                  <label
                    htmlFor="product-excel-input"
                    className="cursor-pointer text-xs font-bold text-sky-400 hover:text-sky-300 underline"
                  >
                    Click to select .xlsx Excel file
                  </label>
                  <input
                    id="product-excel-input"
                    type="file"
                    accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setImportFile(f);
                      setImportError(null);
                      setImportSuccess(null);
                      setImportPreview(null);
                    }}
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {importFile ? `Selected: ${importFile.name} (${(importFile.size / 1024).toFixed(1)} KB)` : "Upload file matching the standard 13-column supply template"}
                  </p>
                </div>
              </div>

              {/* Optional Category & Supplier Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Assign Category (Optional):
                  </label>
                  <CategorySearchDropdown
                    categories={categories}
                    value={importCategoryId}
                    onChange={(val) => setImportCategoryId(val)}
                    placeholder="None / Unassigned"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Assign Supplier (Optional):
                  </label>
                  <select
                    value={importSupplierId}
                    onChange={(e) => setImportSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="ALL">None / Unassigned</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id.toString()}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Helpful Guidelines Callout */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  Import Behavior & Status Rules:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                  <li><strong className="text-slate-200">13 Columns Standard:</strong> Product name (Col A), Description (Col B), Quantity (Col C), Image (Col D), Link (Col E), Weight (Col F), Price (Col G)...</li>
                  <li><strong className="text-emerald-400">With Price:</strong> If price &gt; 0, product is created with status <span className="text-emerald-400 font-semibold">Active</span> and initial price history is logged.</li>
                  <li><strong className="text-sky-400">Without Price:</strong> If price is 0 or blank, product is created with status <span className="text-sky-400 font-semibold">Not Requested</span>.</li>
                  <li><strong className="text-slate-200">Automatic Record Numbers:</strong> Unique continuous sequential record numbers (e.g. 000120) are automatically assigned.</li>
                </ul>
              </div>

              {/* Status & Error Messages */}
              {importError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {/* Preview Results (when dryRun finishes) */}
              {importPreview && (
                <div ref={importPreviewRef} className="space-y-3 pt-2 scroll-mt-4">
                  {/* Warning banner when duplicate products are in PMS */}
                  {importPreview.summary.alreadyExistsCount > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Duplicate Notice: </span>
                        <span>
                          {importPreview.summary.alreadyExistsCount} product{importPreview.summary.alreadyExistsCount > 1 ? "s" : ""} already exist in PMS and will <strong className="text-amber-200 underline">NOT</strong> be added. Only the other {importPreview.summary.activeCount + importPreview.summary.notRequestedCount} new product{importPreview.summary.activeCount + importPreview.summary.notRequestedCount !== 1 ? "s" : ""} will be added to PMS.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-sky-400" />
                      Validation &amp; Preview Summary:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                        Total Rows: {importPreview.summary.totalRows}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                        To Add: {importPreview.summary.activeCount + importPreview.summary.notRequestedCount}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                        Active: {importPreview.summary.activeCount}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20">
                        Not Requested: {importPreview.summary.notRequestedCount}
                      </span>
                      {importPreview.summary.alreadyExistsCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30">
                          ⚠️ In PMS (Skipped): {importPreview.summary.alreadyExistsCount}
                        </span>
                      )}
                      {importPreview.summary.errorCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold border border-rose-500/20">
                          Errors: {importPreview.summary.errorCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-800 text-slate-200 border-b border-slate-700">
                        <tr>
                          <th className="p-2 text-center w-10">#</th>
                          <th className="p-2 text-center w-12">Image</th>
                          <th className="p-2">Product / Model Name</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-center">Weight</th>
                          <th className="p-2 text-right">Price</th>
                          <th className="p-2 text-center">Import Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {importPreview.previewRows.map((r: any, idx: number) => (
                          <tr
                            key={idx}
                            className={
                              r.alreadyExistsInDb
                                ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                                : "hover:bg-slate-900/60"
                            }
                          >
                            <td className="p-2 text-center font-mono text-slate-500 text-[10px]">
                              {r.rowNumber}
                            </td>
                            <td className="p-2 text-center">
                              {r.imagePath ? (
                                <img
                                  src={r.imagePath}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-cover border border-slate-700 bg-slate-900 mx-auto"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="text-[10px] text-slate-600">—</span>
                              )}
                            </td>
                            <td className="p-2 font-medium text-white max-w-[220px] truncate">
                              {r.productName}
                              {r.alreadyExistsInDb && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                  Already in PMS
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono">
                              {r.quantity}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-400">
                              {r.weight != null ? r.weight : "—"}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {r.price > 0 ? (
                                <span className="text-emerald-400 font-bold">
                                  {formatLKR(r.price)}
                                </span>
                              ) : (
                                <span className="text-slate-500">0.00</span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {r.errors && r.errors.length > 0 ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400"
                                  title={r.errors.join("; ")}
                                >
                                  Error
                                </span>
                              ) : r.alreadyExistsInDb ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  title="Already exists in PMS database — will NOT be added"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                  Already in PMS (Skipped)
                                </span>
                              ) : r.computedStatus === "ACTIVE" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Active (To Add)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                  <Clock className="w-2.5 h-2.5" />
                                  Not Requested (To Add)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
              <a
                href="/api/supply/template"
                download="PMS_Product_Import_Template.xlsx"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel Format Template
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportError(null);
                    setImportSuccess(null);
                    setImportPreview(null);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  Close
                </button>

                {!importPreview ? (
                  <button
                    type="button"
                    disabled={!importFile || isValidatingImport}
                    onClick={async () => {
                      if (!importFile) return;
                      setIsValidatingImport(true);
                      setImportError(null);
                      setImportSuccess(null);
                      try {
                        const fd = new FormData();
                        fd.append("file", importFile);
                        fd.append("dryRun", "true");
                        if (importCategoryId !== "ALL") fd.append("categoryId", importCategoryId);
                        if (importSupplierId !== "ALL") fd.append("supplierId", importSupplierId);

                        const res = await fetch("/api/products/upload", {
                          method: "POST",
                          body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setImportError(data.error || "Failed to validate Excel sheet.");
                        } else {
                          setImportPreview(data);
                        }
                      } catch (err: any) {
                        setImportError(err.message || "Failed to validate file.");
                      } finally {
                        setIsValidatingImport(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-sky-600/40 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition-all"
                  >
                    {isValidatingImport ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-3.5 h-3.5" />
                        Validate & Preview
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      isSubmittingImport ||
                      (importPreview.summary.activeCount + importPreview.summary.notRequestedCount) === 0
                    }
                    onClick={async () => {
                      if (!importFile) return;
                      setIsSubmittingImport(true);
                      setImportError(null);
                      try {
                        const fd = new FormData();
                        fd.append("file", importFile);
                        fd.append("dryRun", "false");
                        if (importCategoryId !== "ALL") fd.append("categoryId", importCategoryId);
                        if (importSupplierId !== "ALL") fd.append("supplierId", importSupplierId);

                        const res = await fetch("/api/products/upload", {
                          method: "POST",
                          body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setImportError(data.error || "Failed to import products.");
                        } else {
                          const successMsg = data.message || `Successfully imported ${data.insertedCount} products.`;
                          setImportPreview(null);
                          setImportFile(null);
                          setImportError(null);
                          setImportSuccess(null);
                          setIsImportModalOpen(false);
                          setPageToast({ type: "success", message: successMsg });
                          setTimeout(() => setPageToast(null), 6000);
                          fetchProducts();
                        }
                      } catch (err: any) {
                        setImportError(err.message || "Failed to submit import.");
                      } finally {
                        setIsSubmittingImport(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    {isSubmittingImport ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Importing Products...
                      </>
                    ) : (importPreview.summary.activeCount + importPreview.summary.notRequestedCount) === 0 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                        No New Products to Add
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Confirm &amp; Add {importPreview.summary.activeCount + importPreview.summary.notRequestedCount} New Products
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Web Store Sync Modal (lk-tronics.com) */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Sync from lk-tronics.com
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Connected
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Synchronize online store products, prices, stock, and images into PMS
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isSyncing && setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Store Connection Info Card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Store Catalog
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-white">
                      {syncStats ? `${syncStats.totalStoreProducts} Products` : "Connecting..."}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    https://lk-tronics.com (Read-only API)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Synced in PMS
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-violet-400">
                      {syncStats ? `${syncStats.syncedInPms} Synced` : "—"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {syncStats?.lastSyncedAt
                      ? `Updated: ${formatDateDMY(syncStats.lastSyncedAt)}`
                      : "Ready to sync"}
                  </span>
                </div>
              </div>

              {/* Sync Mode Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Select Sync Mode:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSyncMode("quick")}
                    disabled={isSyncing}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      syncMode === "quick"
                        ? "bg-violet-600/15 border-violet-500/50 ring-1 ring-violet-500/50"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs text-white flex items-center justify-between">
                      <span>Quick Sync</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">
                        Fast
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Sync latest 50 products & recent updates
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncMode("full")}
                    disabled={isSyncing}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      syncMode === "full"
                        ? "bg-violet-600/15 border-violet-500/50 ring-1 ring-violet-500/50"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs text-white flex items-center justify-between">
                      <span>Full Catalog Sync</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                        All Pages
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Sync all 992+ items across the entire store
                    </p>
                  </button>
                </div>
              </div>

              {/* Visual Differentiation Notice */}
              <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-800/40 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-xs text-violet-200/90 leading-relaxed">
                  Synced web store items are displayed in the main product table with a prominent{" "}
                  <span className="font-semibold text-white px-1.5 py-0.5 rounded bg-violet-500/30">
                    🌐 lk-tronics.com
                  </span>{" "}
                  badge and left violet accent, allowing seamless search, stock monitoring, and direct links to the live site.
                </p>
              </div>

              {/* Sync Progress Indicator */}
              {isSyncing && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {syncMode === "full"
                        ? "Syncing all pages from lk-tronics.com (please wait)..."
                        : "Syncing latest products from lk-tronics.com..."}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Fetching product names, SKUs, prices, stock quantities, and images...
                    </p>
                  </div>
                </div>
              )}

              {/* Sync Result */}
              {syncResult && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-300">
                      {syncResult.message}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Added: <span className="font-bold text-white">{syncResult.added}</span> • Updated: <span className="font-bold text-white">{syncResult.updated}</span> • Processed: <span className="font-bold text-white">{syncResult.processed}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Sync Error */}
              {syncError && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-rose-300">Sync Error</p>
                    <p className="text-[11px] text-rose-200 mt-0.5">{syncError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-950/50">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
              >
                {syncResult ? "Close" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSyncWebStore}
                disabled={isSyncing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {syncMode === "full" ? "Start Full Sync (All Pages)" : "Start Quick Sync (50 Items)"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Superadmin Data Cleanup Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl w-full max-w-2xl shadow-2xl shadow-rose-950/50 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-rose-900/30 bg-rose-950/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Superadmin Data Cleanup
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      SUPERADMIN ONLY
                    </span>
                  </h3>
                  <p className="text-xs text-rose-200/80">
                    Delete Web Store synced data or PMS local data separately with zero collateral loss
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isExecutingClear && setIsClearModalOpen(false)}
                disabled={isExecutingClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Current Catalog Breakdown Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-violet-900/40">
                  <span className="text-[11px] font-semibold text-violet-300 block mb-1">
                    🌐 Web Store Synced
                  </span>
                  <span className="text-xl font-bold text-white">
                    {isLoadingClearCounts ? "..." : (clearCounts?.webSyncCount ?? "—")}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    From lk-tronics.com
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-indigo-900/40">
                  <span className="text-[11px] font-semibold text-indigo-300 block mb-1">
                    📦 PMS Local Data
                  </span>
                  <span className="text-xl font-bold text-white">
                    {isLoadingClearCounts ? "..." : (clearCounts?.pmsCount ?? "—")}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Manual & Excel records
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Total Products
                  </span>
                  <span className="text-xl font-bold text-slate-200">
                    {isLoadingClearCounts ? "..." : (clearCounts?.total ?? "—")}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Combined database count
                  </span>
                </div>
              </div>

              {/* Target Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Select Data Clearance Target:
                </label>
                <div className="space-y-2.5">
                  {/* Option 1: Web Sync Data Only */}
                  <label
                    onClick={() => {
                      setSelectedClearTarget("WEB_SYNC");
                      setClearError(null);
                    }}
                    className={`p-3.5 rounded-xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                      selectedClearTarget === "WEB_SYNC"
                        ? "bg-violet-950/30 border-violet-500/60 ring-1 ring-violet-500/50"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="clearTarget"
                      checked={selectedClearTarget === "WEB_SYNC"}
                      onChange={() => setSelectedClearTarget("WEB_SYNC")}
                      className="mt-1 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white flex items-center gap-2">
                          Clear Web Store Sync Data Only
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                            {clearCounts?.webSyncCount ?? 0} items
                          </span>
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                          Safe • PMS Preserved
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Deletes only the synced catalog from <span className="text-slate-300 font-medium">lk-tronics.com</span>. All local PMS inventory, quotations, and manual products are 100% untouched. You can re-sync from the web store at any time.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: PMS Local Data Only */}
                  <label
                    onClick={() => {
                      setSelectedClearTarget("PMS");
                      setClearError(null);
                    }}
                    className={`p-3.5 rounded-xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                      selectedClearTarget === "PMS"
                        ? "bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/50"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="clearTarget"
                      checked={selectedClearTarget === "PMS"}
                      onChange={() => setSelectedClearTarget("PMS")}
                      className="mt-1 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white flex items-center gap-2">
                          Clear PMS Local Data Only
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                            {clearCounts?.pmsCount ?? 0} items
                          </span>
                        </span>
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                          Web Store Preserved
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Deletes all local PMS products created manually or via Excel import. All synced web store items from lk-tronics.com remain untouched.
                      </p>
                    </div>
                  </label>

                  {/* Option 3: Clear All Products */}
                  <label
                    onClick={() => {
                      setSelectedClearTarget("ALL");
                      setClearError(null);
                    }}
                    className={`p-3.5 rounded-xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                      selectedClearTarget === "ALL"
                        ? "bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/50"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="clearTarget"
                      checked={selectedClearTarget === "ALL"}
                      onChange={() => setSelectedClearTarget("ALL")}
                      className="mt-1 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white flex items-center gap-2">
                          Clear All Products (Complete Reset)
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                            {clearCounts?.total ?? 0} items
                          </span>
                        </span>
                        <span className="text-[10px] font-semibold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40">
                          Destructive
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Completely deletes ALL products in the database (both local PMS and online web synced items). Resets product catalog to 0.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Confirmation Input Guard */}
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Confirmation Required: Irreversible Action</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  To confirm deletion of{" "}
                  <span className="font-bold text-white">
                    {selectedClearTarget === "WEB_SYNC"
                      ? `${clearCounts?.webSyncCount ?? 0} Web Sync items`
                      : selectedClearTarget === "PMS"
                      ? `${clearCounts?.pmsCount ?? 0} PMS Local items`
                      : `ALL ${clearCounts?.total ?? 0} products`}
                  </span>
                  , type <span className="font-mono font-bold text-rose-400 px-1 py-0.5 rounded bg-rose-950/70 border border-rose-800/60">DELETE</span> in the box below:
                </p>
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  disabled={isExecutingClear}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-800/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-white font-mono text-sm placeholder:text-slate-600 outline-none"
                />
              </div>

              {/* Result Notice */}
              {clearResult && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-300">Cleanup Successful</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{clearResult.message}</p>
                  </div>
                </div>
              )}

              {/* Error Notice */}
              {clearError && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-rose-300">Action Required</p>
                    <p className="text-[11px] text-rose-200 mt-0.5">{clearError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/50">
              <span className="text-[11px] text-slate-500">
                Action will be permanently recorded in database
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(false)}
                  disabled={isExecutingClear}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {clearResult ? "Close" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteClear}
                  disabled={isExecutingClear || clearConfirmText.trim() !== "DELETE"}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900/40 disabled:text-rose-400/50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all"
                >
                  {isExecutingClear ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {selectedClearTarget === "WEB_SYNC"
                        ? `Clear ${clearCounts?.webSyncCount ?? ""} Web Products`
                        : selectedClearTarget === "PMS"
                        ? `Clear ${clearCounts?.pmsCount ?? ""} PMS Products`
                        : `Clear All ${clearCounts?.total ?? ""} Products`}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
