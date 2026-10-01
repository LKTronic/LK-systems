"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { DatePickerCalendar } from "@/components/DatePickerCalendar";
import {
  ArrowLeft,
  Download,
  Filter,
  Search,
  Truck,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  Trash2,
  Edit3,
  Boxes,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ExternalLink,
  Users,
} from "lucide-react";

interface Supplier {
  id: number;
  name: string;
}

interface Product {
  id: number;
  recordNo: string;
  referenceNo?: string | null;
  productName: string;
  modelAndName?: string | null;
  sku?: string | null;
  quantity: number;
  weight?: number | null;
  description?: string | null;
  productDate: string;
  imagePath?: string | null;
  referenceLink?: string | null;
  additionalNote?: string | null;
  status: string;
  categoryId?: number | null;
  category?: {
    id: number;
    name: string;
  } | null;
  supplierId?: number | null;
  supplier?: {
    id: number;
    name: string;
  } | null;
}

export default function PendingDownloadPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [addedBy, setAddedBy] = useState<string>("ALL");
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Persistent Selected Products Map (id -> Product)
  // Maintains selection across filter changes!
  const [selectedMap, setSelectedMap] = useState<Map<number, Product>>(new Map());

  // Confirmation & Edit Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [modalItems, setModalItems] = useState<Product[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState("");
  const [savingItemIds, setSavingItemIds] = useState<Set<number>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Load Suppliers & Users
  const fetchMetadata = async () => {
    try {
      const [supRes, usersRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/users/list"),
      ]);
      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(data.suppliers || []);
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
      }
    } catch (err) {
      console.error("Failed to load filter metadata:", err);
    }
  };

  // Load Pending Products with Filters
  const fetchPendingProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: "PENDING",
        limit: "1000",
      });

      if (supplierFilter !== "ALL") {
        params.set("supplierId", supplierFilter);
      }
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (addedBy !== "ALL") params.set("createdBy", addedBy);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending products:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Live search debouncing: as user types, update debouncedSearch after 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPendingProducts();
  }, [supplierFilter, fromDate, toDate, addedBy, debouncedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const handleResetFilters = () => {
    setSupplierFilter("ALL");
    setFromDate("");
    setToDate("");
    setAddedBy("ALL");
    setSearch("");
    setDebouncedSearch("");
  };

  // Selection Logic
  const visibleProductIds = useMemo(() => products.map((p) => p.id), [products]);

  const allVisibleSelected = useMemo(() => {
    if (visibleProductIds.length === 0) return false;
    return visibleProductIds.every((id) => selectedMap.has(id));
  }, [visibleProductIds, selectedMap]);

  const someVisibleSelected = useMemo(() => {
    if (visibleProductIds.length === 0) return false;
    return (
      visibleProductIds.some((id) => selectedMap.has(id)) && !allVisibleSelected
    );
  }, [visibleProductIds, selectedMap, allVisibleSelected]);

  const toggleSelectAllVisible = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (allVisibleSelected) {
        // Deselect all visible
        visibleProductIds.forEach((id) => next.delete(id));
      } else {
        // Select all visible
        products.forEach((p) => next.set(p.id, p));
      }
      return next;
    });
  };

  const toggleSelectOne = (product: Product) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
      } else {
        next.set(product.id, product);
      }
      return next;
    });
  };

  const handleClearAllSelected = () => {
    setSelectedMap(new Map());
  };

  // Open Confirm / Edit Modal
  const handleOpenConfirmModal = () => {
    if (selectedMap.size === 0) {
      alert("Please select at least one pending product to export.");
      return;
    }
    // Convert map to editable array
    setModalItems(Array.from(selectedMap.values()).map((p) => ({ ...p })));
    setCustomFileName("");
    setIsConfirmModalOpen(true);
  };

  // Update item in modal and immediately save to database
  const handleModalItemChange = async (
    id: number,
    field: "supplierId" | "quantity" | "description",
    value: any
  ) => {
    let patchPayload: any = {};
    let updatedItemPatch: any = {};

    if (field === "supplierId") {
      const numVal = value ? Number(value) : null;
      const supObj = suppliers.find((s) => s.id === numVal) || null;
      patchPayload = { supplierId: numVal };
      updatedItemPatch = { supplierId: numVal, supplier: supObj };
    } else if (field === "quantity") {
      const qty = parseInt(value, 10);
      const safeQty = !isNaN(qty) && qty > 0 ? qty : 1;
      patchPayload = { quantity: safeQty };
      updatedItemPatch = { quantity: safeQty };
    } else if (field === "description") {
      patchPayload = { description: value ? value.trim() : null };
      updatedItemPatch = { description: value };
    }

    // 1. Update modal item
    setModalItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            ...updatedItemPatch,
          };
        }
        return item;
      })
    );

    // 2. Update selectedMap
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, {
          ...existing,
          ...updatedItemPatch,
        });
      }
      return next;
    });

    // 3. Update products in background
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updatedItemPatch } : p
      )
    );

    // 4. Save directly to database
    setSavingItemIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      });
    } catch (err) {
      console.error("Error saving pending product changes:", err);
    } finally {
      setSavingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Bulk assign supplier to all modal items and save to database
  const handleBulkAssignSupplier = async (supplierIdVal: string) => {
    if (!supplierIdVal) return;
    const numVal = supplierIdVal === "NONE" ? null : Number(supplierIdVal);
    const supObj = suppliers.find((s) => s.id === numVal) || null;

    setBulkAssigning(true);

    // 1. Update modalItems
    setModalItems((prev) =>
      prev.map((item) => ({
        ...item,
        supplierId: numVal,
        supplier: supObj,
      }))
    );

    // 2. Update selectedMap
    setSelectedMap((prev) => {
      const next = new Map(prev);
      prev.forEach((item, id) => {
        next.set(id, {
          ...item,
          supplierId: numVal,
          supplier: supObj,
        });
      });
      return next;
    });

    // 3. Update products in background
    setProducts((prev) =>
      prev.map((p) => {
        if (selectedMap.has(p.id)) {
          return { ...p, supplierId: numVal, supplier: supObj };
        }
        return p;
      })
    );

    // 4. Persist to database
    try {
      await Promise.all(
        modalItems.map((item) =>
          fetch(`/api/products/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supplierId: numVal }),
          })
        )
      );
    } catch (err) {
      console.error("Error bulk updating suppliers:", err);
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleRemoveFromModal = (id: number) => {
    setModalItems((prev) => prev.filter((item) => item.id !== id));
    // Also remove from selectedMap
    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  // Confirm and Download Excel
  const handleConfirmAndDownload = async () => {
    if (modalItems.length === 0) {
      alert("No products selected.");
      return;
    }

    setIsExporting(true);
    setExportSuccessMessage("Saving supplier assignments and generating Excel...");

    try {
      // 1. Ensure all supplier, quantity, and description updates are saved to database
      await Promise.all(
        modalItems.map((item) =>
          fetch(`/api/products/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supplierId: item.supplierId ?? null,
              quantity: item.quantity ? Number(item.quantity) : 1,
              description: item.description ? item.description.trim() : null,
            }),
          })
        )
      );

      // 2. Request Excel for selected IDs
      const productIds = modalItems.map((item) => item.id);
      const res = await fetch("/api/products/export/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate Excel file.");
      }

      const defaultFileName = `PMS_Pending_Requests_USD_${new Date().toISOString().slice(0, 10)}.xlsx`;
      let downloadFileName = customFileName.trim();
      if (!downloadFileName) {
        downloadFileName = defaultFileName;
      } else if (!downloadFileName.toLowerCase().endsWith(".xlsx")) {
        downloadFileName = `${downloadFileName}.xlsx`;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccessMessage("Suppliers saved & Excel file downloaded successfully!");
      setTimeout(() => {
        setIsConfirmModalOpen(false);
        setExportSuccessMessage(null);
        fetchPendingProducts();
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // Supplier breakdown of selected items
  const selectedSupplierSummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    selectedMap.forEach((p) => {
      const name = p.supplier ? p.supplier.name : "No Supplier (Unassigned)";
      summary[name] = (summary[name] || 0) + 1;
    });
    return summary;
  }, [selectedMap]);

  return (
    <AppLayout
      title="Pending Requests Excel Export"
      description="Filter by supplier and date, select specific products, confirm details, and download supplier quotation sheets"
    >
      <div className="space-y-6">
        {/* Top Breadcrumb & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Product Repository
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">
              Showing <span className="font-bold text-amber-400">{products.length}</span> Pending Requests
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedMap.size > 0 && (
              <button
                type="button"
                onClick={handleClearAllSelected}
                className="text-xs text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-rose-500/30 transition-all"
              >
                Clear All Selected ({selectedMap.size})
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenConfirmModal}
              disabled={selectedMap.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Review & Download ({selectedMap.size} Selected)
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Filter className="w-4 h-4 text-indigo-400" />
              Filters & Selection Criteria
            </div>
            <p className="text-[11px] text-slate-400">
              Selections persist across filter changes. Filter by Supplier A, select all, then filter and select unassigned items!
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            {/* Supplier Filter */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                Filter by Supplier
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">All Suppliers (Mixed)</option>
                <option value="NONE">No Supplier Added (Unassigned)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id.toString()}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Added By Filter */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Filter by Added By
              </label>
              <select
                value={addedBy}
                onChange={(e) => setAddedBy(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">All Requesters (Added by)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id.toString()}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date: From (Interactive Calendar) */}
            <DatePickerCalendar
              label="Request Date (From)"
              value={fromDate}
              onChange={(val) => setFromDate(val)}
              placeholder="Pick start date"
            />

            {/* Date: To (Interactive Calendar) */}
            <DatePickerCalendar
              label="Request Date (To)"
              value={toDate}
              onChange={(val) => setToDate(val)}
              placeholder="Pick end date"
            />

            {/* Keyword Search (Live as user types) */}
            <div className="relative">
              <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                Search Product / SKU
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Model, SKU, Ref No..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 pr-8 py-2 text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all flex items-center justify-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                Apply
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white transition-all"
                title="Reset Filters"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Quick Date Range Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              Quick Date:
            </span>
            <button
              type="button"
              onClick={() => {
                const d = new Date().toISOString().slice(0, 10);
                setFromDate(d);
                setToDate(d);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                setFromDate(past.toISOString().slice(0, 10));
                setToDate(now.toISOString().slice(0, 10));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                setFromDate(past.toISOString().slice(0, 10));
                setToDate(now.toISOString().slice(0, 10));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                setFromDate(start.toISOString().slice(0, 10));
                setToDate(now.toISOString().slice(0, 10));
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
            >
              This Month
            </button>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-medium transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Active Selection Summary Banner */}
        {selectedMap.size > 0 && (
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{selectedMap.size} Product(s) Selected for Export</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(selectedSupplierSummary).map(([supName, count]) => (
                  <span
                    key={supName}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300"
                  >
                    <Truck className="w-3 h-3 text-indigo-400" />
                    {supName}: <strong className="text-white">{count}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenConfirmModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Download className="w-4 h-4" />
                Confirm & Download ({selectedMap.size})
              </button>
            </div>
          </div>
        )}

        {/* Pending Products Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              >
                {allVisibleSelected ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : someVisibleSelected ? (
                  <MinusSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                {allVisibleSelected
                  ? "Deselect Visible"
                  : "Select All Filtered (" + products.length + ")"}
              </button>
            </div>

            <span className="text-xs text-slate-400">
              Click checkboxes to select individual items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Request Date</th>
                  <th className="p-3">SKU / Ref</th>
                  <th className="p-3">Model no and name</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-center">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading pending product requests...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      No pending requests found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isSelected = selectedMap.has(p.id);
                    const formattedDate = p.productDate
                      ? new Date(p.productDate).toLocaleDateString()
                      : "—";

                    return (
                      <tr
                        key={p.id}
                        onClick={() => toggleSelectOne(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-indigo-950/30 hover:bg-indigo-950/40"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td
                          className="p-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-slate-400 font-medium">
                          {formattedDate}
                        </td>
                        <td className="p-3 font-mono font-semibold text-indigo-400">
                          {p.sku || p.referenceNo || p.recordNo}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-white">
                            {p.modelAndName || p.productName}
                          </div>
                          {(p.description || p.additionalNote) && (
                            <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                              {p.description || p.additionalNote}
                            </div>
                          )}
                          {p.referenceLink && (p.referenceLink.startsWith("http://") || p.referenceLink.startsWith("https://")) && (
                            <a
                              href={p.referenceLink}
                              target="_blank"
                              rel="noreferrer noopener"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-slate-500 hover:text-indigo-400 inline-flex items-center gap-0.5 mt-0.5"
                            >
                              Datasheet <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-white">
                          {p.quantity || 1}
                        </td>
                        <td className="p-3">
                          {p.category ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {p.category.name}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {p.supplier ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              <Truck className="w-3 h-3" />
                              {p.supplier.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              No Supplier
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {p.imagePath ? (
                            <img
                              src={p.imagePath}
                              alt="Thumbnail"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-700 mx-auto shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-600 text-[10px]">
                              No img
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation & Edit Popup Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/40">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Confirm Products for Pending Request Export ({modalItems.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Review selected products before generating the Excel template. You can assign suppliers or remove items.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification alert if success */}
            {exportSuccessMessage && (
              <div className="m-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {exportSuccessMessage}
              </div>
            )}

            {/* Bulk Supplier Assignment Toolbar */}
            <div className="p-3 mx-4 mt-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-200">
                  Quick Assign Supplier to All {modalItems.length} Products:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  disabled={bulkAssigning}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAssignSupplier(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                >
                  <option value="" disabled>
                    {bulkAssigning ? "Saving to all..." : "-- Choose Supplier to Apply to All --"}
                  </option>
                  <option value="NONE">-- Set All to Unassigned --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {bulkAssigning && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                )}
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                    <th className="p-2.5">SKU / Model</th>
                    <th className="p-2.5 min-w-[200px]">Description</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    <th className="p-2.5">Supplier (Assign/Change)</th>
                    <th className="p-2.5 w-12 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {modalItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="p-2.5">
                        <div className="flex items-center gap-3">
                          {item.imagePath ? (
                            <img
                              src={item.imagePath}
                              alt=""
                              className="w-9 h-9 object-cover rounded border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-slate-600 text-[10px]">
                              N/A
                            </div>
                          )}
                          <div>
                            <div className="font-mono text-indigo-400 font-bold text-[11px]">
                              {item.sku || item.referenceNo || item.recordNo}
                            </div>
                            <div className="font-semibold text-white">
                              {item.modelAndName || item.productName}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          value={item.description ?? item.additionalNote ?? ""}
                          placeholder="Enter description..."
                          onChange={(e) =>
                            handleModalItemChange(
                              item.id,
                              "description",
                              e.target.value
                            )
                          }
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 outline-none w-full"
                        />
                      </td>

                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity ?? 1}
                          onChange={(e) =>
                            handleModalItemChange(
                              item.id,
                              "quantity",
                              e.target.value
                            )
                          }
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center text-white focus:border-indigo-500 outline-none w-14 mx-auto font-mono font-bold"
                        />
                      </td>

                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={item.supplierId || ""}
                            onChange={(e) =>
                              handleModalItemChange(
                                item.id,
                                "supplierId",
                                e.target.value
                              )
                            }
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none w-full max-w-xs"
                          >
                            <option value="">-- No Supplier (Unassigned) --</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          {savingItemIds.has(item.id) && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                          )}
                        </div>
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromModal(item.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Exclude from export"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Export File Name Configuration */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 shrink-0">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Export File Name:</span>
              </label>
              <div className="flex-1 max-w-md flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  placeholder={`PMS_Pending_Requests_USD_${new Date().toISOString().slice(0, 10)}`}
                  className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full"
                />
                <span className="text-xs text-slate-400 font-mono select-none">.xlsx</span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (Leave blank for default naming)
              </span>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
              <div className="text-xs text-slate-400">
                Ready to export <span className="font-bold text-white">{modalItems.length}</span> item(s) into Excel (.xlsx)
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-all"
                >
                  Cancel / Keep Selecting
                </button>
                <button
                  type="button"
                  disabled={isExporting || modalItems.length === 0}
                  onClick={handleConfirmAndDownload}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Excel...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Confirm & Download Excel
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
