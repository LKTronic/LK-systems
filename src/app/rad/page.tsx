"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { formatLKR } from "@/lib/formatters";
import {
  FlaskConical,
  Plus,
  Cpu,
  Printer,
  Lightbulb,
  ChevronDown,
  ArrowRight,
  Landmark,
  ClipboardCheck,
  FileText,
  Calculator,
  Sliders,
  Sparkles,
  Settings2,
  Building2,
  Check,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { BankAccountsModal } from "@/components/rad/BankAccountsModal";
import { ThreeDPrintPricingModal } from "@/components/rad/ThreeDPrintPricingModal";
import {
  ThreeDPrintPricingSettings,
  DEFAULT_THREE_D_PRINT_PRICING,
} from "@/lib/threeDPrintPricing";

interface RdQuotation {
  id: number;
  type: "PROJECT_PROPOSAL" | "THREE_D_PRINT" | "PCB" | "UNI_QUOTATION";
  quotationNo: string;
  totalAmount: number | string;
}

export default function RadDashboardPage() {
  const [quotations, setQuotations] = useState<RdQuotation[]>([]);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showBankAccountsModal, setShowBankAccountsModal] = useState(false);
  const [showThreeDPrintPricingModal, setShowThreeDPrintPricingModal] =
    useState(false);

  // Auxiliary state for quick settings overview
  const [pricingSettings, setPricingSettings] =
    useState<ThreeDPrintPricingSettings>(DEFAULT_THREE_D_PRINT_PRICING);
  const [bankAccountsCount, setBankAccountsCount] = useState<number>(0);
  const [checklistCount, setChecklistCount] = useState<number>(0);
  const [handoverCount, setHandoverCount] = useState<number>(0);

  const fetchPricing = async () => {
    try {
      const res = await fetch("/api/rad/3d-pricing");
      if (res.ok) {
        const data = await res.json();
        if (data?.pricing) {
          setPricingSettings(data.pricing);
        }
      }
    } catch (err) {
      console.error("Failed to fetch 3D pricing settings:", err);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch("/api/rad/bank-accounts");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.bankAccounts)) {
          setBankAccountsCount(data.bankAccounts.length);
        }
      }
    } catch (err) {
      console.error("Failed to fetch bank accounts:", err);
    }
  };

  const fetchAuxiliaryStats = async () => {
    try {
      const [checklistsRes, handoversRes] = await Promise.all([
        fetch("/api/checklists"),
        fetch("/api/handovers"),
      ]);

      if (checklistsRes.ok) {
        const data = await checklistsRes.json();
        if (Array.isArray(data?.checklists)) {
          setChecklistCount(data.checklists.length);
        }
      }
      if (handoversRes.ok) {
        const data = await handoversRes.json();
        if (Array.isArray(data?.handovers)) {
          setHandoverCount(data.handovers.length);
        }
      }
    } catch (err) {
      console.error("Failed to load auxiliary stats:", err);
    }
  };

  const fetchQuotations = async () => {
    try {
      const res = await fetch(`/api/rad/quotations?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setQuotations(data.quotations || []);
      }
    } catch (err) {
      console.error("Failed to load R&D quotations:", err);
    }
  };

  useEffect(() => {
    fetchPricing();
    fetchBankAccounts();
    fetchAuxiliaryStats();
    fetchQuotations();
  }, []);

  // Executive Metrics calculation - Counts only (no price/currency figures)
  const metrics = useMemo(() => {
    let propCount = 0;
    let threeDCount = 0;
    let pcbCount = 0;
    let uniCount = 0;

    for (const q of quotations) {
      if (q.type === "PROJECT_PROPOSAL") {
        propCount++;
      } else if (q.type === "THREE_D_PRINT") {
        threeDCount++;
      } else if (q.type === "PCB") {
        pcbCount++;
      } else if (q.type === "UNI_QUOTATION") {
        uniCount++;
      }
    }

    return {
      totalCount: quotations.length,
      propCount,
      threeDCount,
      pcbCount,
      uniCount,
    };
  }, [quotations]);

  return (
    <AppLayout
      title="R&D Engineering Dashboard"
      description="Manage Rapid Prototyping, PCB Fabrication, Custom Proposals & Quality Assurance"
    >
      <div className="space-y-4 max-w-7xl mx-auto pb-4">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                <Sparkles className="w-2.5 h-2.5 text-teal-400" />
                R&D DIVISION &amp; PROTOTYPING
              </span>
              <span className="text-[11px] text-slate-500 font-mono">P-V 00336036</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
              <FlaskConical className="w-6 h-6 text-teal-400 shrink-0" />
              <span>R&D Engineering Operations</span>
            </h1>
            <p className="text-xs text-slate-400 leading-snug">
              Rapid prototyping, PCB fabrication plans, turnkey proposals, QC testing checklists &amp; handover documentation.
            </p>
          </div>

          {/* Quick Configuration & Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 3D Printing Cost Settings Button */}
            <button
              type="button"
              onClick={() => setShowThreeDPrintPricingModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-600/40 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm group"
              title="Configure 3D printing filament prices, density, labor cost & profit markup"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-6 transition-transform" />
              <span>3D Print Pricing</span>
            </button>

            {/* Bank Accounts Settings Button */}
            <button
              type="button"
              onClick={() => setShowBankAccountsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-teal-300 border border-teal-600/40 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm group"
              title="Manage settlement bank accounts displayed on official quotations"
            >
              <Landmark className="w-3.5 h-3.5 text-teal-400 group-hover:scale-110 transition-transform" />
              <span>Bank Accounts</span>
            </button>

            {/* Quick Create Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCreateMenu(!showCreateMenu)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-teal-950/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Document</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>

              {showCreateMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowCreateMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 z-30 divide-y divide-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Select R&D Document</span>
                      <span className="text-[9px] text-teal-400 font-mono">1-Click Launch</span>
                    </div>

                    <Link
                      href="/rad/create?type=THREE_D_PRINT"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400 mt-0.5">
                        <Printer className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-amber-300">
                          3D Print Quotation
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Infill %, material density, filament length &amp; labor rate
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/rad/create?type=PCB"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mt-0.5">
                        <Cpu className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-emerald-300">
                          PCB Fabrication Plan
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Board layers, copper weight, solder mask &amp; lead time
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/rad/create?type=PROJECT_PROPOSAL"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400 mt-0.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-teal-300">
                          Project Proposal
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Hardware BOM, engineering services, milestones &amp; warranty
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/rad/create?type=UNI_QUOTATION"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400 mt-0.5">
                        <GraduationCap className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-blue-300">
                          Uni Quotation
                        </div>
                        <div className="text-[11px] text-slate-400">
                          University proposals, components table, images &amp; engineering charges
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/rad/checklist"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 mt-0.5">
                        <ClipboardCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-cyan-300">
                          QC Inspection Checklist
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Battery &amp; Inverter testing, parameter checklist &amp; PDF report
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/rad/handover"
                      onClick={() => setShowCreateMenu(false)}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400 mt-0.5">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-purple-300">
                          Product Handover Letter
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Equipment transfer letter with serials &amp; customer sign-off
                        </div>
                      </div>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Executive KPI Stats Bar - Counts Only (No price figures) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Quotations Count View */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 border border-slate-800 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Quotations
              </span>
              <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-white">
              {metrics.totalCount} <span className="text-xs font-normal text-slate-400">Total</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 truncate">
              All active &amp; saved quotes
            </div>
          </div>

          {/* Card 2: 3D Rapid Prototyping */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
                3D Print Jobs
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Printer className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-white">
              {metrics.threeDCount}{" "}
              <span className="text-xs font-normal text-slate-400">Prints</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">Rapid Prototyping</span>
              <Link
                href="/rad/3d-print"
                className="text-amber-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1"
              >
                View <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: PCB Fabrication */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400/90 uppercase tracking-wider">
                PCB Fabrication
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-white">
              {metrics.pcbCount}{" "}
              <span className="text-xs font-normal text-slate-400">Plans</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">Board Engineering</span>
              <Link
                href="/rad/pcb"
                className="text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1"
              >
                View <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>

          {/* Card 4: Project Proposals */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 border border-slate-800 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-teal-400/90 uppercase tracking-wider">
                Project Proposals
              </span>
              <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                <Lightbulb className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-white">
              {metrics.propCount}{" "}
              <span className="text-xs font-normal text-slate-400">Proposals</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">Turnkey BOM &amp; Services</span>
              <Link
                href="/rad/project-proposal"
                className="text-teal-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1"
              >
                View <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>

          {/* Card 5: Quality & Delivery Records */}
          <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border border-slate-800 rounded-2xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cyan-400/90 uppercase tracking-wider">
                QC &amp; Delivery
              </span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <ClipboardCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-xl font-bold font-mono text-white">
                {checklistCount} <span className="text-[11px] font-normal text-cyan-400">QC</span>
              </div>
              <div className="text-slate-600 font-light">/</div>
              <div className="text-xl font-bold font-mono text-white">
                {handoverCount} <span className="text-[11px] font-normal text-purple-400">Handovers</span>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">Verified Tests</span>
              <Link
                href="/rad/checklist"
                className="text-cyan-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1"
              >
                Hub <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Configuration Snapshot Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 3D Pricing Quick Engine Snapshot */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-950/70 border border-amber-800/60 text-amber-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    3D Printing Cost Engine
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Active rate formula for filament weight &amp; machine labor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowThreeDPrintPricingModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/50 rounded-lg text-[11px] font-medium transition-colors"
              >
                <Sliders className="w-3 h-3" />
                <span>Adjust Rates</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
              <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800/80">
                <div className="text-[9px] text-slate-400 font-sans">Filament Rate</div>
                <div className="text-white font-semibold mt-0.5 truncate">
                  {formatLKR(pricingSettings.filamentPricePerKg || 10000)}/kg
                </div>
              </div>
              <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800/80">
                <div className="text-[9px] text-slate-400 font-sans">Spool Length</div>
                <div className="text-white font-semibold mt-0.5">
                  {pricingSettings.spoolLengthMeters || 330} m
                </div>
              </div>
              <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800/80">
                <div className="text-[9px] text-slate-400 font-sans">Machine / Hr</div>
                <div className="text-white font-semibold mt-0.5 truncate">
                  {formatLKR(pricingSettings.costPerHour || 200)}/hr
                </div>
              </div>
              <div className="bg-slate-950/70 p-1.5 rounded-lg border border-slate-800/80">
                <div className="text-[9px] text-slate-400 font-sans">Markup Profit</div>
                <div className="text-emerald-400 font-semibold mt-0.5">
                  +{pricingSettings.markupPercent || 35}%
                </div>
              </div>
            </div>
          </div>

          {/* Bank Accounts & Settlement Snapshot */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-950/70 border border-teal-800/60 text-teal-400">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    Official Settlement Bank Accounts
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Accounts printed on quotation and proposal footers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBankAccountsModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-700/50 rounded-lg text-[11px] font-medium transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                <span>Manage Accounts</span>
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="text-slate-300">
                  {bankAccountsCount > 0 ? (
                    <>
                      <strong className="text-white">{bankAccountsCount}</strong> active settlement account{bankAccountsCount > 1 ? "s" : ""} registered
                    </>
                  ) : (
                    "Using default company commercial account"
                  )}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                <Check className="w-3 h-3" />
                Ready for PDF
              </span>
            </div>
          </div>
        </div>

        {/* 5 Core R&D Module Launchers */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              R&D Engineering Modules &amp; Documentation Hub
            </h2>
            <span className="text-[11px] text-slate-500">5 Specialized Operational Tools</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Module 1: 3D Print */}
            <div className="group bg-slate-900/70 border border-slate-800 hover:border-amber-700/60 rounded-xl p-3.5 transition-all hover:shadow-lg hover:shadow-amber-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
                    <Printer className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50">
                    QV Series
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                  3D Print Quotations
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Infill, density formula, filament length, runtime and rapid prototyping rates.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[11px]">
                <Link
                  href="/rad/3d-print"
                  className="text-amber-400 font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Open Hub</span> <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </Link>
                <Link
                  href="/rad/create?type=THREE_D_PRINT"
                  className="px-2 py-0.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10.5px]"
                >
                  + New Quote
                </Link>
              </div>
            </div>

            {/* Module 2: PCB Fabrication */}
            <div className="group bg-slate-900/70 border border-slate-800 hover:border-emerald-700/60 rounded-xl p-3.5 transition-all hover:shadow-lg hover:shadow-emerald-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                    <Cpu className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                    QV Series
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  PCB Fabrication
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Layers, copper weight, solder mask, dimensions &amp; multi-board fabrication plans.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[11px]">
                <Link
                  href="/rad/pcb"
                  className="text-emerald-400 font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Open Hub</span> <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </Link>
                <Link
                  href="/rad/create?type=PCB"
                  className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10.5px]"
                >
                  + New Plan
                </Link>
              </div>
            </div>

            {/* Module 3: Project Proposal */}
            <div className="group bg-slate-900/70 border border-slate-800 hover:border-teal-700/60 rounded-xl p-3.5 transition-all hover:shadow-lg hover:shadow-teal-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400">
                    <Lightbulb className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-950/60 text-teal-300 border border-teal-800/50">
                    PQV Series
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">
                  Project Proposals
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Hardware BOM, engineering services, milestone payments, delivery timeline &amp; terms.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[11px]">
                <Link
                  href="/rad/project-proposal"
                  className="text-teal-400 font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Open Hub</span> <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </Link>
                <Link
                  href="/rad/create?type=PROJECT_PROPOSAL"
                  className="px-2 py-0.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10.5px]"
                >
                  + New Proposal
                </Link>
              </div>
            </div>

            {/* Module 4: Uni Quotation */}
            <div className="group bg-slate-900/70 border border-slate-800 hover:border-blue-700/60 rounded-xl p-3.5 transition-all hover:shadow-lg hover:shadow-blue-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400">
                    <GraduationCap className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/50">
                    PQV Series
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                  Uni Quotations
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Components table, item images, engineering charges &amp; academic discounts.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[11px]">
                <Link
                  href="/rad/uni-quotation"
                  className="text-blue-400 font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Open Hub</span> <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </Link>
                <Link
                  href="/rad/create?type=UNI_QUOTATION"
                  className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10.5px]"
                >
                  + New Quote
                </Link>
              </div>
            </div>

            {/* Module 5: QC Checklist */}
            <div className="group bg-slate-900/70 border border-slate-800 hover:border-cyan-700/60 rounded-xl p-3.5 transition-all hover:shadow-lg hover:shadow-cyan-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                    <ClipboardCheck className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                    QC Lab
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  QC Checklists
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Battery &amp; Inverter hardware inspection, safety verification &amp; certified reports.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[11px]">
                <Link
                  href="/rad/checklist"
                  className="text-cyan-400 font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Open Hub</span> <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </Link>
                <Link
                  href="/rad/checklist"
                  className="px-2 py-0.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10.5px]"
                >
                  + New QC
                </Link>
              </div>
            </div>

            {/* Module 6: Handover Letters */}
            <div className="group bg-slate-900/70 border border-slate-800 hover:border-purple-700/60 rounded-xl p-3.5 transition-all hover:shadow-lg hover:shadow-purple-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/50">
                    Dispatch
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                  Handover Letters
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Formal product delivery documentation with serial numbers and customer sign-off.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[11px]">
                <Link
                  href="/rad/handover"
                  className="text-purple-400 font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Open Hub</span> <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                </Link>
                <Link
                  href="/rad/handover"
                  className="px-2 py-0.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10.5px]"
                >
                  + New Letter
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications & Feedback Alerts */}
        {message && (
          <div
            className={`flex items-center gap-2.5 p-3 rounded-xl text-xs ${
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
      </div>

      {/* 3D Printing Cost Pricing Settings Modal */}
      <ThreeDPrintPricingModal
        isOpen={showThreeDPrintPricingModal}
        onClose={() => {
          setShowThreeDPrintPricingModal(false);
          fetchPricing();
        }}
        onSaved={(newPricing) => {
          setPricingSettings(newPricing);
          fetchPricing();
        }}
      />

      {/* Settlement Bank Accounts Modal */}
      <BankAccountsModal
        isOpen={showBankAccountsModal}
        onClose={() => {
          setShowBankAccountsModal(false);
          fetchBankAccounts();
        }}
        onUpdated={() => {
          fetchBankAccounts();
        }}
      />
    </AppLayout>
  );
}
