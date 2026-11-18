"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/AppLayout";
import {
  ProductHandoverData,
  printHandoverLetter,
  downloadHandoverLetter,
} from "@/lib/handoverPdfGenerator";
import { ProductChecklist } from "@/lib/productChecklist";
import {
  FileText,
  Printer,
  FileDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  UserCheck,
  ShieldCheck,
  Plus,
  Search,
  Edit3,
  Trash2,
  Save,
  Lock,
  Unlock,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function ProductHandoverPage() {
  const { data: session } = useSession();

  // Active Tab: "history" (Saved Handover Letters by default) or "form"
  const [activeTab, setActiveTab] = useState<"history" | "form">("history");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refNo, setRefNo] = useState<string>("");
  const [isRefNoAutoLocked, setIsRefNoAutoLocked] = useState(true);
  const [isFetchingRefNo, setIsFetchingRefNo] = useState(false);

  const [productName, setProductName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");
  const [quantity, setQuantity] = useState("1 Unit");

  const [collectorName, setCollectorName] = useState("");
  const [collectorDesignation, setCollectorDesignation] = useState("Quality Control & Hardware Engineer");
  const [handoverDate, setHandoverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [contactNumber, setContactNumber] = useState("+94 76 357 31 31");
  const [confirmationText, setConfirmationText] = useState(
    "The undersigned hereby confirms that the above-mentioned product(s) have been received for our internal inspection and evaluation. We acknowledge responsibility for the safekeeping and handling of the products from the date stated below."
  );

  // History State
  const [savedHandovers, setSavedHandovers] = useState<ProductHandoverData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Optional: Saved QC Checklists for fast pre-fill
  const [savedChecklists, setSavedChecklists] = useState<ProductChecklist[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch next sequential reference number
  const fetchNextRefNo = async () => {
    if (editingId) return;
    setIsFetchingRefNo(true);
    try {
      const res = await fetch("/api/handovers/next-number");
      if (res.ok) {
        const d = await res.json();
        if (d.nextNo) setRefNo(d.nextNo);
      }
    } catch (err) {
      console.error("Error fetching handover next number:", err);
    } finally {
      setIsFetchingRefNo(false);
    }
  };

  // Fetch saved handover letters from database
  const fetchHandovers = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/handovers");
      if (res.ok) {
        const d = await res.json();
        setSavedHandovers(d.handovers || []);
      }
    } catch (err) {
      console.error("Error fetching handover letters:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch QC checklists for optional pre-fill dropdown
  const fetchQcChecklists = async () => {
    try {
      const res = await fetch("/api/checklists");
      if (res.ok) {
        const d = await res.json();
        setSavedChecklists(d.checklists || []);
      }
    } catch {}
  };

  // On mount
  useEffect(() => {
    fetchHandovers();
    fetchNextRefNo();
    fetchQcChecklists();
  }, []);

  // Initialize collector name with active user
  useEffect(() => {
    if (!collectorName && session?.user?.name) {
      setCollectorName(session.user.name);
    }
  }, [session, collectorName]);

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  // Build current form data object
  const buildCurrentData = (): ProductHandoverData => ({
    id: editingId || undefined,
    refNo: refNo.trim() || undefined,
    productName: productName.trim(),
    modelDescription: modelDescription.trim(),
    serialNumbers: serialNumbers.trim(),
    quantity: quantity.trim() || "1 Unit",
    collectorName: collectorName.trim(),
    collectorDesignation: collectorDesignation.trim(),
    handoverDate: handoverDate || new Date().toISOString().split("T")[0],
    contactNumber: contactNumber.trim() || "+94 76 357 31 31",
    confirmationText: confirmationText.trim(),
  });

  // Save Handover Letter to Database
  const handleSave = async () => {
    if (!productName.trim() && !modelDescription.trim()) {
      showNotification("error", "Please provide a Product Name or Model Description");
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildCurrentData();
      const res = await fetch("/api/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const d = await res.json();
        showNotification(
          "success",
          editingId
            ? `Handover letter ${d.handover.refNo} updated successfully`
            : `Handover letter ${d.handover.refNo} saved to database`
        );
        await fetchHandovers();
        // Keep user on the same page with saved record loaded
        if (!editingId && d.handover?.id) {
          setEditingId(d.handover.id);
        }
      } else {
        const err = await res.json();
        showNotification("error", err?.error || "Failed to save handover letter");
      }
    } catch (err) {
      console.error("Save error:", err);
      showNotification("error", "Error saving handover letter");
    } finally {
      setIsSaving(false);
    }
  };

  // Direct 1-Click Print
  const handleDirectPrint = async (customData?: ProductHandoverData) => {
    setIsPrinting(true);
    try {
      const data = customData || buildCurrentData();
      await printHandoverLetter(data);
      showNotification("success", "Opened direct print dialog for Handover Letter");
    } catch (err) {
      console.error("Print error:", err);
      showNotification("error", "Failed to start direct print");
    } finally {
      setIsPrinting(false);
    }
  };

  // Direct 1-Click Download PDF
  const handleDirectDownload = async (customData?: ProductHandoverData) => {
    setIsDownloading(true);
    try {
      const data = customData || buildCurrentData();
      await downloadHandoverLetter(data);
      showNotification("success", "Handover Letter PDF downloaded");
    } catch (err) {
      console.error("Download error:", err);
      showNotification("error", "Failed to download Handover Letter PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  // Load an existing saved handover letter into form for editing
  const handleLoadForEdit = (item: ProductHandoverData) => {
    setEditingId(item.id || null);
    setRefNo(item.refNo || "");
    setProductName(item.productName || "");
    setModelDescription(item.modelDescription || "");
    setSerialNumbers(item.serialNumbers || "");
    setQuantity(String(item.quantity || "1 Unit"));
    setCollectorName(item.collectorName || "");
    setCollectorDesignation(item.collectorDesignation || "Quality Control & Hardware Engineer");
    setHandoverDate(item.handoverDate || new Date().toISOString().split("T")[0]);
    setContactNumber(item.contactNumber || "+94 76 357 31 31");
    if (item.confirmationText) setConfirmationText(item.confirmationText);
    setActiveTab("form");
    showNotification("success", `Loaded ${item.refNo || "record"} for editing`);
  };

  // Delete a saved handover letter
  const handleDelete = async (id: string | undefined, ref: string | undefined) => {
    if (!id) return;
    if (!confirm(`Are you sure you want to delete handover letter ${ref || "this record"}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/handovers/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification("success", `Deleted ${ref || "handover letter"}`);
        fetchHandovers();
      } else {
        showNotification("error", "Failed to delete handover letter");
      }
    } catch {
      showNotification("error", "Error deleting handover letter");
    }
  };

  // Reset form to blank / new
  const handleResetForm = () => {
    setEditingId(null);
    setSelectedChecklistId("");
    setProductName("");
    setModelDescription("");
    setSerialNumbers("");
    setQuantity("1 Unit");
    setCollectorName(session?.user?.name || "");
    setCollectorDesignation("Quality Control & Hardware Engineer");
    setHandoverDate(new Date().toISOString().split("T")[0]);
    setContactNumber("+94 76 357 31 31");
    setConfirmationText(
      "The undersigned hereby confirms that the above-mentioned product(s) have been received for our internal inspection and evaluation. We acknowledge responsibility for the safekeeping and handling of the products from the date stated below."
    );
    fetchNextRefNo();
  };

  // Reset to empty blank sheet (for manual field clipboard use)
  const handleResetBlank = () => {
    setEditingId(null);
    setSelectedChecklistId("");
    setProductName("");
    setModelDescription("");
    setSerialNumbers("");
    setQuantity("");
    setCollectorName("");
    setCollectorDesignation("");
    setHandoverDate(new Date().toISOString().split("T")[0]);
    setContactNumber("");
    showNotification("success", "Form reset to blank sheet template");
  };

  // Pre-fill from QC Inspection
  const handlePreFillFromChecklist = (id: string) => {
    setSelectedChecklistId(id);
    const item = savedChecklists.find((c) => c.id === id);
    if (!item) return;

    const isBat = item.type === "BATTERY";
    const modelNo = isBat
      ? item.batteryInfo?.modelNumber || ""
      : item.inverterInfo?.modelNumber || "";
    const serialNo = isBat
      ? item.batteryInfo?.serialNumberBattery || item.batteryInfo?.serialNumberBox || ""
      : item.inverterInfo?.serialNumber || "";
    const prodName = isBat
      ? "LK Tronics Lithium Iron Phosphate (LiFePO4) Battery Pack"
      : "LK Tronics Solar Hybrid Power Inverter";

    const arrivedDate = isBat
      ? item.batteryInfo?.arrivedDate
      : item.inverterInfo?.arrivedDate;

    setProductName(prodName);
    setModelDescription(modelNo);
    setSerialNumbers(serialNo);
    setQuantity("1 Unit");
    if (item.checkedByName) setCollectorName(item.checkedByName);
    if (item.checkedByDesignation) setCollectorDesignation(item.checkedByDesignation);
    if (arrivedDate || item.checkedDate) setHandoverDate(arrivedDate || item.checkedDate);
    showNotification("success", `Pre-filled product info from ${item.checklistNo}`);
  };

  // Filter history items
  const filteredHandovers = savedHandovers.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const ref = (h.refNo || "").toLowerCase();
    const prod = (h.productName || "").toLowerCase();
    const model = (h.modelDescription || "").toLowerCase();
    const serial = (h.serialNumbers || "").toLowerCase();
    const collector = (h.collectorName || "").toLowerCase();
    return (
      ref.includes(q) ||
      prod.includes(q) ||
      model.includes(q) ||
      serial.includes(q) ||
      collector.includes(q)
    );
  });

  return (
    <AppLayout title="Product Handover Letter">
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  Product Handover Letters
                </h1>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Official Intake
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage, save, preview, direct print, and download official LK Tronics product handover letters
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
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Saved Letters ({savedHandovers.length})</span>
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
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editingId ? "Edit Letter" : "New Handover Letter"}</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 ${
              notification.type === "success"
                ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
                : "bg-rose-950/70 border-rose-800 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================= TAB 1: SAVED HANDOVER LETTERS ================= */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Ref No, Product Name, Model, Serial, or Collector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchHandovers}
                  disabled={isLoadingHistory}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    setActiveTab("form");
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Letter</span>
                </button>
              </div>
            </div>

            {/* List of Saved Letters */}
            {isLoadingHistory ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading saved handover letters...</p>
              </div>
            ) : filteredHandovers.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-slate-300 text-sm font-semibold">
                  {searchQuery ? "No matching handover letters found" : "No handover letters saved yet"}
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery
                    ? "Try adjusting your search criteria"
                    : "Create and save an official product handover letter to keep an organized history."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    setActiveTab("form");
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Handover Letter</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHandovers.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-amber-500/10 border-amber-500/20 text-amber-400">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-white">
                            {item.refNo || "HL-DOC"}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                            HANDOVER LETTER
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 font-medium mt-1">
                          Product: <span className="font-semibold text-white">{item.productName || "Product"}</span>
                          {item.modelDescription && (
                            <>
                              {" "}• Model: <span className="font-mono text-white">{item.modelDescription}</span>
                            </>
                          )}
                          {item.serialNumbers && (
                            <>
                              {" "}• Serial: <span className="font-mono text-slate-300">{item.serialNumbers}</span>
                            </>
                          )}
                          {item.quantity && (
                            <>
                              {" "}• Qty: <span className="text-amber-300">{item.quantity}</span>
                            </>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Date: {item.handoverDate || "-"} • Collector: {item.collectorName || "-"} ({item.collectorDesignation || "Engineer"})
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      <button
                        type="button"
                        onClick={() => handleDirectPrint(item)}
                        disabled={isPrinting}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-800/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Direct 1-click print"
                      >
                        <Printer className="w-3.5 h-3.5 text-teal-400" />
                        <span>Print</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDirectDownload(item)}
                        disabled={isDownloading}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Download PDF file"
                      >
                        <FileDown className="w-3.5 h-3.5 text-amber-400" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadForEdit(item)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Edit handover letter"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.refNo)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: EDIT / NEW HANDOVER LETTER ================= */}
        {activeTab === "form" && (
          <div className="space-y-6">
            {/* Top Toolbar Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">
                    {editingId ? "Edit Handover Letter" : "New Product Handover Letter"}
                  </h2>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {editingId ? "Editing" : "Drafting"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Fill details, preview in real time, and save to database or print directly.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Pre-fill dropdown */}
                {savedChecklists.length > 0 && (
                  <select
                    aria-label="Pre-fill Handover from Saved Inspection"
                    value={selectedChecklistId}
                    onChange={(e) => handlePreFillFromChecklist(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Pre-fill from QC inspection (optional)...</option>
                    {savedChecklists.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.checklistNo} ({c.type})
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleResetBlank}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Clear all fields for blank sheet"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Blank Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  title="Save record to database"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{editingId ? "Update Letter" : "Save Letter"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectPrint()}
                  disabled={isPrinting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  title="Direct 1-click print"
                >
                  {isPrinting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>Direct Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectDownload()}
                  disabled={isDownloading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  title="Download official PDF file"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Main Form & Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Form Controls (Left) */}
              <div className="lg:col-span-5 space-y-5">
                {/* Reference Number Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Reference Number *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsRefNoAutoLocked(!isRefNoAutoLocked)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {isRefNoAutoLocked ? (
                        <>
                          <Lock className="w-3 h-3 text-teal-400" />
                          <span>Locked</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3 text-amber-400" />
                          <span>Editable</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={refNo}
                      onChange={(e) => setRefNo(e.target.value)}
                      readOnly={isRefNoAutoLocked}
                      placeholder="e.g. HL-20261117-01"
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none ${
                        isRefNoAutoLocked
                          ? "border-slate-800 text-slate-400 cursor-not-allowed"
                          : "border-amber-500 text-white"
                      }`}
                    />
                    {isFetchingRefNo && (
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                {/* 1. Product Details Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
                      Product Details
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Lithium Iron Phosphate Battery Pack"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Model / Description
                    </label>
                    <input
                      type="text"
                      value={modelDescription}
                      onChange={(e) => setModelDescription(e.target.value)}
                      placeholder="e.g. LK-BAT-51.2V-100AH"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Serial Number(s)
                    </label>
                    <input
                      type="text"
                      value={serialNumbers}
                      onChange={(e) => setSerialNumbers(e.target.value)}
                      placeholder="e.g. BAT202611-00812"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Quantity
                    </label>
                    <input
                      type="text"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g. 1 Unit"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 2. LK TRONICS Collector's Details Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      LK TRONICS Collector&apos;s Details
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Collector Name
                    </label>
                    <input
                      type="text"
                      value={collectorName}
                      onChange={(e) => setCollectorName(e.target.value)}
                      placeholder="e.g. Eng. Kasun Bandara"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={collectorDesignation}
                      onChange={(e) => setCollectorDesignation(e.target.value)}
                      placeholder="e.g. Quality Control & Hardware Engineer"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Handover Date
                      </label>
                      <input
                        type="date"
                        value={handoverDate}
                        onChange={(e) => setHandoverDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="+94 76 357 31 31"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Handover Confirmation Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center">
                      4
                    </span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Handover Confirmation Statement
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Official Statement
                    </label>
                    <textarea
                      rows={3}
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Live WYSIWYG Document Sheet Preview (Right) */}
              <div className="lg:col-span-7">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      Live Document Sheet Preview (A4 Page 1)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDirectPrint()}
                        disabled={isPrinting}
                        className="px-2.5 py-1 bg-teal-950 hover:bg-teal-900 text-teal-300 border border-teal-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectDownload()}
                        disabled={isDownloading}
                        className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <FileDown className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Physical White Paper Rendering */}
                  <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 shadow-2xl border border-slate-300 font-sans space-y-5 select-none">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-slate-900">
                      {/* Left: Logo */}
                      <div className="text-center w-20 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/template_assets/logos/footer/lk_tronics.png"
                          alt="LK Tronics"
                          className="w-12 h-12 mx-auto object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="text-[6.5px] font-bold text-slate-600 mt-0.5 tracking-tight uppercase">
                          Components for the future
                        </div>
                      </div>

                      {/* Beside Logo: LK TRONICS & Contacts */}
                      <div className="text-left flex-1 pl-2">
                        <div className="text-sm font-black text-slate-900 tracking-tight">
                          LK TRONICS
                        </div>
                        <div className="text-[10px] text-slate-700 mt-0.5 leading-snug">
                          <div><span className="font-semibold">Tele &nbsp;&nbsp;:</span> +94 76 357 31 31 | 011 4 215 515</div>
                          <div><span className="font-semibold">E mail :</span> admin@lk-tronics.com | sales@lk-tronics.com</div>
                        </div>
                      </div>

                      {/* Right: Reg & Web */}
                      <div className="text-right text-[10px] text-slate-700 leading-snug shrink-0">
                        <div><span className="font-semibold">Web :</span> www.lk-tronics.com</div>
                        <div className="font-semibold text-slate-900 mt-0.5">Reg No : P-V 00336036</div>
                      </div>
                    </div>

                    {/* Quotation Style Teal Address Bar */}
                    <div className="bg-[#4a9098] text-white px-3 py-1 rounded flex items-center justify-between text-[9px] font-bold tracking-tight">
                      <span>LK TRONICS, HIGH-LEVEL ROAD, HOMAGAMA, SRI LANKA.</span>
                      <span>TEL : 011 4 215 515 | REG NO - P-V 00336036</span>
                    </div>

                    {refNo && (
                      <div className="text-right text-[10px] font-mono font-bold text-slate-500 pt-1">
                        Ref: {refNo}
                      </div>
                    )}

                    {/* Document Title */}
                    <div className="text-center py-1">
                      <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                        Product Handover Letter
                      </h1>
                    </div>

                    {/* Preamble */}
                    <p className="text-[11px] text-slate-800 leading-relaxed text-justify">
                      We hereby confirm that the following product(s) have been received and accepted for our internal inspection and evaluation process. These items will be reviewed accordingly by our team to verify specifications, condition, and compliance with our requirements.
                    </p>

                    {/* 1. Product Details */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-bold text-slate-900">
                        1. Product Details
                      </div>
                      <div className="pl-4 space-y-1 text-[11px] text-slate-800">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Product Name:</span>
                          <span className={productName ? "font-medium" : "border-b border-slate-400 flex-1 min-h-[14px]"}>
                            {productName || ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Model / Description:</span>
                          <span className={modelDescription ? "font-medium font-mono" : "border-b border-slate-400 flex-1 min-h-[14px]"}>
                            {modelDescription || ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Serial Number(s):</span>
                          <span className={serialNumbers ? "font-medium font-mono" : "border-b border-slate-400 flex-1 min-h-[14px]"}>
                            {serialNumbers || ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Quantity:</span>
                          <span className={quantity ? "font-medium" : "border-b border-slate-400 w-32 min-h-[14px]"}>
                            {quantity || ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. LK TRONICS Collector's Details */}
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[11px] font-bold text-slate-900">
                        2. LK TRONICS Collector&apos;s Details
                      </div>
                      <div className="pl-4 space-y-1 text-[11px] text-slate-800">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Name:</span>
                          <span className={collectorName ? "font-medium" : "border-b border-slate-400 flex-1 min-h-[14px]"}>
                            {collectorName || ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Designation:</span>
                          <span className={collectorDesignation ? "font-medium" : "border-b border-slate-400 flex-1 min-h-[14px]"}>
                            {collectorDesignation || ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Date:</span>
                          <span className={handoverDate ? "font-medium font-mono" : "border-b border-slate-400 w-44 min-h-[14px]"}>
                            {handoverDate || ""}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">• Contact number:</span>
                          <span className={contactNumber ? "font-medium font-mono" : "border-b border-slate-400 w-52 min-h-[14px]"}>
                            {contactNumber || ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Handover Confirmation */}
                    <div className="space-y-1 pt-3">
                      <div className="text-[11px] font-bold text-slate-900">
                        4. Handover Confirmation
                      </div>
                      <p className="text-[10.5px] text-slate-800 leading-relaxed text-justify">
                        {confirmationText ||
                          "The undersigned hereby confirms that the above-mentioned product(s) have been received for our internal inspection and evaluation. We acknowledge responsibility for the safekeeping and handling of the products from the date stated below."}
                      </p>
                    </div>

                    {/* Signatures Area */}
                    <div className="pt-10 flex items-end justify-between">
                      <div className="text-left">
                        <div className="w-44 border-b border-slate-800 mb-1.5" />
                        <div className="text-[11px] font-bold text-slate-900">
                          Signature of Collector
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[11px] font-mono font-bold text-slate-900 mb-1">
                          {handoverDate || new Date().toISOString().split("T")[0]}
                        </div>
                        <div className="w-32 border-b border-slate-800 mb-1.5" />
                        <div className="text-[11px] font-bold text-slate-900">
                          Date
                        </div>
                      </div>
                    </div>

                    {/* Bottom Page Number */}
                    <div className="text-center pt-6 text-[10px] text-slate-500 font-medium">
                      1
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
