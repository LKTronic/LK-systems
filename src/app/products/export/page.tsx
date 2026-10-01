"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import {
  Download,
  Calendar,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Package,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ExcelExportPage() {
  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [isExporting, setIsExporting] = useState(false);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  // Generate range of years (e.g., current year - 5 to current year + 2)
  const availableYears = Array.from({ length: 8 }, (_, i) => (currentYear - 5 + i).toString());

  // Check matching product count whenever date filters change
  useEffect(() => {
    async function checkCount() {
      setIsLoadingCount(true);
      try {
        const params = new URLSearchParams({ limit: "1", status: "ACTIVE" });
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const res = await fetch(`/api/products?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setMatchingCount(data.pagination?.total ?? 0);
        }
      } catch (err) {
        console.error("Failed to check count:", err);
      } finally {
        setIsLoadingCount(false);
      }
    }

    const timer = setTimeout(checkCount, 300);
    return () => clearTimeout(timer);
  }, [fromDate, toDate]);

  // Handle Month + Year selection preset
  const handleMonthYearChange = (monthIdxStr: string, yearStr: string) => {
    setSelectedMonth(monthIdxStr);
    setSelectedYear(yearStr);

    if (monthIdxStr === "") {
      // Full year selected
      const y = parseInt(yearStr, 10);
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-12-31`);
      return;
    }

    const monthIdx = parseInt(monthIdxStr, 10);
    const y = parseInt(yearStr, 10);
    const firstDay = new Date(y, monthIdx, 1);
    const lastDay = new Date(y, monthIdx + 1, 0);

    const pad = (n: number) => n.toString().padStart(2, "0");
    setFromDate(`${y}-${pad(monthIdx + 1)}-01`);
    setToDate(`${y}-${pad(monthIdx + 1)}-${pad(lastDay.getDate())}`);
  };

  // Quick Preset Handlers
  const applyPreset = (preset: "this-month" | "last-month" | "this-year" | "all") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => n.toString().padStart(2, "0");

    if (preset === "this-month") {
      const lastDay = new Date(y, m + 1, 0).getDate();
      setFromDate(`${y}-${pad(m + 1)}-01`);
      setToDate(`${y}-${pad(m + 1)}-${pad(lastDay)}`);
      setSelectedMonth(m.toString());
      setSelectedYear(y.toString());
    } else if (preset === "last-month") {
      const prevMonth = m === 0 ? 11 : m - 1;
      const prevYear = m === 0 ? y - 1 : y;
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      setFromDate(`${prevYear}-${pad(prevMonth + 1)}-01`);
      setToDate(`${prevYear}-${pad(prevMonth + 1)}-${pad(lastDay)}`);
      setSelectedMonth(prevMonth.toString());
      setSelectedYear(prevYear.toString());
    } else if (preset === "this-year") {
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-12-31`);
      setSelectedMonth("");
      setSelectedYear(y.toString());
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
      setSelectedMonth("");
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const res = await fetch(`/api/products/export?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products_export_${fromDate || "all"}_to_${toDate || "now"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export Excel file. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout
      title="Export Products to Excel"
      description="Generate formatted .xlsx reports with calendar date, month, and year filtering"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Export Catalog to Excel (.xlsx)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Download formatted spreadsheet with Record Numbers, SKUs, and pricing
              </p>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Quick Date Range Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset("this-month")}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all text-center"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset("last-month")}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all text-center"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this-year")}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all text-center"
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => applyPreset("all")}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all text-center"
              >
                All Products
              </button>
            </div>
          </div>

          {/* Month & Year Selectors */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Select Month & Year
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthYearChange(e.target.value, selectedYear)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Full Year (All Months)</option>
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx.toString()}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleMonthYearChange(selectedMonth, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Explicit Custom Date Pickers */}
          <form onSubmit={handleExport} className="space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Custom Date Range (From - To)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setSelectedMonth("");
                    }}
                    disabled={isExporting}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setSelectedMonth("");
                    }}
                    disabled={isExporting}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Live Count Indicator */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Package className="w-4 h-4 text-indigo-400" />
                <span>Matching Active Products to Export:</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">
                {isLoadingCount ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <span className="text-emerald-400">{matchingCount ?? 0} products</span>
                )}
              </div>
            </div>

            {/* Privacy Compliance Notice */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center gap-2 font-semibold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Strict User Privacy Rule Enforced</span>
              </div>
              <p>
                The exported Excel spreadsheet contains: Record No, Product Name, SKU, Date, Price, and Image.
              </p>
              <p className="text-slate-500">
                User Names, Created By, User IDs, and internal accounts are strictly excluded.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isExporting || matchingCount === 0}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Excel File...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Excel Spreadsheet ({matchingCount ?? 0} records)
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
