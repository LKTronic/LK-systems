"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { ImageUpload } from "@/components/ImageUpload";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Hash,
  Calendar,
  Tag,
  Weight,
  Link as LinkIcon,
  FileText,
  Boxes,
  Plus,
  X,
  Truck,
  Barcode,
} from "lucide-react";

interface Category {
  id: number;
  name: string;
}

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [referenceNo, setReferenceNo] = useState("");
  const [modelAndName, setModelAndName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [productDate, setProductDate] = useState("");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [status, setStatus] = useState("PENDING");

  // Categories & Suppliers
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`/api/products/${resolvedParams.id}`);
        if (!res.ok) throw new Error("Failed to load product");
        const data = await res.json();

        setReferenceNo(data.referenceNo || data.recordNo || "");
        setModelAndName(data.modelAndName || data.productName || "");
        setSku(data.sku || "");
        setCategoryId(data.categoryId || "");
        setSupplierId(data.supplierId || "");
        setProductDate(
          data.productDate
            ? new Date(data.productDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
        );
        setPrice(data.priceLKR ? data.priceLKR.toString() : data.price ? data.price.toString() : "0");
        setQuantity(data.quantity ? data.quantity.toString() : "1");
        setWeight(data.weight ? data.weight.toString() : "");
        setDescription(data.description || "");
        setReferenceLink(data.referenceLink || "");
        setAdditionalNote(data.additionalNote || "");
        setImagePath(data.imagePath || null);
        setStatus(data.status || "PENDING");
      } catch (err: any) {
        setError(err.message || "Error loading product");
      } finally {
        setIsLoading(false);
      }
    }
    loadProduct();
  }, [resolvedParams.id]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    setIsSavingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchCategories();
        if (data.category?.id) setCategoryId(data.category.id);
        setNewCatName("");
        setIsAddCatModalOpen(false);
      }
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedModel = modelAndName.trim();
    const numericPrice = parseFloat(price);
    const parsedWeight = weight ? parseFloat(weight) : null;

    if (!trimmedModel) {
      setError("Model no and name is required.");
      return;
    }
    if (isNaN(numericPrice) || numericPrice < 0) {
      setError("Price must be a valid non-negative number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/products/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelAndName: trimmedModel,
          sku: sku.trim() || null,
          categoryId: categoryId ? Number(categoryId) : null,
          supplierId: supplierId ? Number(supplierId) : null,
          productDate: productDate ? new Date(productDate).toISOString() : new Date().toISOString(),
          priceLKR: numericPrice,
          quantity: quantity ? parseInt(quantity, 10) : 1,
          weight: parsedWeight,
          description: description.trim() || null,
          referenceLink: referenceLink.trim() || null,
          additionalNote: additionalNote.trim() || null,
          imagePath,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update product");
      } else {
        router.push(`/products/${resolvedParams.id}`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Edit Product"
      description="Update specifications, status, and pricing details"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/products/${resolvedParams.id}`}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Details
          </Link>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-400" />
                Edit Product Specifications
              </span>
              {sku && (
                <span className="text-xs font-mono font-medium text-slate-400 px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
                  SKU: {sku}
                </span>
              )}
            </h2>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Model no and name (Required) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Model no and name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modelAndName}
                    onChange={(e) => setModelAndName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* SKU (Auto-assigned / Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Barcode className="w-3.5 h-3.5 text-indigo-400" />
                      SKU
                    </span>
                    <span className="text-[10px] text-indigo-400 font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                      System SKU
                    </span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={sku || "—"}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-indigo-400 cursor-not-allowed select-all focus:outline-none"
                  />
                </div>
              </div>

              {/* Status and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Product Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="NOT_REQUESTED">Not Requested</option>
                    <option value="QUOTED">Quoted</option>
                    <option value="PRICE_NOT_AVAILABLE">Price Not Available</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Product Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddCatModalOpen(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add new
                    </button>
                  </div>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Uncategorized --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier (Optional) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-400" />
                    Supplier <span className="text-[11px] text-slate-500 font-normal ml-1">(Optional)</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- No Supplier (Unassigned) --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price (LKR), Quantity, and Weight (KG) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Price (LKR) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Price (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    0.00 = Not Available
                  </span>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Weight (KG) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5 text-slate-400" />
                    Weight (KG)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="e.g. 0.0001 or 0.75"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Brief Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Brief Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Reference Link & Additional Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Reference Link
                  </label>
                  <input
                    type="url"
                    value={referenceLink}
                    onChange={(e) => setReferenceLink(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Additional Note
                  </label>
                  <input
                    type="text"
                    value={additionalNote}
                    onChange={(e) => setAdditionalNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Product Image
                </label>
                <ImageUpload
                  value={imagePath}
                  onChange={(url) => setImagePath(url)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <Link
                  href={`/products/${resolvedParams.id}`}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Add New Category Modal */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                Add New Category
              </h3>
              <button
                onClick={() => setIsAddCatModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Inverters & Chargers"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCatModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {isSavingCategory ? "Saving..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
