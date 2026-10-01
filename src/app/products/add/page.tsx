"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { ImageUpload } from "@/components/ImageUpload";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Barcode,
  Tag,
  Plus,
  Link as LinkIcon,
  FileText,
  Boxes,
  X,
  ImageIcon,
  Truck,
  Weight,
  Search,
  ExternalLink,
} from "lucide-react";


interface Category {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface SuggestionProduct {
  id: number;
  productName: string;
  modelAndName?: string | null;
  sku?: string | null;
  referenceNo?: string | null;
  price: any;
  priceLKR?: any;
  priceUSD?: any;
  status: string;
  weight?: any;
  imagePath?: string | null;
  category?: { id: number; name: string } | null;
  supplier?: { id: number; name: string } | null;
}

export default function AddProductPage() {
  const router = useRouter();

  // Form State: SKU is auto-generated (read-only)
  const [modelAndName, setModelAndName] = useState("");
  const [sku, setSku] = useState("LKREQ00001");
  const [isLoadingSku, setIsLoadingSku] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [referenceLink, setReferenceLink] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);

  // Live Auto-matching Suggestions & Duplicate Detection State
  const [suggestions, setSuggestions] = useState<SuggestionProduct[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [exactMatch, setExactMatch] = useState<SuggestionProduct | null>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);


  // Categories & Modal State
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);

  // Suppliers & Modal State (Optional / Not Required)
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddSupModalOpen, setIsAddSupModalOpen] = useState(false);
  const [newSupName, setNewSupName] = useState("");
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState<string | null>(null);

  // Submission State
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Categories & Suppliers
  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        const raw: Category[] = data.categories || [];
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
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    }
  };

  const fetchNextSku = async () => {
    try {
      const res = await fetch("/api/products/next-sku");
      if (res.ok) {
        const data = await res.json();
        if (data.nextSku) {
          setSku(data.nextSku);
        }
      }
    } catch (err) {
      console.error("Failed to load next SKU:", err);
    } finally {
      setIsLoadingSku(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSuppliers();
    fetchNextSku();
  }, []);

  // Handle clicking outside suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsContainerRef.current &&
        !suggestionsContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Auto-matching Suggestions for Model/Name & SKU
  useEffect(() => {
    const trimmed = modelAndName.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setExactMatch(null);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/suggestions?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: SuggestionProduct[] = await res.json();
          setSuggestions(data);

          const lower = trimmed.toLowerCase();
          const match = data.find(
            (p) =>
              (p.modelAndName && p.modelAndName.toLowerCase().trim() === lower) ||
              (p.productName && p.productName.toLowerCase().trim() === lower) ||
              (p.sku && p.sku.toLowerCase().trim() === lower)
          );
          setExactMatch(match || null);
          if (data.length > 0) {
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch product suggestions:", err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [modelAndName]);

  const formatLKR = (val: any) => {
    const num = Number(val || 0);
    return "Rs. " + num.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Approved
          </span>
        );
      case "ORDERED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Ordered
          </span>
        );
      case "RECEIVED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Received
          </span>
        );
      case "NOT_REQUESTED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Not Requested
          </span>
        );
      case "PRICE_NOT_AVAILABLE":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Price N/A
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Pending
          </span>
        );
    }
  };




  // Handle Add New Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    setIsSavingCategory(true);
    setCategoryModalError(null);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCategoryModalError(data.error || "Failed to create category");
      } else {
        await fetchCategories();
        if (data.category?.id) {
          setCategoryId(data.category.id);
        }
        setNewCatName("");
        setIsAddCatModalOpen(false);
      }
    } catch (err: any) {
      setCategoryModalError(err.message || "Failed to save category");
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Handle Add New Supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSupName.trim();
    if (!trimmed) return;

    setIsSavingSupplier(true);
    setSupplierModalError(null);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSupplierModalError(data.error || "Failed to create supplier");
      } else {
        await fetchSuppliers();
        if (data.supplier?.id) {
          setSupplierId(data.supplier.id);
        }
        setNewSupName("");
        setIsAddSupModalOpen(false);
      }
    } catch (err: any) {
      setSupplierModalError(err.message || "Failed to save supplier");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // Submit Product Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedModel = modelAndName.trim();
    const trimmedSku = sku.trim().toUpperCase();

    if (!trimmedModel) {
      setError("Model no and name is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelAndName: trimmedModel,
          sku: trimmedSku || undefined, // SKU is optional
          quantity: quantity ? parseInt(quantity, 10) : 1,
          weight: weight ? parseFloat(weight) : undefined,
          description: description.trim() || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          supplierId: supplierId ? Number(supplierId) : undefined, // Supplier is optional
          referenceLink: referenceLink.trim() || undefined,
          additionalNote: additionalNote.trim() || undefined,
          imagePath,
          status: "PENDING",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add product request.");
      } else {
        router.push("/products");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="PMS Data Adding"
      description="Create a new product request for supplier quotations"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
          <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
            Status: Pending Quotation
          </span>
        </div>

        {/* Main Card Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="border-b border-slate-800 pb-5 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-400" />
              PMS Data Adding Form
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Input model name and specifications. The reference number will be auto-generated sequentially.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Model Name and SKU row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Model no and name (Required) with Live PMS Search & Price Matching */}
              <div className="sm:col-span-2 relative" ref={suggestionsContainerRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Model no and name <span className="text-rose-400">*</span>
                  </label>
                  {suggestions.length > 0 && !showSuggestions && (
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(true)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <Search className="w-3 h-3" />
                      Show matching ({suggestions.length})
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type name, model no, or SKU (e.g. PowMr POW-HVM3.2H-24V)"
                    value={modelAndName}
                    onChange={(e) => setModelAndName(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    className={`w-full bg-slate-950 border rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 outline-none transition-all ${
                      exactMatch
                        ? "border-amber-500/80 focus:border-amber-500 focus:ring-amber-500/20"
                        : "border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/20"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                    {isLoadingSuggestions ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    ) : modelAndName.trim().length > 0 ? (
                      <Search className="w-4 h-4 text-slate-500" />
                    ) : null}
                  </div>

                  {/* Floating Autocomplete / Matching Results Dropdown directly attached to input */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs font-bold text-slate-200">
                            Matching Products in PMS ({suggestions.length})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isLoadingSuggestions && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowSuggestions(false)}
                            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                            title="Close suggestions"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/80 custom-scrollbar">
                        {suggestions.map((p) => {
                          const hasPrice = Number(p.priceLKR || p.price) > 0;
                          const displayName = p.modelAndName || p.productName;
                          return (
                            <div
                              key={p.id}
                              className="p-3 hover:bg-slate-800/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                                    {displayName}
                                  </span>
                                  {getStatusBadge(p.status)}
                                </div>

                                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-400">
                                  {p.sku && (
                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 text-[11px]">
                                      <Barcode className="w-3 h-3" />
                                      {p.sku}
                                    </span>
                                  )}
                                  {p.referenceNo && (
                                    <span className="font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60 text-[11px]">
                                      Ref: {p.referenceNo}
                                    </span>
                                  )}
                                  {p.category && (
                                    <span className="inline-flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                                      <Tag className="w-3 h-3 text-slate-400" />
                                      {p.category.name}
                                    </span>
                                  )}
                                  {p.supplier && (
                                    <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                      <Truck className="w-3 h-3 text-slate-500" />
                                      {p.supplier.name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                                <div className="text-left sm:text-right">
                                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    PMS Price
                                  </div>
                                  {hasPrice ? (
                                    <div className="text-sm font-extrabold text-emerald-400 font-mono">
                                      {formatLKR(p.priceLKR || p.price)}
                                      {p.priceUSD && Number(p.priceUSD) > 0 && (
                                        <span className="text-xs text-slate-400 font-normal ml-1">
                                          (${Number(p.priceUSD).toFixed(2)})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs font-semibold text-amber-400">
                                      Quotation Pending
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`/products/${p.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm"
                                    title="View product in new tab"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>
                          💡 <strong className="text-slate-300">Adding a variation?</strong> Modify the name/model number slightly to add it as a new product request.
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSuggestions(false)}
                          className="text-indigo-400 hover:underline ml-2"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exact Match / Similar Product Alert Banner shown when suggestions dropdown is dismissed */}
                {exactMatch && !showSuggestions && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-amber-200 flex items-center justify-between flex-wrap gap-1">
                        <span>Product Already Exists in PMS Database:</span>
                        {exactMatch.id && (
                          <a
                            href={`/products/${exactMatch.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-200 underline font-normal"
                          >
                            View Details <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="mt-1 text-slate-300 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{exactMatch.modelAndName || exactMatch.productName}</span>
                        {exactMatch.sku && (
                          <span className="font-mono text-indigo-400 font-semibold px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20 text-[11px]">
                            {exactMatch.sku}
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-slate-400">PMS Price:</span>
                        {Number(exactMatch.priceLKR || exactMatch.price) > 0 ? (
                          <span className="text-emerald-400 font-bold font-mono">
                            {formatLKR(exactMatch.priceLKR || exactMatch.price)}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium">Pending Quotation</span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-amber-300/80">
                        💡 <strong>Adding a variation?</strong> Modify the name slightly (e.g., adding model version, specs, or suffix) to create it as a new product request.
                      </p>
                    </div>
                  </div>
                )}
              </div>



              {/* SKU (Auto-generated / Read-only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-indigo-400" />
                    SKU
                  </span>
                  <span className="text-[10px] text-indigo-400 font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    Auto-generated
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={sku}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-indigo-400 cursor-not-allowed select-all focus:outline-none"
                  />
                  {isLoadingSku && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Sequential system SKU automatically assigned upon creation
                </p>
              </div>
            </div>

            {/* Product Category and Supplier Row (Supplier is Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Product Category */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Product Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddCatModalOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add new
                  </button>
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                >
                  <option value="">-- Select Product Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Supplier (Not Required / Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-400" />
                    Supplier <span className="text-[11px] text-slate-500 font-normal ml-1">(Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddSupModalOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add new
                  </button>
                </div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                >
                  <option value="">-- No Supplier (Unassigned) --</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity and Weight (KG) Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                    Quantity
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Default: 1
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>

              {/* Weight (KG) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5 text-slate-400" />
                    Weight (KG)
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Optional
                  </span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 0.0001 or 0.75"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Description
              </label>
              <textarea
                rows={2}
                placeholder="Product description, technical specifications, or package contents..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* Reference Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                Reference Link
              </label>
              <input
                type="url"
                placeholder="https://example.com/product-datasheet-or-url"
                value={referenceLink}
                onChange={(e) => setReferenceLink(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* Additional Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Additional Note
              </label>
              <textarea
                rows={3}
                placeholder="Any special notes, packing requirements, or specific requests..."
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
            </div>

            {/* Product Image at Bottom */}
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                Product Image
              </label>
              <ImageUpload
                value={imagePath}
                onChange={(url) => setImagePath(url)}
                disabled={isSubmitting}
              />
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <Link
                href="/products"
                className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Submit Product Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Add New Category Modal */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                Add New Product Category
              </h3>
              <button
                onClick={() => setIsAddCatModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryModalError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {categoryModalError}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Solar Panels & Arrays"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Once added, this category will immediately be available for all users.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCatModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  {isSavingCategory ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Create Category
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Supplier */}
      {isAddSupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                Add New Supplier
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSupModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {supplierModalError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {supplierModalError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Supplier Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Shenzhen PowMr Solar Ltd"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Once added, this supplier will immediately appear in the dropdown.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  {isSavingSupplier ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Create Supplier
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
