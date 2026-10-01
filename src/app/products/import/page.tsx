"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Loader2,
  Check,
  X,
  FileCheck,
  ShieldCheck,
} from "lucide-react";

interface ValidationRow {
  rowNumber: number;
  productName: string;
  sku: string;
  productDate: string;
  price: number;
  imagePath?: string;
  status: "NEW" | "DUPLICATE" | "INVALID" | "WARNING";
  errors: string[];
}

interface ImportSummary {
  totalRows: number;
  valid: number;
  duplicates: number;
  invalid: number;
}

export default function ExcelImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewSummary, setPreviewSummary] = useState<ImportSummary | null>(null);
  const [previewRows, setPreviewRows] = useState<ValidationRow[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Please select a valid Excel file (.xlsx)");
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccessMessage(null);
    setPreviewSummary(null);
    setPreviewRows([]);

    // Automatically trigger dry-run preview analysis
    runDryRunPreview(file);
  };

  const runDryRunPreview = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "true");

      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze Excel file");
      }

      setPreviewSummary(data.summary);
      setPreviewRows(data.rows || []);
    } catch (err: any) {
      setError(err.message || "Failed to process Excel file.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("dryRun", "false");

      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setSuccessMessage(data.message || "Products imported successfully!");
      setPreviewSummary(null);
      setPreviewRows([]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err.message || "Failed to import products.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewSummary(null);
    setPreviewRows([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout
      title="Import Products via Excel"
      description="Batch import products with automated duplicate detection, header mapping, and preview verification"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-sm">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-emerald-400 text-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <Link
              href="/products"
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 transition-colors"
            >
              View in Catalog
            </Link>
          </div>
        )}

        {/* Upload Zone */}
        {!previewSummary && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Click to upload Excel spreadsheet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Supports .xlsx files with columns: Product Name, SKU, Date, Price, and optional Image
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-left text-xs text-slate-400 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Header Flexibility
                </h5>
                <p>
                  Column headers are case-insensitive. Spaces and casing (e.g. "product name", "ProductName", "SKU") are automatically mapped.
                </p>
              </div>
              <div>
                <h5 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Privacy Guaranteed
                </h5>
                <p>
                  Any User columns in the Excel file are automatically ignored. The authenticated user performing the import is linked internally.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator during analysis */}
        {isAnalyzing && (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">Analyzing Excel File & Detecting Duplicates...</p>
            <p className="text-xs text-slate-400 mt-1">
              Checking database uniqueness and verifying row schemas
            </p>
          </div>
        )}

        {/* Import Preview Section */}
        {previewSummary && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Rows</span>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {previewSummary.totalRows}
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs text-emerald-400 font-semibold uppercase">Valid (NEW)</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {previewSummary.valid}
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs text-amber-400 font-semibold uppercase">Duplicates</span>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  {previewSummary.duplicates}
                </div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs text-rose-400 font-semibold uppercase">Invalid</span>
                <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                  {previewSummary.invalid}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="text-xs text-slate-400">
                <span>File: <strong className="text-slate-200">{selectedFile?.name}</strong></span>
                <span className="mx-2">•</span>
                <span>Only <strong className="text-emerald-400">{previewSummary.valid} valid products</strong> will be imported.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancel}
                  disabled={isImporting}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting || previewSummary.valid === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing Products...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Import {previewSummary.valid} Valid Products
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Validation Rows Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 font-bold text-sm text-white">
                Row-by-Row Verification Preview
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Row #</th>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4">Price (LKR)</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Details / Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {previewRows.map((r, i) => (
                      <tr
                        key={i}
                        className={
                          r.status === "NEW"
                            ? "hover:bg-slate-800/40"
                            : r.status === "DUPLICATE"
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : "bg-rose-500/5 hover:bg-rose-500/10"
                        }
                      >
                        <td className="py-2.5 px-4 font-mono text-slate-400">
                          {r.rowNumber}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-200">
                          {r.productName || "(Empty)"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">
                          {r.sku || "(Empty)"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">
                          {r.price.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                              r.status === "NEW"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : r.status === "DUPLICATE"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">
                          {r.errors && r.errors.length > 0 ? (
                            <span className="text-rose-400">{r.errors.join(", ")}</span>
                          ) : (
                            <span className="text-emerald-400">Ready to import</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
