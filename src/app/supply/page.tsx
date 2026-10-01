"use client";

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatLKR, formatDateDMY } from "@/lib/formatters";
import {
  Truck,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Loader2,
  RefreshCw,
  Building2,
  FileCheck,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  X,
  Download,
  Eye,
  Info,
} from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  contactInfo?: string | null;
  notes?: string | null;
  _count?: { products: number };
}

interface ValidationRow {
  rowNumber: number;
  referenceNo: string;
  modelAndName: string;
  price: number;
  priceLKR: number;
  priceUSD?: number | null;
  currency?: "USD" | "LKR";
  isPriceZero: boolean;
  warrantyPeriod: string;
  priceValidity: string;
  leadTime: string;
  isBrandNewOriginal: string;
  supplierImage: string;
  supplierNote: string;
  matchedProductId?: number;
  currentStatus?: string;
  status: "VALID" | "PRICE_NOT_AVAILABLE" | "INVALID" | "NOT_FOUND";
  errors: string[];
}

interface PreviewSummary {
  totalRows: number;
  validCount: number;
  notAvailableCount: number;
  errorCount: number;
}

export default function SupplyPage() {
  // Suppliers list
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);

  // Add Supplier Modal
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");
  const [newSupplierNotes, setNewSupplierNotes] = useState("");
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState<string | null>(null);

  // Example Excel Template Modal & Download
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Preview Data
  const [previewRows, setPreviewRows] = useState<ValidationRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to Quotation Preview & Validation Status when validation completes
  useEffect(() => {
    if (previewRows.length > 0) {
      const timer = setTimeout(() => {
        previewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [previewRows]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const res = await fetch("/api/supply/template");
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PMS_Supplier_Quotation_Example_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Failed to download example template");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSupplierName.trim();
    if (!name) return;

    setIsSavingSupplier(true);
    setSupplierModalError(null);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactInfo: newSupplierContact.trim() || undefined,
          notes: newSupplierNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSupplierModalError(data.error || "Failed to create supplier");
      } else {
        await fetchSuppliers();
        if (data.supplier?.id) {
          setSelectedSupplierId(data.supplier.id.toString());
        }
        setNewSupplierName("");
        setNewSupplierContact("");
        setNewSupplierNotes("");
        setIsAddSupplierModalOpen(false);
      }
    } catch (err: any) {
      setSupplierModalError(err.message || "Network error");
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith(".xlsx")) {
      setUploadError("Only Excel .xlsx files are supported.");
      return;
    }

    setFile(selected);
    setUploadError(null);
    setSuccessMessage(null);
    setPreviewRows([]);
    setPreviewSummary(null);
  };

  // Step 1: Validate & Dry Run Preview
  const handleValidatePreview = async () => {
    if (!selectedSupplierId) {
      setUploadError("Please select a supplier before validating.");
      return;
    }
    if (!file) {
      setUploadError("Please choose an Excel file to upload.");
      return;
    }

    setIsValidating(true);
    setUploadError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", selectedSupplierId);
      formData.append("dryRun", "true");

      const res = await fetch("/api/supply/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Validation failed.");
        if (data.rows) setPreviewRows(data.rows);
        if (data.summary) setPreviewSummary(data.summary);
      } else {
        setPreviewRows(data.rows || []);
        setPreviewSummary(data.summary || null);
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to validate supplier sheet.");
    } finally {
      setIsValidating(false);
    }
  };

  // Step 2: Commit Updates to Database
  const handleCommitUpdate = async () => {
    if (!selectedSupplierId || !file) return;

    setIsCommitting(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", selectedSupplierId);
      formData.append("dryRun", "false");

      const res = await fetch("/api/supply/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to update products.");
      } else {
        setSuccessMessage(
          `Success: ${data.message || `Updated ${data.updatedCount} products.`}`
        );
        setFile(null);
        setPreviewRows([]);
        setPreviewSummary(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchSuppliers();
      }
    } catch (err: any) {
      setUploadError(err.message || "Network error while saving.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <AppLayout
      title="Supply Management"
      description="Select suppliers, upload completed quotation sheets in USD/LKR, and update product pricing"
    >
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Top Info Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-100 via-indigo-50/50 to-slate-100 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Supplier Sheet Upload & Automated Pricing
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              Upload the returned supplier sheet. The system validates USD or LKR prices, updates product statuses, warranty periods, preparation lead times, and flags zero-price entries as &quot;Price Not Available&quot;.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsExampleModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-300 dark:border-slate-700 shadow-sm transition-all"
              title="View the example Excel format with sample columns"
            >
              <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              View Example Format
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all"
              title="Upload supplier sheet Excel file (.xlsx)"
            >
              <Upload className="w-4 h-4" />
              Import Excel
            </button>
          </div>
        </div>

        {/* Upload Configuration Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Step 1: Select Supplier & Upload Sheet
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supplier Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Select the Supplier <span className="text-rose-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add new
                </button>
              </div>

              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setUploadError(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              >
                <option value="">-- Choose Supplier (e.g. DAN, Grace, Rainy) --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s._count ? `(${s._count.products} products quoted)` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Ensure the correct supplier is chosen before proceeding with sheet import.
              </p>
            </div>

            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Completed Supplier Excel File (.xlsx) <span className="text-rose-400">*</span>
              </label>

              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950/60 relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-200">
                  {file ? file.name : "Click or drag & drop supplier .xlsx file here"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB`
                    : "Sheet containing Price in USD or LKR without shipping"}
                </p>
              </div>

              {/* Quick link to view example modal */}
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[11px] text-slate-500">
                  Unsure of the format?
                </span>
                <button
                  type="button"
                  onClick={() => setIsExampleModalOpen(true)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View example format & download template
                </button>
              </div>
            </div>
          </div>

          {/* Validation Notice Rules */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Automated Validation Rules Applied:
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-400">
              <li>Requires valid <span className="text-slate-200 font-mono">Product name</span> (or Reference Number / SKU) to match existing PMS products.</li>
              <li>Product status must be <span className="text-amber-400 font-semibold">Pending</span> or <span className="text-rose-400 font-semibold">Expired</span>. Active products with valid prices cannot be updated (request price first).</li>
              <li>Price column must be numeric in <span className="text-slate-200 font-semibold">LKR</span> without shipping charges.</li>
              <li>Includes <span className="text-slate-200 font-mono">Quantity</span> as Column C between Description and Image (13 standard columns).</li>
              <li>If Price is <span className="text-amber-400 font-mono font-bold">0</span> or <span className="text-amber-400 font-mono font-bold">00</span>: updates status as <span className="text-rose-400 font-semibold">&quot;Price Not Available&quot;</span> while still updating lead time and notes.</li>
              <li>Required columns cannot be empty (except optional Supplier Note and Supplier Image).</li>
            </ul>
          </div>

          {/* Upload and Validate Action */}
          <div className="flex items-center justify-between pt-2">
            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                disabled={isValidating || !file || !selectedSupplierId}
                onClick={handleValidatePreview}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating Excel Sheet...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Validate & Preview Sheet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Validation Preview Results Table */}
        {previewRows.length > 0 && (
          <div
            ref={previewSectionRef}
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 animate-in fade-in scroll-mt-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  Quotation Preview & Validation Status
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review matched products and prices before updating the database.
                </p>
              </div>

              {previewSummary && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                    Total: {previewSummary.totalRows}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Quoted: {previewSummary.validCount}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                    Price 0 (Not Available): {previewSummary.notAvailableCount}
                  </span>
                  {previewSummary.errorCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 font-semibold border border-rose-500/20">
                      Errors: {previewSummary.errorCount}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-3">Row</th>
                    <th className="px-4 py-3">Ref No / SKU</th>
                    <th className="px-4 py-3">Model No & Name</th>
                    <th className="px-4 py-3 text-right">Quoted Price</th>
                    <th className="px-3 py-3">Warranty</th>
                    <th className="px-3 py-3">Lead Time</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Validation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {previewRows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={
                        r.status === "INVALID" || r.status === "NOT_FOUND"
                          ? "bg-rose-950/20 hover:bg-rose-950/30"
                          : r.status === "PRICE_NOT_AVAILABLE"
                          ? "bg-amber-950/10 hover:bg-amber-950/20"
                          : "hover:bg-slate-800/40"
                      }
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-500">
                        #{r.rowNumber}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-indigo-400">
                        {r.referenceNo || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-white max-w-[200px] truncate">
                        {r.modelAndName || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {r.isPriceZero ? (
                          <span className="text-amber-400 font-mono">0.00 (N/A)</span>
                        ) : r.currency === "USD" || r.priceUSD ? (
                          <span className="text-emerald-400 font-mono font-bold">
                            ${Number(r.priceUSD ?? r.price ?? r.priceLKR).toFixed(2)} USD
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-mono font-bold">
                            {formatLKR(r.priceLKR || r.price || 0)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {r.warrantyPeriod || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        {r.leadTime || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.status === "VALID" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Valid (Quoted)
                          </span>
                        ) : r.status === "PRICE_NOT_AVAILABLE" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Price Not Available
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                        {r.errors.length > 0 ? (
                          <span className="text-rose-400 font-medium">
                            {r.errors.join(", ")}
                          </span>
                        ) : r.isPriceZero ? (
                          <span className="text-amber-400/90">
                            Will mark as Price Not Available & save details
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Matches product #{r.matchedProductId}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Commit Button */}
            <div className="pt-2 flex items-center justify-between">
              {previewSummary && previewSummary.errorCount > 0 ? (
                <div className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Spreadsheet has {previewSummary.errorCount} error(s). Please fix the rows above before updating.
                </div>
              ) : (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  All rows validated successfully. Ready to update products.
                </div>
              )}

              <button
                type="button"
                disabled={isCommitting || (previewSummary ? previewSummary.errorCount > 0 : false)}
                onClick={handleCommitUpdate}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all ml-auto"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating Database...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Confirm & Update Database
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add New Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                Add New Supplier
              </h3>
              <button
                onClick={() => setIsAddSupplierModalOpen(false)}
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
                  Supplier Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. DAN, Grace, Rainy, or Nova Suppliers"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contact Information (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Email, phone, or WeChat ID"
                  value={newSupplierContact}
                  onChange={(e) => setNewSupplierContact(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Supplier Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Lead times, payment terms, or remarks"
                  value={newSupplierNotes}
                  onChange={(e) => setNewSupplierNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
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
                      Add Supplier
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Example Excel Format Modal */}
      {isExampleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Supplier Excel Sheet Format & Example
                  </h3>
                  <p className="text-xs text-slate-400">
                    Expected structure for uploading quotes. 12 columns total (without Quantity).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-xs font-bold transition-all shadow-sm"
                >
                  {isDownloadingTemplate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download .xlsx
                </button>
                <button
                  type="button"
                  onClick={() => setIsExampleModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Notice Banners Preview (Row 2 & 3) */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Top Header Banners (Rows 2 & 3 in Excel):
                </div>
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 text-center text-xs font-bold text-indigo-200">
                  Row 2: Shipping costs are not required to be included, as we have our own freight forwarders in China.
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-2.5 text-center text-xs font-semibold text-slate-300">
                  Row 3: Kindly ensure that all details are confirmed
                </div>
              </div>

              {/* Table Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Columns & Sample Data (Starting at Row 5):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Scroll horizontally to inspect all 13 columns
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/90 shadow-inner">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead>
                      <tr className="bg-slate-800 text-slate-200 border-b border-slate-700">
                        <th className="p-2.5 border-r border-slate-700 font-mono text-[10px] text-slate-400 text-center w-10">
                          Col
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold">
                          A: Product name
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold">
                          B: Description
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          C: Quantity
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          D: Image
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold">
                          E: Refrence link if available
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          F: Weight
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold bg-amber-300 text-slate-950 text-center">
                          <div>G: Price (LKR)</div>
                          <div className="text-[10px] text-rose-700 font-extrabold">without shipping chargers</div>
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          H: Warranty Period
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          <div>I: Price validity</div>
                          <div className="text-[10px] text-rose-400 font-medium">(min 30 days)</div>
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          J: Package preparation lead time
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          K: Brand new & original?
                        </th>
                        <th className="p-2.5 border-r border-slate-700 font-bold text-center">
                          L: Supplier image
                        </th>
                        <th className="p-2.5 font-bold">
                          M: Supplier special note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {/* Sample Row 1: Valid Quoted Item */}
                      <tr className="hover:bg-slate-900/60">
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono text-slate-500 text-[10px]">
                          6
                        </td>
                        <td className="p-2.5 border-r border-slate-800 font-bold text-white whitespace-nowrap">
                          STM32F407VGT6 Microcontroller LQFP-100
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-slate-400 max-w-[200px] truncate">
                          Original ARM Cortex-M4 32-bit MCU+FPU, 168MHz
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono font-bold text-white">
                          50
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          [Image]
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-indigo-400 max-w-[150px] truncate underline">
                          https://st.com/stm32f407
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono">
                          0.02
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono font-bold bg-amber-300/20 text-amber-300">
                          LKR 1,450.00
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center">
                          1 Year
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center">
                          30 Days
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center">
                          1-2 Days
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-semibold text-emerald-400">
                          Yes
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          —
                        </td>
                        <td className="p-2.5 text-slate-300">
                          Brand new original in tape & reel
                        </td>
                      </tr>

                      {/* Sample Row 2: Price Not Available item */}
                      <tr className="hover:bg-slate-900/60 bg-amber-950/10">
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono text-slate-500 text-[10px]">
                          7
                        </td>
                        <td className="p-2.5 border-r border-slate-800 font-bold text-white whitespace-nowrap">
                          ATmega328P-PU DIP-28 Microchip
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-slate-400 max-w-[200px] truncate">
                          8-bit AVR Microcontroller with 32K Flash
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono font-bold text-white">
                          25
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          [Image]
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-indigo-400 max-w-[150px] truncate underline">
                          https://microchip.com/atmega328p
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono">
                          0.01
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono font-bold bg-amber-300/20 text-rose-400">
                          0 (N/A)
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          —
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          —
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          —
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-semibold text-emerald-400">
                          Yes
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          —
                        </td>
                        <td className="p-2.5 text-amber-400/90 text-[11px]">
                          Temporarily out of stock (marks as &quot;Price Not Available&quot;)
                        </td>
                      </tr>

                      {/* Sample Row 3 */}
                      <tr className="hover:bg-slate-900/60">
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono text-slate-500 text-[10px]">
                          8
                        </td>
                        <td className="p-2.5 border-r border-slate-800 font-bold text-white whitespace-nowrap">
                          ESP32-WROOM-32D Wi-Fi + Bluetooth Module
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-slate-400 max-w-[200px] truncate">
                          Dual-core ESP32 4MB SPI flash PCB antenna
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono font-bold text-white">
                          100
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          [Image]
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-indigo-400 max-w-[150px] truncate underline">
                          https://espressif.com/esp32
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono">
                          0.05
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-mono font-bold bg-amber-300/20 text-amber-300">
                          LKR 810.00
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center">
                          6 Months
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center">
                          45 Days
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center">
                          2-3 Days
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center font-semibold text-emerald-400">
                          Yes
                        </td>
                        <td className="p-2.5 border-r border-slate-800 text-center text-slate-500">
                          —
                        </td>
                        <td className="p-2.5 text-slate-300">
                          Factory sealed, prompt delivery
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Helpful Guidelines */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" />
                  Key Guidelines for Suppliers & Team:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-400 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                    <span>
                      <strong className="text-slate-200">13 Standard Columns:</strong> The sheet contains exactly 13 columns from Col A to Col M, including Quantity in Column C between Description and Image.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                    <span>
                      <strong className="text-slate-200">Price in LKR (Col G):</strong> Must be numeric in LKR without shipping charges. The price column is updated and saved directly in LKR.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1 shrink-0" />
                    <span>
                      <strong className="text-slate-200">Handling 0 Price:</strong> Entering 0 or 00 will flag the item as &quot;Price Not Available&quot; while saving lead times and notes.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 shrink-0" />
                    <span>
                      <strong className="text-slate-200">Product Matching:</strong> Product name, Reference No, or SKU in Column A must correspond to existing PMS items.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                You can download the template, fill in quotes, and upload it back directly.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsExampleModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                >
                  {isDownloadingTemplate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download Example Template (.xlsx)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
