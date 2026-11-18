"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { formatLKR, formatDateDMY } from "@/lib/formatters";
import {
  generateRdQuotationPdf,
  RdQuotationPdfData,
} from "@/lib/rdQuotationPdfGenerator";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  ArrowLeft,
  Layers,
  Edit3,
  Calculator,
} from "lucide-react";
import { ThreeDPrintPricingModal } from "@/components/rad/ThreeDPrintPricingModal";

interface RdQuotationItem {
  id: number;
  itemIndex: number;
  itemType?: "HARDWARE" | "SERVICE";
  productOrService: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  notes?: string | null;
}

interface RdQuotation {
  id: number;
  type: "PROJECT_PROPOSAL" | "THREE_D_PRINT" | "PCB";
  registrationNo?: string | null;
  quotationNo: string;
  projectTitle?: string | null;
  preparedDate: string;
  expireDate: string;
  validityDays?: number | string | null;
  paymentMethod: string;
  advancePercent?: number | string | null;
  preparedBy: string;
  quotationTo: string;
  leadTime?: string | null;
  warranty?: string | null;
  hardwareTotal?: number | string | null;
  servicesTotal?: number | string | null;
  totalAmount: number | string;
  overview?: string | null;
  technicalSpecs?: any;
  termsAndConditions?: string | null;
  status: string;
  createdAt: string;
  items: RdQuotationItem[];
}

interface RadQuotationListProps {
  type: "PROJECT_PROPOSAL" | "THREE_D_PRINT" | "PCB";
  title: string;
  subtitle: string;
  createLabel: string;
  savedLabel?: string;
  createHref: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText: string;
  themeColor: "teal" | "amber" | "emerald";
}

export function RadQuotationList({
  type,
  title,
  subtitle,
  createLabel,
  savedLabel,
  createHref,
  icon: Icon,
  badgeText,
  themeColor,
}: RadQuotationListProps) {
  const [quotations, setQuotations] = useState<RdQuotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/rad/bank-accounts")
      .then((res) => (res.ok ? res.json() : { accounts: [] }))
      .then((data) => setBankAccounts(data.accounts || []))
      .catch((err) => console.error("Failed to load bank accounts in list:", err));
  }, []);

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("type", type);
      if (search.trim()) params.append("search", search.trim());
      params.append("limit", "50");

      const res = await fetch(`/api/rad/quotations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuotations(data.quotations || []);
      }
    } catch (err) {
      console.error(`Failed to load ${type} quotations:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDownloadPdf = async (q: RdQuotation) => {
    if (q.status === "DRAFT") {
      setMessage({
        type: "error",
        text: `Draft quotation "${q.quotationNo}" is partially filled and cannot be downloaded. Please click Edit to complete the required fields.`,
      });
      return;
    }

    setDownloadingId(q.id);
    try {
      let parsedSpecs: any = {};
      if (q.technicalSpecs) {
        if (typeof q.technicalSpecs === "string") {
          try {
            parsedSpecs = JSON.parse(q.technicalSpecs);
          } catch {
            parsedSpecs = {};
          }
        } else if (typeof q.technicalSpecs === "object") {
          parsedSpecs = q.technicalSpecs;
        }
      }

      // Filter out numeric keys if an object spread occurred on string
      if (parsedSpecs && typeof parsedSpecs === "object") {
        const nonNum: any = {};
        for (const k of Object.keys(parsedSpecs)) {
          if (!/^\d+$/.test(k)) {
            nonNum[k] = parsedSpecs[k];
          }
        }
        parsedSpecs = nonNum;
      }

      // Resolve bank details
      let resolvedBank = parsedSpecs?.bankDetails || null;
      if (!resolvedBank && parsedSpecs?.bankAccountId && bankAccounts.length > 0) {
        resolvedBank =
          bankAccounts.find((b) => b.id === parsedSpecs.bankAccountId) || null;
      }
      if (!resolvedBank && bankAccounts.length > 0) {
        resolvedBank =
          bankAccounts.find((b) => b.isDefault) || bankAccounts[0] || null;
      }

      // Resolve validity days (from q, parsedSpecs, or fallback to date diff)
      let resolvedValidity = q.validityDays ?? parsedSpecs?.validityDays ?? null;
      if (
        (resolvedValidity === null ||
          resolvedValidity === undefined ||
          Number(resolvedValidity) <= 0) &&
        q.preparedDate &&
        q.expireDate
      ) {
        try {
          const p = new Date(q.preparedDate).getTime();
          const e = new Date(q.expireDate).getTime();
          const diff = Math.round((e - p) / (1000 * 60 * 60 * 24));
          if (diff > 0) resolvedValidity = diff;
        } catch {}
      }
      if (!resolvedValidity || Number(resolvedValidity) <= 0) {
        resolvedValidity = 5;
      }

      const pdfData: RdQuotationPdfData = {
        type: q.type,
        quotationNo: q.quotationNo,
        registrationNo: q.registrationNo || "P-V 00336036",
        projectTitle: q.projectTitle,
        preparedDate:
          typeof q.preparedDate === "string"
            ? q.preparedDate.split("T")[0]
            : new Date(q.preparedDate).toISOString().split("T")[0],
        expireDate:
          typeof q.expireDate === "string"
            ? q.expireDate.split("T")[0]
            : new Date(q.expireDate).toISOString().split("T")[0],
        validityDays: resolvedValidity,
        paymentMethod: q.paymentMethod,
        advancePercent:
          q.advancePercent ??
          parsedSpecs?.advancePercent ??
          (q.paymentMethod === "ADVANCE_PAYMENT" ? 60 : null),
        preparedBy: q.preparedBy,
        quotationTo: q.quotationTo,
        leadTime: q.leadTime || parsedSpecs?.leadTime || null,
        warranty: q.warranty,
        hardwareTotal: q.hardwareTotal ? Number(q.hardwareTotal) : null,
        servicesTotal: q.servicesTotal ? Number(q.servicesTotal) : null,
        totalAmount: Number(q.totalAmount) || 0,
        overview: q.overview,
        overviewFontSize: parsedSpecs?.overviewFontSize
          ? Number(parsedSpecs.overviewFontSize)
          : 22.0,
        termsFontSize: parsedSpecs?.termsFontSize
          ? Number(parsedSpecs.termsFontSize)
          : 22.0,
        commercialNote: parsedSpecs?.commercialNote || null,
        technicalSpecs: parsedSpecs,
        systemDesignImages: parsedSpecs?.systemDesignImages || null,
        termsAndConditions: q.termsAndConditions,
        bankDetails: resolvedBank,
        items: (q.items || []).map((it, idx) => ({
          itemIndex: it.itemIndex || idx + 1,
          itemType: it.itemType || "HARDWARE",
          productOrService: it.productOrService,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          totalPrice: Number(it.totalPrice) || 0,
          notes: it.notes || null,
        })),
      };

      const doc = await generateRdQuotationPdf(pdfData);
      const safeNumber = (q.quotationNo || "RD-QUOTATION").replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );
      doc.save(`${safeNumber}.pdf`);
      setMessage({
        type: "success",
        text: `Quotation ${q.quotationNo} downloaded successfully.`,
      });
    } catch (err: any) {
      console.error("PDF generation error:", err);
      setMessage({
        type: "error",
        text: `Failed to generate PDF: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: number, quotationNo: string) => {
    if (
      !confirm(
        `Are you sure you want to delete quotation "${quotationNo}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/rad/quotations/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete quotation");
      }

      setMessage({
        type: "success",
        text: `Quotation ${quotationNo} has been deleted.`,
      });
      setQuotations((prev) => prev.filter((q) => q.id !== id));
    } catch (err: any) {
      console.error("Delete error:", err);
      setMessage({
        type: "error",
        text: err?.message || "Failed to delete quotation",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const colorStyles = {
    teal: {
      btnBg: "bg-teal-600 hover:bg-teal-500",
      iconColor: "text-teal-400",
      badgeClass: "bg-teal-900/50 text-teal-300 border-teal-700/60",
      accentBorder: "border-teal-500",
      activeTab: "bg-teal-600 text-white",
    },
    amber: {
      btnBg: "bg-amber-600 hover:bg-amber-500",
      iconColor: "text-amber-400",
      badgeClass: "bg-amber-900/50 text-amber-300 border-amber-700/60",
      accentBorder: "border-amber-500",
      activeTab: "bg-amber-600 text-white",
    },
    emerald: {
      btnBg: "bg-emerald-600 hover:bg-emerald-500",
      iconColor: "text-emerald-400",
      badgeClass: "bg-emerald-900/50 text-emerald-300 border-emerald-700/60",
      accentBorder: "border-emerald-500",
      activeTab: "bg-emerald-600 text-white",
    },
  }[themeColor];

  const defaultSavedLabel =
    savedLabel ||
    (type === "PROJECT_PROPOSAL"
      ? "Saved Proposals"
      : type === "THREE_D_PRINT"
      ? "Saved Quotes"
      : "Saved Plans");

  return (
    <AppLayout title={title} description={subtitle}>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/rad"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Back to R&D Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Icon className={`w-5 h-5 ${colorStyles.iconColor}`} />
                  {title}
                </h2>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${colorStyles.badgeClass}`}
                >
                  {badgeText}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            </div>
          </div>

          {/* Action Buttons & Navigation Tabs */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {type === "THREE_D_PRINT" && (
              <button
                type="button"
                onClick={() => setShowPricingModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-600/40 hover:border-amber-500 rounded-xl text-xs font-semibold transition-all shadow-sm"
                title="Configure 3D Print pricing defaults (filament cost, hourly rate, markup)"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-400" />
                <span>3D Pricing</span>
              </button>
            )}

            {/* Navigation Pill Tabs matching QC Inspection & Handover Letter */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shadow-inner">
              <div
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm ${colorStyles.activeTab}`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>
                  {defaultSavedLabel} ({quotations.length})
                </span>
              </div>
              <Link
                href={createHref}
                className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{createLabel}</span>
              </Link>
            </div>
          </div>
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

        {/* Search Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${title.toLowerCase()} by quotation #, customer, or title...`}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-4">
                    {type === "PROJECT_PROPOSAL"
                      ? "Customer & Project Title"
                      : "Quotation To (Customer)"}
                  </th>
                  {type !== "PROJECT_PROPOSAL" && (
                    <th className="py-3 px-3">
                      {type === "THREE_D_PRINT"
                        ? "Specifications"
                        : "Board Specs"}
                    </th>
                  )}
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Valid Until</th>
                  <th className="py-3 px-4 text-right">
                    {type === "PROJECT_PROPOSAL"
                      ? "Total Investment (LKR)"
                      : "Total Amount (LKR)"}
                  </th>
                  <th className="py-3 px-3">Prepared By</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                      Loading {title.toLowerCase()}...
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No {title.toLowerCase()} found. Click &quot;{createLabel}&quot; to begin!
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => {
                    let specSummary = "";
                    if (q.type === "THREE_D_PRINT" && q.technicalSpecs) {
                      const s =
                        typeof q.technicalSpecs === "string"
                          ? JSON.parse(q.technicalSpecs || "{}")
                          : q.technicalSpecs;
                      specSummary = `${s.material || "PLA"} • ${s.infillDensity || s.infill || "20%"}`;
                    } else if (q.type === "PCB" && q.technicalSpecs) {
                      const s =
                        typeof q.technicalSpecs === "string"
                          ? JSON.parse(q.technicalSpecs || "{}")
                          : q.technicalSpecs;
                      specSummary = `${s.layers || "2L"} • ${s.dimensions || ""}`;
                    }

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-white">
                          <Link
                            href={`/rad/${q.id}/edit`}
                            className="hover:text-teal-400 hover:underline"
                          >
                            {q.quotationNo}
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {q.status === "DRAFT" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                              DRAFT
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                              FINAL
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">
                            {q.quotationTo}
                          </div>
                          {q.projectTitle && (
                            <div className="text-xs text-teal-400/90 line-clamp-1 mt-0.5">
                              {q.projectTitle}
                            </div>
                          )}
                        </td>
                        {type !== "PROJECT_PROPOSAL" && (
                          <td className="py-3 px-3 text-xs text-slate-400">
                            {specSummary || "—"}
                          </td>
                        )}
                        <td className="py-3 px-3 text-slate-300 text-xs whitespace-nowrap">
                          {formatDateDMY(q.preparedDate)}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">
                          {formatDateDMY(q.expireDate)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                          {formatLKR(Number(q.totalAmount) || 0)}
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-xs whitespace-nowrap">
                          {q.preparedBy || "LK Tronics"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                if (q.status === "DRAFT") {
                                  setMessage({
                                    type: "error",
                                    text: `Draft quotation "${q.quotationNo}" is partially filled and cannot be downloaded. Please click Edit to complete the required fields.`,
                                  });
                                  return;
                                }
                                handleDownloadPdf(q);
                              }}
                              disabled={downloadingId === q.id || q.status === "DRAFT"}
                              title={
                                q.status === "DRAFT"
                                  ? "Draft quotation cannot be downloaded. Please edit and finalize first."
                                  : "Download PDF"
                              }
                              className={`p-1.5 rounded-lg border transition-colors ${
                                q.status === "DRAFT"
                                  ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-40"
                                  : "bg-teal-950/60 border-teal-800/60 text-teal-400 hover:bg-teal-900/60 hover:text-white"
                              }`}
                            >
                              {downloadingId === q.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            <Link
                              href={`/rad/${q.id}/edit`}
                              title="Edit Quotation"
                              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(q.id, q.quotationNo)}
                              disabled={deletingId === q.id}
                              title="Delete Quotation"
                              className="p-1.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 hover:bg-red-900/50 hover:text-white transition-colors disabled:opacity-50"
                            >
                              {deletingId === q.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
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

      {type === "THREE_D_PRINT" && (
        <ThreeDPrintPricingModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
        />
      )}
    </AppLayout>
  );
}

