"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { formatLKR, formatDateDMY } from "@/lib/formatters";
import { generateQuotationPdf, QuotationPdfItem } from "@/lib/quotationPdfGenerator";
import {
  FileText,
  Plus,
  Search,
  Download,
  Trash2,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Filter,
  Pencil,
} from "lucide-react";

interface Quotation {
  id: number;
  quotationNo: string;
  preparedDate: string;
  expireDate: string;
  paymentMethod: string;
  advancePercent?: number | null;
  quotationTo: string;
  preparedBy: string;
  subtotal: number | string;
  totalAmount: number | string;
  notes?: string | null;
  status: string;
  createdAt: string;
  items: Array<{
    id: number;
    itemIndex: number;
    description: string;
    imagePath?: string | null;
    quantity: number;
    unitPrice: number | string;
    totalPrice: number | string;
  }>;
}

export default function QuotationsListPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (paymentMethod !== "ALL") params.append("paymentMethod", paymentMethod);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      params.append("limit", "50");

      const res = await fetch(`/api/quotations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuotations(data.quotations || []);
      }
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, paymentMethod, statusFilter]);

  const handleDownloadPdf = async (q: Quotation) => {
    setDownloadingId(q.id);
    try {
      const pdfItems: QuotationPdfItem[] = (q.items || []).map((it, idx) => ({
        itemIndex: it.itemIndex || idx + 1,
        description: it.description,
        imagePath: it.imagePath || null,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || 0,
      }));

      const prepDateStr =
        typeof q.preparedDate === "string"
          ? q.preparedDate.split("T")[0]
          : new Date(q.preparedDate).toISOString().split("T")[0];

      const expDateStr =
        typeof q.expireDate === "string"
          ? q.expireDate.split("T")[0]
          : new Date(q.expireDate).toISOString().split("T")[0];

      await generateQuotationPdf({
        quotationNo: q.quotationNo,
        preparedDate: prepDateStr,
        expireDate: expDateStr,
        paymentMethod: q.paymentMethod,
        advancePercent: q.advancePercent ? Number(q.advancePercent) : null,
        preparedBy: q.preparedBy,
        quotationTo: q.quotationTo,
        subtotal: Number(q.subtotal) || 0,
        totalAmount: Number(q.totalAmount) || 0,
        notes: q.notes || null,
        items: pdfItems,
      });

      setMessage({ type: "success", text: `Downloaded ${q.quotationNo}.pdf` });
    } catch (err) {
      console.error("PDF download error:", err);
      setMessage({ type: "error", text: "Failed to download PDF" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: number, qNo: string) => {
    if (!confirm(`Are you sure you want to delete quotation "${qNo}"?`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuotations((prev) => prev.filter((q) => q.id !== id));
        setMessage({ type: "success", text: `Quotation ${qNo} deleted.` });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete quotation" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout
      title="Commercial Quotations"
      description="Manage business quotations, generate branded PDFs, and track customer proposals"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400" />
              All Quotations
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Create, review, print, and export customer quotations
            </p>
          </div>

          <Link
            href="/quotations/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create New Quotation
          </Link>
        </div>

        {/* Alerts */}
        {message && (
          <div
            className={`flex items-center gap-3 p-3.5 rounded-xl text-sm ${
              message.type === "success"
                ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                : "bg-red-950/40 border border-red-800 text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span className="flex-1">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotation #, customer details, or author..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>Payment:</span>
            </div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Methods</option>
              <option value="FULL_PAYMENT">Full Payment</option>
              <option value="CREDIT">Credit</option>
              <option value="ADVANCE_PAYMENT">Advance Payment</option>
            </select>
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Quotation To (Customer)</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Valid Until</th>
                  <th className="py-3 px-3">Payment Method</th>
                  <th className="py-3 px-4 text-right">Full Amount (LKR)</th>
                  <th className="py-3 px-3">Prepared By</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                      Loading quotations...
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                      No quotations found. Click &quot;Create New Quotation&quot; to begin!
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => (
                    <tr
                      key={q.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-teal-400">
                        {q.quotationNo}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-white text-xs font-medium line-clamp-2 whitespace-pre-line">
                          {q.quotationTo}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-xs text-slate-300 font-mono">
                        {formatDateDMY(q.preparedDate)}
                      </td>

                      <td className="py-3.5 px-3 text-xs text-slate-400 font-mono">
                        {formatDateDMY(q.expireDate)}
                      </td>

                      <td className="py-3.5 px-3 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {q.paymentMethod === "ADVANCE_PAYMENT"
                            ? `Advance (${q.advancePercent ?? 0}%)`
                            : q.paymentMethod === "CREDIT"
                            ? "Credit"
                            : "Full"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-white">
                        {formatLKR(Number(q.totalAmount))}
                      </td>

                      <td className="py-3.5 px-3 text-xs text-slate-400">
                        {q.preparedBy}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/quotations/${q.id}/edit`}
                            title="Edit Quotation"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 rounded-md transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(q)}
                            disabled={downloadingId === q.id}
                            title="Download PDF"
                            className="p-1.5 bg-teal-900/40 hover:bg-teal-800/60 text-teal-300 border border-teal-700/50 rounded-md transition-colors disabled:opacity-50"
                          >
                            {downloadingId === q.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(q.id, q.quotationNo)}
                            disabled={deletingId === q.id}
                            title="Delete quotation"
                            className="p-1.5 hover:bg-red-950/60 text-slate-500 hover:text-red-400 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
