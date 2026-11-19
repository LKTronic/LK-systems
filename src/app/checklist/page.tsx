"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/AppLayout";
import {
  ProductChecklistType,
  BatteryInfo,
  InverterInfo,
  ChecklistTestItem,
  ChecklistNoteItem,
  ProductChecklist,
  getDefaultTestItems,
  getDefaultBatteryInfo,
  getDefaultInverterInfo,
  formatAutoChecklistNo,
  NoteColor,
} from "@/lib/productChecklist";
import { generateChecklistPdf } from "@/lib/checklistPdfGenerator";
import {
  ClipboardCheck,
  BatteryCharging,
  Zap,
  CheckCircle2,
  XCircle,
  FileDown,
  Save,
  Plus,
  Trash2,
  Bold,
  Highlighter,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react";

export default function ChecklistPage() {
  const { data: session } = useSession();

  // Active Tab: "history" (Saved Reports by default) or "form"
  const [activeTab, setActiveTab] = useState<"form" | "history">("history");

  // Check URL params on mount (?tab=form or ?new=1)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "form" || params.get("new") === "1") {
        setActiveTab("form");
      }
    }
  }, []);

  // Form State
  const [checklistType, setChecklistType] = useState<ProductChecklistType>("BATTERY");
  const [checklistNo, setChecklistNo] = useState<string>(() => formatAutoChecklistNo("BATTERY"));
  const [isNumberAutoLocked, setIsNumberAutoLocked] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"DRAFT" | "COMPLETED">("COMPLETED");
  const [isFetchingNo, setIsFetchingNo] = useState(false);

  // Section 1: Info
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo>(getDefaultBatteryInfo());
  const [inverterInfo, setInverterInfo] = useState<InverterInfo>(getDefaultInverterInfo());
  const [boxSerialManuallyDiverged, setBoxSerialManuallyDiverged] = useState(false);
  const [inverterBoxSerialDiverged, setInverterBoxSerialDiverged] = useState(false);

  // Section 2: QC Tests & Dates
  const [checkedDate, setCheckedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [tests, setTests] = useState<ChecklistTestItem[]>(() => getDefaultTestItems("BATTERY"));
  const [overallQcPassed, setOverallQcPassed] = useState<boolean>(false);

  // Serial Number Mismatch Detection
  const hasBatterySerialMismatch = Boolean(
    batteryInfo.serialNumberBattery?.trim() &&
    batteryInfo.serialNumberBox?.trim() &&
    batteryInfo.serialNumberBattery.trim() !== batteryInfo.serialNumberBox.trim()
  );

  const hasInverterSerialMismatch = Boolean(
    inverterInfo.serialNumberInverter?.trim() &&
    inverterInfo.serialNumberBox?.trim() &&
    inverterInfo.serialNumberInverter.trim() !== inverterInfo.serialNumberBox.trim()
  );

  // Section 3: Inspector
  const [checkedByName, setCheckedByName] = useState<string>("");
  const [checkedByDesignation, setCheckedByDesignation] = useState<string>("Quality Control & Hardware Engineer");

  // Section 4: Notes
  const [notes, setNotes] = useState<ChecklistNoteItem[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteBold, setNewNoteBold] = useState(false);
  const [newNoteHighlight, setNewNoteHighlight] = useState(false);
  const [newNoteColor, setNewNoteColor] = useState<NoteColor>("default");

  // History State
  const [savedChecklists, setSavedChecklists] = useState<ProductChecklist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "BATTERY" | "INVERTER">("ALL");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Initialize checkedByName with logged in user if empty
  useEffect(() => {
    if (!checkedByName && session?.user?.name) {
      setCheckedByName(session.user.name);
    }
  }, [session, checkedByName]);

  // Fetch next checklist number when type changes (if not editing an existing one)
  const fetchNextNumber = async (type: ProductChecklistType) => {
    if (editingId) return;
    setIsFetchingNo(true);
    try {
      const res = await fetch(`/api/checklists/next-number?type=${type}`);
      if (res.ok) {
        const d = await res.json();
        if (d.nextNo) setChecklistNo(d.nextNo);
      }
    } catch (err) {
      console.error("Error fetching checklist number:", err);
    } finally {
      setIsFetchingNo(false);
    }
  };

  useEffect(() => {
    if (!editingId) {
      fetchNextNumber(checklistType);
    }
  }, [checklistType]);

  // Fetch History
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/checklists");
      if (res.ok) {
        const d = await res.json();
        setSavedChecklists(d.checklists || []);
      }
    } catch (err) {
      console.error("Failed to load checklists:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  // Handle Product Type Change
  const handleTypeChange = (newType: ProductChecklistType) => {
    if (newType === checklistType) return;
    setChecklistType(newType);
    setTests(getDefaultTestItems(newType));
    setBoxSerialManuallyDiverged(false);
    setInverterBoxSerialDiverged(false);
    if (!editingId && isNumberAutoLocked) {
      setChecklistNo(formatAutoChecklistNo(newType));
      fetchNextNumber(newType);
    }
  };

  // Handle Serial Number Auto-fill & Swapping
  const handleBatterySerialChange = (val: string) => {
    setBatteryInfo((prev) => ({
      ...prev,
      serialNumberBattery: val,
      serialNumberBox: boxSerialManuallyDiverged ? prev.serialNumberBox : val,
    }));
  };

  const handleBoxSerialChange = (val: string) => {
    setBoxSerialManuallyDiverged(true);
    setBatteryInfo((prev) => ({
      ...prev,
      serialNumberBox: val,
    }));
  };

  const handleInverterSerialChange = (val: string) => {
    setInverterInfo((prev) => ({
      ...prev,
      serialNumberInverter: val,
      serialNumber: val,
      serialNumberBox: inverterBoxSerialDiverged ? prev.serialNumberBox : val,
    }));
  };

  const handleInverterBoxSerialChange = (val: string) => {
    setInverterBoxSerialDiverged(true);
    setInverterInfo((prev) => ({
      ...prev,
      serialNumberBox: val,
    }));
  };

  // Toggle Test Checkbox
  const handleToggleTest = (idx: number) => {
    setTests((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], passed: !updated[idx].passed };
      return updated;
    });
  };

  // Update Test Comment
  const handleTestCommentChange = (idx: number, comment: string) => {
    setTests((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], comment };
      return updated;
    });
  };

  // Add Note Item
  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const item: ChecklistNoteItem = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: newNoteText.trim(),
      bold: newNoteBold,
      highlight: newNoteHighlight,
      color: newNoteColor,
    };
    setNotes((prev) => [...prev, item]);
    setNewNoteText("");
  };

  const handleRemoveNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Reset form to blank state
  const handleResetForm = () => {
    setEditingId(null);
    setStatus("COMPLETED");
    setChecklistType("BATTERY");
    setBatteryInfo(getDefaultBatteryInfo());
    setInverterInfo(getDefaultInverterInfo());
    setTests(getDefaultTestItems("BATTERY"));
    setOverallQcPassed(false);
    setNotes([]);
    setBoxSerialManuallyDiverged(false);
    setIsNumberAutoLocked(true);
    setChecklistNo(formatAutoChecklistNo("BATTERY"));
    fetchNextNumber("BATTERY");
    showNotification("success", "Form reset to new inspection state");
  };

  // Load a checklist into editor
  const handleLoadForEdit = (item: ProductChecklist) => {
    setEditingId(item.id);
    setStatus(item.status === "DRAFT" ? "DRAFT" : "COMPLETED");
    setChecklistNo(item.checklistNo);
    setIsNumberAutoLocked(false);
    setChecklistType(item.type);
    if (item.type === "BATTERY" && item.batteryInfo) {
      setBatteryInfo(item.batteryInfo);
    }
    if (item.type === "INVERTER" && item.inverterInfo) {
      setInverterInfo({
        ...getDefaultInverterInfo(),
        ...item.inverterInfo,
        serialNumberInverter: item.inverterInfo.serialNumberInverter || item.inverterInfo.serialNumber || "",
        serialNumberBox: item.inverterInfo.serialNumberBox || "",
      });
    }
    setCheckedDate(item.checkedDate || new Date().toISOString().split("T")[0]);
    setTests(item.tests || getDefaultTestItems(item.type));
    setCheckedByName(item.checkedByName || "");
    setCheckedByDesignation(item.checkedByDesignation || "Quality Control & Hardware Engineer");
    setNotes(item.additionalNotes || []);
    setOverallQcPassed(item.overallQcPassed !== undefined ? item.overallQcPassed : true);
    setActiveTab("form");
    showNotification("success", `Loaded ${item.checklistNo} for editing`);
  };

  // Delete checklist from history
  const handleDelete = async (id: string, refNo: string) => {
    if (!confirm(`Are you sure you want to delete inspection record ${refNo}?`)) return;
    try {
      const res = await fetch(`/api/checklists/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("success", `Deleted ${refNo}`);
        fetchHistory();
      } else {
        showNotification("error", "Failed to delete record");
      }
    } catch (err) {
      showNotification("error", "Network error while deleting");
    }
  };

  // Prepare full checklist data object
  const buildCurrentChecklistData = (targetStatus?: "DRAFT" | "COMPLETED"): ProductChecklist => {
    return {
      id: editingId || `chk-${Date.now()}`,
      checklistNo: checklistNo.trim() || formatAutoChecklistNo(checklistType),
      type: checklistType,
      status: targetStatus || status || "COMPLETED",
      batteryInfo: checklistType === "BATTERY" ? batteryInfo : undefined,
      inverterInfo: checklistType === "INVERTER" ? inverterInfo : undefined,
      checkedDate,
      tests,
      checkedByName: checkedByName || session?.user?.name || "QC Inspector",
      checkedByDesignation,
      additionalNotes: notes,
      overallQcPassed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Save Checklist to API: auto-draft if half-filled, certified if complete
  const handleSave = async (explicitStatus?: "DRAFT" | "COMPLETED") => {
    const modelStr = checklistType === "BATTERY" ? batteryInfo.modelNumber : inverterInfo.modelNumber;
    const isComplete = Boolean(
      checklistNo.trim() &&
      modelStr?.trim() &&
      checkedByName?.trim() &&
      checkedDate
    );
    const targetStatus = explicitStatus || (isComplete ? "COMPLETED" : "DRAFT");

    setIsSubmitting(true);
    try {
      const payload = buildCurrentChecklistData(targetStatus);
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const d = await res.json();
        setStatus(targetStatus);
        showNotification(
          "success",
          targetStatus === "DRAFT"
            ? `Inspection ${d.checklist?.checklistNo || checklistNo} saved as DRAFT (partially filled)!`
            : `Checklist ${d.checklist?.checklistNo || checklistNo} saved and certified!`
        );
        if (!editingId && d.checklist?.id) {
          setEditingId(d.checklist.id);
        }
      } else {
        const err = await res.json();
        showNotification("error", err?.error || "Failed to save checklist");
      }
    } catch (err) {
      showNotification("error", "Error saving checklist record");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Letterhead PDF
  const handleDownloadPdf = async (customData?: ProductChecklist) => {
    const data = customData || buildCurrentChecklistData();
    if (data.status === "DRAFT") {
      showNotification("error", `Draft checklist "${data.checklistNo}" cannot be downloaded. Please save and certify it first.`);
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const doc = await generateChecklistPdf(data);
      const safeName = (data.checklistNo || "Checklist").replace(/[/\\?%*:|"<>]/g, "_");
      doc.save(`${safeName}_Inspection_Report.pdf`);
      showNotification("success", `Downloaded PDF for ${data.checklistNo}`);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      showNotification("error", "Failed to generate PDF document");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  // Filter history items
  const filteredHistory = savedChecklists.filter((c) => {
    if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const no = (c.checklistNo || "").toLowerCase();
    const model = c.type === "BATTERY"
      ? (c.batteryInfo?.modelNumber || "").toLowerCase()
      : (c.inverterInfo?.modelNumber || "").toLowerCase();
    const serial = c.type === "BATTERY"
      ? ((c.batteryInfo?.serialNumberBox || "") + " " + (c.batteryInfo?.serialNumberBattery || "")).toLowerCase()
      : ((c.inverterInfo?.serialNumberBox || "") + " " + (c.inverterInfo?.serialNumberInverter || "") + " " + (c.inverterInfo?.serialNumber || "")).toLowerCase();
    const checker = (c.checkedByName || "").toLowerCase();
    return no.includes(q) || model.includes(q) || serial.includes(q) || checker.includes(q);
  });

  return (
    <AppLayout title="Product Quality & Inspection Checklist">
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  Product Inspection Checklist
                </h1>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  QC Certified
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Technical inspection, functional parameter test verification &amp; letterhead report generator
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === "history"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Saved Reports ({savedChecklists.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeTab === "history" && !editingId) {
                  handleResetForm();
                }
                setActiveTab("form");
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === "form"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editingId ? "Edit Inspection" : "New Inspection Form"}</span>
            </button>
          </div>
        </div>

        {/* Floating Save / Action Popup Notification (Fixed in Viewport) */}
        {notification && (
          <div className="fixed top-6 right-6 z-[9999] max-w-md w-full sm:w-auto min-w-[320px] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-2xl backdrop-blur-md ${
                notification.type === "success"
                  ? "bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50"
                  : "bg-rose-950/95 border-rose-500/80 text-rose-200 shadow-rose-950/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {notification.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider">
                    {notification.type === "success" ? "Inspection Saved" : "Action Failed"}
                  </div>
                  <div className="text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">
                    {notification.text}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors -mr-1 -mt-1"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 1: FORM ================= */}
        {activeTab === "form" && (
          <div className="space-y-6">
            {/* Top Category Selector & Reference Number */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Select Product Category To Inspect *
                  </span>
                  <div className="inline-flex p-1 bg-slate-950 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTypeChange("BATTERY")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                        checklistType === "BATTERY"
                          ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <BatteryCharging className="w-4 h-4 text-teal-300" />
                      <span>Battery Unit Inspection</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange("INVERTER")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                        checklistType === "INVERTER"
                          ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>Inverter Unit Inspection</span>
                    </button>
                  </div>
                </div>

                {/* Checklist Reference Number */}
                <div className="w-full sm:w-64">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span>Checklist Ref No *</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        AUTO
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsNumberAutoLocked(!isNumberAutoLocked)}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                        title={isNumberAutoLocked ? "Unlock to customize number manually" : "Lock back to automated numbering"}
                      >
                        {isNumberAutoLocked ? (
                          <Lock className="w-3 h-3 text-teal-400" />
                        ) : (
                          <Unlock className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="text-[10px] font-medium">{isNumberAutoLocked ? "Auto" : "Custom"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fetchNextNumber(checklistType)}
                        disabled={isFetchingNo || !!editingId}
                        className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 disabled:opacity-50"
                        title="Sync next sequential number"
                      >
                        <RefreshCw className={`w-3 h-3 ${isFetchingNo ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={checklistNo}
                      readOnly={isNumberAutoLocked && !editingId}
                      onChange={(e) => {
                        setChecklistNo(e.target.value);
                        if (isNumberAutoLocked) setIsNumberAutoLocked(false);
                      }}
                      placeholder="e.g. QC-BAT-20261117-01"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs font-mono font-bold text-teal-300 focus:outline-none focus:border-teal-500 transition-colors ${
                        isNumberAutoLocked && !editingId
                          ? "border-teal-800/80 bg-teal-950/20 cursor-default"
                          : "border-slate-700 focus:border-teal-500"
                      }`}
                    />
                    {isFetchingNo && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400 absolute right-2.5 top-2.5" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isNumberAutoLocked && !editingId
                      ? "Automatically assigned sequentially based on product category & date."
                      : "Custom number active. Click 'Auto' to lock back to automatic sequence."}
                  </p>
                </div>
              </div>

              {/* Overall QC Status Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Overall Inspection Verification Status:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallQcPassed(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      overallQcPassed
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>PASSED &amp; CERTIFIED</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallQcPassed(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      !overallQcPassed
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>FAILED / DEFECTIVE</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ================= SECTION 1: PRODUCT INFORMATION ================= */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-bold text-xs">
                  1
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {checklistType === "BATTERY" ? "Battery Information" : "Inverter Information"}
                </h2>
              </div>

              {checklistType === "BATTERY" ? (
                /* BATTERY FIELDS */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Arrived Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Arrived Date *
                    </label>
                    <input
                      type="date"
                      value={batteryInfo.arrivedDate}
                      onChange={(e) => setBatteryInfo({ ...batteryInfo, arrivedDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Model Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Model Number *
                    </label>
                    <input
                      type="text"
                      value={batteryInfo.modelNumber}
                      onChange={(e) => setBatteryInfo({ ...batteryInfo, modelNumber: e.target.value })}
                      placeholder="e.g. LK-BAT-48100-PRO"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* MAC Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      MAC Address *
                    </label>
                    <input
                      type="text"
                      value={batteryInfo.macAddress}
                      onChange={(e) => setBatteryInfo({ ...batteryInfo, macAddress: e.target.value })}
                      placeholder="e.g. AA:BB:CC:DD:EE:FF"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Serial Number (Box) - Shown first */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Serial Number (Box) *
                    </label>
                    <input
                      type="text"
                      value={batteryInfo.serialNumberBox}
                      onChange={(e) => handleBoxSerialChange(e.target.value)}
                      placeholder="e.g. BX202611-00842"
                      className={`w-full bg-slate-950 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono transition-colors ${
                        hasBatterySerialMismatch
                          ? "border-2 border-amber-500 bg-amber-950/20 text-amber-200 focus:border-amber-400"
                          : "border border-slate-700 focus:border-teal-500"
                      }`}
                    />
                  </div>

                  {/* Serial Number (Battery) - Shown second */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-400">
                        Serial Number (Battery) *
                      </label>
                      {boxSerialManuallyDiverged ? (
                        <span className="text-[10px] text-amber-400 font-medium">Custom edited</span>
                      ) : (
                        <span className="text-[10px] text-teal-400 font-medium">Auto-syncs from box</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={batteryInfo.serialNumberBattery}
                      onChange={(e) => handleBatterySerialChange(e.target.value)}
                      placeholder="e.g. BAT202611-00842"
                      className={`w-full bg-slate-950 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono transition-colors ${
                        hasBatterySerialMismatch
                          ? "border-2 border-amber-500 bg-amber-950/20 text-amber-200 focus:border-amber-400"
                          : "border border-slate-700 focus:border-teal-500"
                      }`}
                    />
                  </div>

                  {hasBatterySerialMismatch && (
                    <div className="md:col-span-2 lg:col-span-3 p-3 rounded-xl bg-amber-950/50 border-2 border-amber-500/80 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>Serial Number Mismatch Detected</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">MISMATCH</span>
                        </div>
                        <div className="text-[11px] text-amber-200/90 mt-0.5">
                          Battery Serial (&ldquo;{batteryInfo.serialNumberBattery}&rdquo;) and Box Serial (&ldquo;{batteryInfo.serialNumberBox}&rdquo;) do not match.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Battery Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Battery Input *
                    </label>
                    <input
                      type="text"
                      value={batteryInfo.batteryInput}
                      onChange={(e) => setBatteryInfo({ ...batteryInfo, batteryInput: e.target.value })}
                      placeholder="e.g. 51.2V DC / 100Ah (16S LiFePO4)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Physical Damage */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Physical Damage Assessment *
                    </label>
                    <input
                      type="text"
                      value={batteryInfo.physicalDamage}
                      onChange={(e) => setBatteryInfo({ ...batteryInfo, physicalDamage: e.target.value })}
                      placeholder="None / No physical damage observed"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              ) : (
                /* INVERTER FIELDS */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Arrived Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Arrived Date *
                    </label>
                    <input
                      type="date"
                      value={inverterInfo.arrivedDate}
                      onChange={(e) => setInverterInfo({ ...inverterInfo, arrivedDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Model Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Model Number *
                    </label>
                    <input
                      type="text"
                      value={inverterInfo.modelNumber}
                      onChange={(e) => setInverterInfo({ ...inverterInfo, modelNumber: e.target.value })}
                      placeholder="e.g. Deye SUN-5K-SG03LP1"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Serial Number (Box) - Shown first */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Serial Number (Box) *
                    </label>
                    <input
                      type="text"
                      value={inverterInfo.serialNumberBox}
                      onChange={(e) => handleInverterBoxSerialChange(e.target.value)}
                      placeholder="e.g. BX-INV2410-983021"
                      className={`w-full bg-slate-950 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono transition-colors ${
                        hasInverterSerialMismatch
                          ? "border-2 border-amber-500 bg-amber-950/20 text-amber-200 focus:border-amber-400"
                          : "border border-slate-700 focus:border-teal-500"
                      }`}
                    />
                  </div>

                  {/* Serial Number (Inverter) - Shown second */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Serial Number (Inverter) *
                    </label>
                    <input
                      type="text"
                      value={inverterInfo.serialNumberInverter}
                      onChange={(e) => handleInverterSerialChange(e.target.value)}
                      placeholder="e.g. INV2410-983021"
                      className={`w-full bg-slate-950 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono transition-colors ${
                        hasInverterSerialMismatch
                          ? "border-2 border-amber-500 bg-amber-950/20 text-amber-200 focus:border-amber-400"
                          : "border border-slate-700 focus:border-teal-500"
                      }`}
                    />
                  </div>

                  {hasInverterSerialMismatch && (
                    <div className="md:col-span-2 lg:col-span-3 p-3 rounded-xl bg-amber-950/50 border-2 border-amber-500/80 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>Serial Number Mismatch Detected</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">MISMATCH</span>
                        </div>
                        <div className="text-[11px] text-amber-200/90 mt-0.5">
                          Inverter Serial (&ldquo;{inverterInfo.serialNumberInverter}&rdquo;) and Box Serial (&ldquo;{inverterInfo.serialNumberBox}&rdquo;) do not match.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Battery System */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Battery System *
                    </label>
                    <input
                      type="text"
                      value={inverterInfo.batterySystem}
                      onChange={(e) => setInverterInfo({ ...inverterInfo, batterySystem: e.target.value })}
                      placeholder="e.g. 48V DC Low Voltage / 40-60V"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Physical Damage */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Physical Damage Assessment *
                    </label>
                    <input
                      type="text"
                      value={inverterInfo.physicalDamage}
                      onChange={(e) => setInverterInfo({ ...inverterInfo, physicalDamage: e.target.value })}
                      placeholder="None / No physical damage observed"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ================= SECTION 2: TEST & INSPECTION CHECKLIST ================= */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-bold text-xs">
                    2
                  </span>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Testing &amp; Functional Inspection Checklist
                  </h2>
                </div>

                {/* Checked Date */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span>Checked Date:</span>
                  </label>
                  <input
                    type="date"
                    value={checkedDate}
                    onChange={(e) => setCheckedDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Checklist Items Table */}
              <div className="space-y-3">
                {tests.map((test, idx) => (
                  <div
                    key={test.id || test.key}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3 transition-colors hover:border-slate-700"
                  >
                    {/* Tick box & Label */}
                    <div className="flex items-center gap-3 w-full md:w-64 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTest(idx)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                          test.passed
                            ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                            : "bg-slate-900 border-rose-500/80 text-rose-400"
                        }`}
                        title={test.passed ? "Mark as Failed" : "Mark as Passed"}
                      >
                        {test.passed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </button>

                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{test.label}</span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              test.passed
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/80"
                                : "bg-rose-950 text-rose-400 border border-rose-800/80"
                            }`}
                          >
                            {test.passed ? "PASSED" : "FAILED"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Parameter {idx + 1}
                        </span>
                      </div>
                    </div>

                    {/* Comment input */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={test.comment}
                        onChange={(e) => handleTestCommentChange(idx, e.target.value)}
                        placeholder="Add technical observation / test value comment..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ================= SECTION 3: INSPECTED BY NAME ================= */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-bold text-xs">
                  3
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Inspector Sign-off &amp; Verification
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-400" />
                    <span>Checked By (Inspector / Technician Name) *</span>
                  </label>
                  <input
                    type="text"
                    value={checkedByName}
                    onChange={(e) => setCheckedByName(e.target.value)}
                    placeholder="e.g. Kasun Perera (Senior R&D QC Engineer)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>Inspector Designation / Department *</span>
                  </label>
                  <input
                    type="text"
                    value={checkedByDesignation}
                    onChange={(e) => setCheckedByDesignation(e.target.value)}
                    placeholder="e.g. Quality Control & Hardware Testing Division"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* ================= SECTION 4: ADDITIONAL NOTES BOX ================= */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 font-bold text-xs">
                    4
                  </span>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Additional Notes &amp; Special Observations
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400">
                  Custom formatting: Highlight, Bold &amp; Colors
                </span>
              </div>

              {/* Note creator bar */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    placeholder="Type note observation and press Enter or click Add Note..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Bold Toggle */}
                    <button
                      type="button"
                      onClick={() => setNewNoteBold(!newNoteBold)}
                      className={`p-2 rounded-lg border text-xs font-bold transition-colors ${
                        newNoteBold
                          ? "bg-teal-600 text-white border-teal-500"
                          : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                      }`}
                      title="Toggle Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>

                    {/* Highlight Toggle */}
                    <button
                      type="button"
                      onClick={() => setNewNoteHighlight(!newNoteHighlight)}
                      className={`p-2 rounded-lg border text-xs font-bold transition-colors ${
                        newNoteHighlight
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                      }`}
                      title="Toggle Yellow Highlight"
                    >
                      <Highlighter className="w-3.5 h-3.5" />
                    </button>

                    {/* Color Selector */}
                    <select
                      value={newNoteColor}
                      onChange={(e) => setNewNoteColor(e.target.value as NoteColor)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-medium"
                    >
                      <option value="default">Default Text</option>
                      <option value="teal">Teal Tag</option>
                      <option value="green">Green (OK)</option>
                      <option value="blue">Blue (Info)</option>
                      <option value="amber">Amber (Warning)</option>
                      <option value="red">Red (Critical)</option>
                    </select>

                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium">Quick suggestions:</span>
                  {[
                    "All terminal bolts torqued to manufacturer specifications",
                    "Firmware upgraded to latest stable release",
                    "Tamper-proof warranty seal affixed on side casing",
                    "Tested under continuous rated load for 4 hours without thermal throttling",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const item: ChecklistNoteItem = {
                          id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                          text: preset,
                          bold: false,
                          highlight: false,
                          color: "teal",
                        };
                        setNotes((prev) => [...prev, item]);
                      }}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-teal-300 border border-slate-800 rounded-md px-2 py-0.5 transition-colors"
                    >
                      + {preset.slice(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Rendered Notes List */}
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <div className="text-center py-5 bg-slate-950/40 border border-slate-800/60 rounded-xl text-xs text-slate-500 italic">
                    No additional observations added. Type above and click Add Note.
                  </div>
                ) : (
                  notes.map((note) => {
                    const colorClasses = {
                      default: "text-slate-200",
                      teal: "text-teal-400",
                      blue: "text-blue-400",
                      green: "text-emerald-400",
                      amber: "text-amber-400",
                      red: "text-rose-400",
                    }[note.color || "default"];

                    return (
                      <div
                        key={note.id}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all ${
                          note.highlight
                            ? "bg-amber-500/20 border-amber-500/40"
                            : "bg-slate-950/60 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              note.color === "red"
                                ? "bg-rose-500"
                                : note.color === "amber"
                                ? "bg-amber-500"
                                : note.color === "green"
                                ? "bg-emerald-500"
                                : note.color === "blue"
                                ? "bg-blue-500"
                                : "bg-teal-500"
                            }`}
                          />
                          <span
                            className={`text-xs ${note.bold ? "font-bold" : "font-normal"} ${colorClasses}`}
                          >
                            {note.text}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveNote(note.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                          title="Remove note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ================= ACTION BUTTONS BAR ================= */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 sticky bottom-4 shadow-xl shadow-slate-950/50 backdrop-blur-md">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset / Clear Form
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-800/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                  title="Save checklist (auto-draft if partially filled, certified if complete)"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  ) : (
                    <Save className="w-4 h-4 text-teal-400" />
                  )}
                  <span>Save Inspection</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  disabled={isGeneratingPdf || status === "DRAFT"}
                  title={status === "DRAFT" ? "Draft checklist cannot be downloaded. Please save and certify first." : "Download Letterhead PDF"}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                    status === "DRAFT"
                      ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                      : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-teal-900/30 disabled:opacity-50"
                  }`}
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>Download Letterhead PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: HISTORY ================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Checklist No, Model, Serial, or Inspector..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="ALL">All Categories</option>
                  <option value="BATTERY">Battery Only</option>
                  <option value="INVERTER">Inverter Only</option>
                </select>

                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    setActiveTab("form");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Inspection</span>
                </button>
              </div>
            </div>

            {/* List / Cards */}
            {isLoadingHistory ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mb-2" />
                <span>Loading inspection history...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-3">
                <ClipboardCheck className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">No Inspection Records Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery
                    ? "No inspection reports matched your search filters."
                    : "Create your first Battery or Inverter checklist by clicking 'New Inspection Form' above."}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold transition-colors mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Inspection</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((item) => {
                  const isBat = item.type === "BATTERY";
                  const modelNo = isBat
                    ? item.batteryInfo?.modelNumber || "N/A"
                    : item.inverterInfo?.modelNumber || "N/A";
                  const boxSerial = isBat
                    ? item.batteryInfo?.serialNumberBox || "N/A"
                    : item.inverterInfo?.serialNumberBox || "N/A";
                  const deviceSerial = isBat
                    ? item.batteryInfo?.serialNumberBattery || "N/A"
                    : item.inverterInfo?.serialNumberInverter || item.inverterInfo?.serialNumber || "N/A";
                  const deviceLabel = isBat ? "Battery" : "Inverter";
                  const arrivedDate = isBat
                    ? item.batteryInfo?.arrivedDate || "-"
                    : item.inverterInfo?.arrivedDate || "-";

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            isBat
                              ? "bg-teal-500/10 border-teal-500/20 text-teal-400"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          }`}
                        >
                          {isBat ? <BatteryCharging className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-white">
                              {item.checklistNo}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isBat
                                  ? "bg-teal-950 text-teal-400 border border-teal-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              {isBat ? "BATTERY" : "INVERTER"}
                            </span>
                            {item.status === "DRAFT" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                                DRAFT
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.overallQcPassed
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                    : "bg-rose-950 text-rose-400 border border-rose-800"
                                }`}
                              >
                                {item.overallQcPassed ? "✔ PASSED" : "✖ FAILED"}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-300 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>Model: <span className="font-mono text-white font-semibold">{modelNo}</span></span>
                            <span className="text-slate-600">•</span>
                            <span>Serial Number (Box): <span className="font-mono text-teal-300 font-semibold">{boxSerial}</span></span>
                            <span className="text-slate-600">•</span>
                            <span>Serial Number ({deviceLabel}): <span className="font-mono text-slate-200 font-semibold">{deviceSerial}</span></span>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Arrived: {arrivedDate} • Checked: {item.checkedDate} • Inspector: {item.checkedByName}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.status === "DRAFT") {
                              showNotification("error", `Draft checklist "${item.checklistNo}" cannot be downloaded. Please edit and certify it first.`);
                              return;
                            }
                            handleDownloadPdf(item);
                          }}
                          disabled={item.status === "DRAFT"}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            item.status === "DRAFT"
                              ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed opacity-40"
                              : "bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-800/60"
                          }`}
                          title={item.status === "DRAFT" ? "Draft inspection cannot be downloaded. Please certify first." : "Download official PDF"}
                        >
                          <FileDown className="w-3.5 h-3.5 text-teal-400" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadForEdit(item)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          title="Edit checklist"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.checklistNo)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

