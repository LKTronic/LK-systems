"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { formatLKR } from "@/lib/formatters";
import { generateQuotationPdf, QuotationPdfItem } from "@/lib/quotationPdfGenerator";
import {
  FileText,
  Calendar,
  CreditCard,
  UserCheck,
  Building,
  Plus,
  Trash2,
  Download,
  Save,
  ArrowLeft,
  Search,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  Percent,
  Upload,
  Clipboard,
  ImagePlus,
  X,
} from "lucide-react";

interface ItemRow {
  id: string; // client-side unique id for key
  productId?: number | null;
  description: string;
  imagePath?: string | null;
  quantity: number;
  unitPrice: number;
}

interface ProductSearchResult {
  id: number;
  recordNo: string;
  productName: string;
  priceLKR: number | string | null;
  imagePath?: string | null;
}

export default function CreateQuotationPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Form Fields
  const [quotationNo, setQuotationNo] = useState("");
  const [preparedDate, setPreparedDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("FULL_PAYMENT"); // FULL_PAYMENT, CREDIT, ADVANCE_PAYMENT
  const [advancePercent, setAdvancePercent] = useState<number | string>(50);
  const [preparedBy, setPreparedBy] = useState("");
  const [quotationTo, setQuotationTo] = useState("");
  const [notes, setNotes] = useState("");

  // Items State
  const [items, setItems] = useState<ItemRow[]>([
    {
      id: "item-1",
      description: "",
      imagePath: null,
      quantity: 1,
      unitPrice: 0,
    },
  ]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Product Search Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Image Upload / Preview / Paste Modal State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [targetImageIndex, setTargetImageIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize dates and default quotation number
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    setPreparedDate(todayStr);

    const expiry = new Date();
    expiry.setDate(today.getDate() + 30);
    setExpireDate(expiry.toISOString().split("T")[0]);

    // Fetch next sequential quotation number
    fetch("/api/quotations/next-number")
      .then((res) => res.json())
      .then((data) => {
        if (data.nextQuotationNo) {
          setQuotationNo(data.nextQuotationNo);
        }
      })
      .catch(() => {
        const year = new Date().getFullYear();
        setQuotationNo(`QT-${year}-0001`);
      });
  }, []);

  // Auto-detect preparedBy from session
  useEffect(() => {
    if (session?.user) {
      const detected = session.user.name || (session.user as any).username || "Staff";
      setPreparedBy(detected);
    }
  }, [session]);

  // Calculations
  const subtotal = items.reduce((sum, item) => {
    const q = Math.max(0, Number(item.quantity) || 0);
    const p = Math.max(0, Number(item.unitPrice) || 0);
    return sum + q * p;
  }, 0);

  const numericAdvancePercent =
    paymentMethod === "ADVANCE_PAYMENT"
      ? Math.max(0, Math.min(100, Number(advancePercent) || 0))
      : 0;

  const advanceAmount =
    paymentMethod === "ADVANCE_PAYMENT" ? (subtotal * numericAdvancePercent) / 100 : 0;

  const balanceDue =
    paymentMethod === "ADVANCE_PAYMENT" ? subtotal - advanceAmount : 0;

  const grandTotal = subtotal;

  // Add Item Row
  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        description: "",
        imagePath: null,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  // Remove Item Row
  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage("At least one item is required in the quotation.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update Item Row Field
  const updateItemRow = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // --- IMAGE MODAL HANDLERS ---
  const openImageModal = (index: number) => {
    setTargetImageIndex(index);
    const currentPath = items[index]?.imagePath || null;
    setPreviewImage(currentPath);
    setImageUrlInput(currentPath || "");
    setImageUploadError(null);
    setIsImageModalOpen(true);
  };

  const handleImageFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingImage(true);
    setImageUploadError(null);

    // Instant local preview
    const localBlobUrl = URL.createObjectURL(file);
    setPreviewImage(localBlobUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Image upload failed");
      }

      setPreviewImage(data.url);
      setImageUrlInput(data.url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setImageUploadError(err.message || "Failed to upload image. Please try another image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Listen to Global Paste (Ctrl+V) when Image Modal is open
  useEffect(() => {
    if (!isImageModalOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFileUpload(file);
            return;
          }
        }
      }

      // If text was pasted, check if it's an image link
      const text = e.clipboardData.getData("text")?.trim();
      if (
        text &&
        (text.startsWith("http://") ||
          text.startsWith("https://") ||
          text.startsWith("/") ||
          text.startsWith("data:image/"))
      ) {
        setPreviewImage(text);
        setImageUrlInput(text);
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [isImageModalOpen]);

  const applyImageToRow = () => {
    if (targetImageIndex !== null) {
      updateItemRow(targetImageIndex, "imagePath", previewImage ? previewImage.trim() : null);
    }
    setIsImageModalOpen(false);
    setTargetImageIndex(null);
  };

  const removeImageFromRow = () => {
    if (targetImageIndex !== null) {
      updateItemRow(targetImageIndex, "imagePath", null);
    }
    setPreviewImage(null);
    setImageUrlInput("");
    setIsImageModalOpen(false);
    setTargetImageIndex(null);
  };

  // --- PRODUCT SEARCH (PMS Catalog) ---
  useEffect(() => {
    if (!isProductModalOpen) return;

    const timer = setTimeout(async () => {
      setIsSearchingProducts(true);
      try {
        const params = new URLSearchParams({
          limit: "15",
          search: productSearchQuery.trim(),
        });
        const res = await fetch(`/api/products?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
        }
      } catch (err) {
        console.error("Product search error:", err);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productSearchQuery, isProductModalOpen]);

  const handleSelectProduct = (product: ProductSearchResult) => {
    if (targetItemIndex === null) return;

    const price = Number(product.priceLKR) || 0;
    updateItemRow(targetItemIndex, "productId", product.id);
    updateItemRow(targetItemIndex, "description", product.productName);
    updateItemRow(targetItemIndex, "unitPrice", price);
    updateItemRow(targetItemIndex, "imagePath", product.imagePath || null);

    setIsProductModalOpen(false);
    setTargetItemIndex(null);
  };

  // Validate form
  const validateForm = () => {
    if (!quotationNo.trim()) {
      setErrorMessage("Please enter a quotation number.");
      return false;
    }
    if (!preparedDate) {
      setErrorMessage("Please select quotation prepared date.");
      return false;
    }
    if (!expireDate) {
      setErrorMessage("Please select quotation expiry date.");
      return false;
    }
    if (!quotationTo.trim()) {
      setErrorMessage("Please enter customer details in 'Quotation To'.");
      return false;
    }
    const hasValidItem = items.some(
      (item) => item.description.trim() !== "" && Number(item.unitPrice) >= 0
    );
    if (!hasValidItem) {
      setErrorMessage("Please enter description and unit price for at least one item.");
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  // Save quotation to Database
  const handleSaveQuotation = async () => {
    if (!validateForm()) return null;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        quotationNo: quotationNo.trim(),
        preparedDate,
        expireDate,
        paymentMethod,
        advancePercent: paymentMethod === "ADVANCE_PAYMENT" ? numericAdvancePercent : null,
        preparedBy: preparedBy.trim(),
        quotationTo: quotationTo.trim(),
        notes: notes.trim() || null,
        status: "ISSUED",
        items: items
          .filter((it) => it.description.trim() !== "")
          .map((it, idx) => ({
            itemIndex: idx + 1,
            productId: it.productId || null,
            description: it.description.trim(),
            imagePath: it.imagePath || null,
            quantity: Math.max(1, Number(it.quantity) || 1),
            unitPrice: Math.max(0, Number(it.unitPrice) || 0),
          })),
      };

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save quotation");
      }

      setSuccessMessage(`Quotation ${quotationNo} successfully created and saved!`);
      return data.quotation;
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while saving.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!validateForm()) return;

    setIsGeneratingPdf(true);
    try {
      const pdfItems: QuotationPdfItem[] = items
        .filter((it) => it.description.trim() !== "")
        .map((it, idx) => {
          const q = Math.max(1, Number(it.quantity) || 1);
          const p = Math.max(0, Number(it.unitPrice) || 0);
          return {
            itemIndex: idx + 1,
            description: it.description.trim(),
            imagePath: it.imagePath || null,
            quantity: q,
            unitPrice: p,
            totalPrice: q * p,
          };
        });

      await generateQuotationPdf({
        quotationNo: quotationNo.trim(),
        preparedDate,
        expireDate,
        paymentMethod,
        advancePercent: paymentMethod === "ADVANCE_PAYMENT" ? numericAdvancePercent : null,
        preparedBy: preparedBy.trim(),
        quotationTo: quotationTo.trim(),
        subtotal,
        totalAmount: grandTotal,
        notes: notes.trim() || null,
        items: pdfItems,
      });

      setSuccessMessage("PDF downloaded successfully!");
    } catch (err: any) {
      console.error("PDF generation error:", err);
      setErrorMessage("Failed to generate PDF. Please check details and try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <AppLayout
      title="Create Quotation"
      description="Create commercial quotations, calculate totals, and download branded PDFs"
    >
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Top Navigation & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <Link
            href="/quotations"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quotations List
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveQuotation}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <Save className="w-4 h-4 text-teal-400" />
              )}
              Save Quotation
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-md disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-red-900/30 border border-red-800/60 text-red-300 rounded-xl text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span className="flex-1">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-emerald-900/30 border border-emerald-800/60 text-emerald-300 rounded-xl text-sm animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="flex-1">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Quotation Info & Prepared By */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm border-b border-slate-800 pb-2">
              <FileText className="w-4 h-4" />
              Quotation Information
            </div>

            {/* Quotation Number */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Quotation Number <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={quotationNo}
                  onChange={(e) => setQuotationNo(e.target.value)}
                  placeholder="e.g. QT-2026-0001"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Auto-generated sequential number, editable by user.
              </p>
            </div>

            {/* Prepared By (Auto-detected) */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Prepared By</span>
                <span className="text-[11px] text-teal-400 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Auto-detected
                </span>
              </label>
              <input
                type="text"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="User / Staff Name"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Card 2: Dates (Prepared Date & Expiry Date) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm border-b border-slate-800 pb-2">
              <Calendar className="w-4 h-4" />
              Date Schedule
            </div>

            {/* Prepared Date */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Quotation Prepared Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={preparedDate}
                onChange={(e) => setPreparedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 [color-scheme:dark]"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Quotation Expiry Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Card 3: Payment Method */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm border-b border-slate-800 pb-2">
              <CreditCard className="w-4 h-4" />
              Payment Method & Terms
            </div>

            {/* Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Payment Method <span className="text-red-400">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              >
                <option value="FULL_PAYMENT">Full Payment</option>
                <option value="CREDIT">Credit</option>
                <option value="ADVANCE_PAYMENT">Advance Payment</option>
              </select>
            </div>

            {/* Advance Percentage Input (Conditional) */}
            {paymentMethod === "ADVANCE_PAYMENT" && (
              <div className="bg-teal-950/40 border border-teal-800/60 p-3 rounded-lg space-y-2 animate-in fade-in">
                <label className="block text-xs font-medium text-teal-300">
                  Advance Percentage (%) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={advancePercent}
                    onChange={(e) => setAdvancePercent(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full bg-slate-950 border border-teal-700/60 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 pr-8"
                  />
                  <Percent className="w-4 h-4 text-teal-400 absolute right-2.5 top-2.5" />
                </div>
                <div className="text-[11px] text-teal-200/80">
                  Advance Payable:{" "}
                  <span className="font-semibold text-white">
                    {formatLKR(advanceAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quotation To (Customer Details Multi-line Text Area) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-sm">
              <Building className="w-4 h-4" />
              Quotation To (Customer Details) <span className="text-red-400">*</span>
            </div>
            <span className="text-xs text-slate-500">Multiple Lines Supported</span>
          </div>

          <textarea
            rows={3}
            value={quotationTo}
            onChange={(e) => setQuotationTo(e.target.value)}
            placeholder={`Company / Customer Name\nAttention: Contact Person\nAddress / Street, City\nPhone: +94 XX XXX XXXX | Email: client@example.com`}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans"
          />
        </div>

        {/* Dynamic Items Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white text-base">Quotation Items</h3>
              <p className="text-xs text-slate-400">
                Add products or custom services with live auto-calculating total prices.
              </p>
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th className="py-3 px-3 w-24 text-center">Image</th>
                  <th className="py-3 px-4 min-w-[280px]">Product / Service</th>
                  <th className="py-3 px-3 w-28 text-center">Quantity</th>
                  <th className="py-3 px-4 w-36 text-right">Unit Price (LKR)</th>
                  <th className="py-3 px-4 w-40 text-right">Total Price (LKR)</th>
                  <th className="py-3 px-3 w-14 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {items.map((item, index) => {
                  const qty = Math.max(0, Number(item.quantity) || 0);
                  const price = Math.max(0, Number(item.unitPrice) || 0);
                  const lineTotal = qty * price;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* No */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                        {index + 1}
                      </td>

                      {/* Image Preview & Popup Trigger */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openImageModal(index)}
                            title="Click to view, upload, or paste image"
                            className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 hover:border-teal-500/80 transition-colors flex items-center justify-center overflow-hidden relative group/img cursor-pointer"
                          >
                            {item.imagePath ? (
                              <img
                                src={item.imagePath}
                                alt="Product"
                                className="w-full h-full object-contain p-1"
                                onError={(e) => {
                                  (e.target as any).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-600 group-hover/img:text-teal-400">
                                <ImagePlus className="w-5 h-5" />
                              </div>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openImageModal(index)}
                            className="text-[10px] text-teal-400 hover:underline cursor-pointer"
                          >
                            {item.imagePath ? "Change" : "+ Image"}
                          </button>
                        </div>
                      </td>

                      {/* Product / Service Description */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                updateItemRow(index, "description", e.target.value)
                              }
                              placeholder="Product or service description"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setTargetItemIndex(index);
                                setProductSearchQuery("");
                                setIsProductModalOpen(true);
                              }}
                              title="Pick from PMS inventory"
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
                            >
                              <Search className="w-3.5 h-3.5 text-teal-400" />
                              <span className="hidden sm:inline">Pick</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemRow(index, "quantity", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white text-center focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItemRow(index, "unitPrice", e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </td>

                      {/* Total Price (Auto-calculated) */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-white">
                        {formatLKR(lineTotal)}
                      </td>

                      {/* Remove Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          title="Remove item"
                          className="text-slate-500 hover:text-red-400 p-1 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-950/40 border-t border-slate-800 flex justify-between items-center">
            <button
              type="button"
              onClick={addItemRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another item row
            </button>
            <span className="text-xs text-slate-500">
              {items.length} {items.length === 1 ? "item" : "items"} in quotation
            </span>
          </div>
        </div>

        {/* Bottom Section: Notes & Live Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Notes Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
            <label className="block text-xs font-semibold text-teal-400 uppercase tracking-wider">
              Special Notes / Terms & Conditions
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1 Year Official Manufacturer Warranty. Delivery within 3 working days upon confirmation."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Full Amount Summary Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-semibold text-teal-400 uppercase tracking-wider border-b border-slate-800 pb-2">
              Quotation Summary & Totals
            </h4>

            {/* Subtotal */}
            <div className="flex justify-between items-center text-sm text-slate-300">
              <span>Subtotal Amount:</span>
              <span className="font-mono">{formatLKR(subtotal)}</span>
            </div>

            {/* Advance breakdown if applicable */}
            {paymentMethod === "ADVANCE_PAYMENT" && (
              <>
                <div className="flex justify-between items-center text-sm text-amber-400">
                  <span>Advance Payable ({numericAdvancePercent}%):</span>
                  <span className="font-mono font-medium">
                    {formatLKR(advanceAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-400">
                  <span>Balance Due on Delivery:</span>
                  <span className="font-mono">{formatLKR(balanceDue)}</span>
                </div>
              </>
            )}

            {/* Grand Total */}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-base font-bold text-white block">
                  Full Amount (Grand Total)
                </span>
                <span className="text-xs text-slate-400">
                  Payment Method: {paymentMethod.replace("_", " ")}
                </span>
              </div>
              <span className="text-xl font-bold font-mono text-teal-400">
                {formatLKR(grandTotal)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-md disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleSaveQuotation}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                ) : (
                  <Save className="w-4 h-4 text-teal-400" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- IMAGE PREVIEW, UPLOAD & CLIPBOARD PASTE POPUP MODAL --- */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <ImageIcon className="w-4 h-4 text-teal-400" />
                <span>
                  Product Image for Item #{(targetImageIndex ?? 0) + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Image Preview Box (Also Paste & Drag-and-Drop Zone) */}
              <div className="relative group rounded-xl border-2 border-dashed border-slate-700 hover:border-teal-500/70 bg-slate-950 flex flex-col items-center justify-center min-h-[220px] p-4 text-center transition-colors">
                {isUploadingImage ? (
                  <div className="flex flex-col items-center gap-2 text-teal-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-medium">Uploading & optimizing image...</span>
                  </div>
                ) : previewImage ? (
                  <div className="relative w-full flex flex-col items-center">
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="max-h-48 max-w-full object-contain rounded-lg shadow-sm"
                      onError={() => {
                        setImageUploadError("Unable to load image from the provided URL / path.");
                      }}
                    />
                    <div className="mt-2 text-[11px] text-slate-400 font-mono break-all line-clamp-1 max-w-sm">
                      {previewImage}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-400">
                      <Clipboard className="w-6 h-6 text-teal-400" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">
                      Paste image directly from clipboard (<span className="text-teal-400 font-mono">Ctrl + V</span>)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      or click the upload button below to select from your computer
                    </p>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {imageUploadError && (
                <div className="text-xs p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="flex-1">{imageUploadError}</span>
                </div>
              )}

              {/* Upload Button & File Input */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFileUpload(file);
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-teal-400" />
                  Upload from Computer
                </button>
              </div>

              {/* Or Web / Local URL Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-400">
                  Or Paste Image URL / Path:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => {
                      setImageUrlInput(e.target.value);
                      setPreviewImage(e.target.value.trim() || null);
                    }}
                    placeholder="https://... or /uploads/products/..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewImage(imageUrlInput.trim() || null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
                <span className="text-teal-400 font-semibold">Tip:</span>
                <span>
                  Capture any area with Windows Snipping Tool (<span className="text-slate-300 font-mono">Win+Shift+S</span>) and press <span className="text-slate-300 font-mono">Ctrl+V</span> here to paste instantly.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                {previewImage && (
                  <button
                    type="button"
                    onClick={removeImageFromRow}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Image
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={applyImageToRow}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
                >
                  Apply Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PRODUCT SEARCH MODAL (PMS CATALOG) --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Package className="w-5 h-5 text-teal-400" />
                Select Product from Inventory
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg px-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Search Input */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  autoFocus
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Search product name, SKU, or record number..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Modal Results List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/60">
              {isSearchingProducts ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                  <span className="text-xs">Searching inventory...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No products found matching &quot;{productSearchQuery}&quot;.
                </div>
              ) : (
                searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="py-2.5 px-3 hover:bg-slate-800/60 rounded-lg cursor-pointer flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {product.imagePath ? (
                          <img
                            src={product.imagePath}
                            alt=""
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm line-clamp-1">
                          {product.productName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {product.recordNo}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-semibold text-teal-400 text-sm">
                        {formatLKR(Number(product.priceLKR) || 0)}
                      </div>
                      <span className="text-[10px] text-slate-500">Click to Select</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-right">
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
