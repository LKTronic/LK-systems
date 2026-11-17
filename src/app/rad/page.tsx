"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { formatLKR, formatDateDMY } from "@/lib/formatters";
import {
  generateRdQuotationPdf,
  RdQuotationPdfData,
} from "@/lib/rdQuotationPdfGenerator";
import {
  FlaskConical,
  Plus,
  Search,
  Download,
  Trash2,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Cpu,
  Printer,
  Lightbulb,
  ChevronDown,
  Layers,
  ArrowRight,
  Filter,
} from "lucide-react";

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
  paymentMethod: string;
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

export default function RadQuotationsListPage() {
  const [quotations, setQuotations] = useState<RdQuotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      params.append("limit", "50");

      const res = await fetch(`/api/rad/quotations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuotations(data.quotations || []);
      }
    } catch (err) {
      console.error("Failed to load R&D quotations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, typeFilter]);

  const handleDownloadPdf = async (q: RdQuotation) => {
    setDownloadingId(q.id);
    try {
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
        paymentMethod: q.paymentMethod,
        preparedBy: q.preparedBy,
        quotationTo: q.quotationTo,
        leadTime: q.leadTime,
        warranty: q.warranty,
        hardwareTotal: q.hardwareTotal ? Number(q.hardwareTotal) : null,
        servicesTotal: q.servicesTotal ? Number(q.servicesTotal) : null,
        totalAmount: Number(q.totalAmount) || 0,
        overview: q.overview,
        technicalSpecs: q.technicalSpecs,
        termsAndConditions: q.termsAndConditions,
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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "PROJECT_PROPOSAL":
        return {
          label: "Project Proposal",
          icon: Lightbulb,
          className:
            "bg-teal-950/60 text-teal-300 border-teal-800/80 ring-teal-500/20",
        };
      case "THREE_D_PRINT":
        return {
          label: "3D Print",
          icon: Printer,
          className:
            "bg-amber-950/60 text-amber-300 border-amber-800/80 ring-amber-500/20",
        };
      case "PCB":
        return {
          label: "PCB Fabrication",
          icon: Cpu,
          className:
            "bg-emerald-950/60 text-emerald-300 border-emerald-800/80 ring-emerald-500/20",
        };
      default:
        return {
          label: type,
          icon: FlaskConical,
          className: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  return (
    <AppLayout
      title="R&D Quotations"
      description="Manage Project Proposals, 3D Printing Quotations, and PCB Fabrication Plans"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Top Header Card */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-xl border border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <FlaskConical className="w-6 h-6 text-teal-400" />
              R&D Quotations & Proposals
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Create, customize, print, and export Project Proposals, 3D Print estimates, and PCB fabrication plans
            </p>
          </div>

          {/* Quick Create Dropdown / Buttons */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-md shadow-teal-900/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create R&D Quotation</span>
              <ChevronDown className="w-4 h-4 ml-1 opacity-80" />
            </button>

            {showCreateMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowCreateMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-30 divide-y divide-slate-800">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Quotation Type
                  </div>
                  <Link
                    href="/rad/create?type=PROJECT_PROPOSAL"
                    onClick={() => setShowCreateMenu(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400 mt-0.5">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-teal-300">
                        Project Proposal
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        Comprehensive architecture with hardware BOM, engineering fees & milestones
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/rad/create?type=THREE_D_PRINT"
                    onClick={() => setShowCreateMenu(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400 mt-0.5">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-amber-300">
                        3D Print Quotation
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        Infill %, technology, resin/filament material & rapid prototyping rates
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/rad/create?type=PCB"
                    onClick={() => setShowCreateMenu(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mt-0.5">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-emerald-300">
                        PCB Fabrication Plan
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        Layers, copper weight, solder mask, dimensions & fabrication lead time
                      </div>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Feature Cards / Type Quick Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/rad/project-proposal"
            className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-teal-950/20 border border-slate-800 hover:border-teal-700/60 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-teal-950/30"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-lg bg-teal-950/70 border border-teal-800/60 text-teal-400">
                <Lightbulb className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-900/40 text-teal-300 border border-teal-700/40">
                PQV Series
              </span>
            </div>
            <h3 className="text-base font-semibold text-white group-hover:text-teal-300 transition-colors">
              Project Proposal
            </h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Hardware bill of materials, engineering & testing service charges, project milestones, and warranty.
            </p>
            <div className="mt-3 flex items-center text-xs font-medium text-teal-400 group-hover:translate-x-1 transition-transform">
              <span>View Table & Create Proposal</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            href="/rad/3d-print"
            className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-amber-950/20 border border-slate-800 hover:border-amber-700/60 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-amber-950/30"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-lg bg-amber-950/70 border border-amber-800/60 text-amber-400">
                <Printer className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/40">
                3DQ Series
              </span>
            </div>
            <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
              3D Print Quotation
            </h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Standardized printing parameters (FDM/SLA, Infill %, Material, Colors, Layer height) & fast turnaround.
            </p>
            <div className="mt-3 flex items-center text-xs font-medium text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>View Table & Create 3D Print Quote</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            href="/rad/pcb"
            className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/20 border border-slate-800 hover:border-emerald-700/60 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-emerald-950/30"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
                <Cpu className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/40">
                PCB Series
              </span>
            </div>
            <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
              PCB Fabrication Plan
            </h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Layer count, board dimensions, base FR-4 specs, copper weight, solder mask, and fabrication terms.
            </p>
            <div className="mt-3 flex items-center text-xs font-medium text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>View Table & Create PCB Plan</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
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

        {/* Filter and Search Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotation #, project title, customer, or author..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "All" },
              { id: "PROJECT_PROPOSAL", label: "Proposals" },
              { id: "THREE_D_PRINT", label: "3D Print" },
              { id: "PCB", label: "PCB" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  typeFilter === tab.id
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4">Customer & Project</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Valid Until</th>
                  <th className="py-3 px-4 text-right">Full Amount (LKR)</th>
                  <th className="py-3 px-3">Prepared By</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400 text-xs"
                    >
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                      Loading R&D quotations...
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No R&D quotations found. Click &quot;Create R&D
                      Quotation&quot; to begin!
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => {
                    const badge = getTypeBadge(q.type);
                    const BadgeIcon = badge.icon;
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
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}
                          >
                            <BadgeIcon className="w-3.5 h-3.5" />
                            {badge.label}
                          </span>
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
                              onClick={() => handleDownloadPdf(q)}
                              disabled={downloadingId === q.id}
                              title="Download PDF"
                              className="p-1.5 rounded-lg bg-teal-950/60 border border-teal-800/60 text-teal-400 hover:bg-teal-900/60 hover:text-white transition-colors disabled:opacity-50"
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
    </AppLayout>
  );
}

