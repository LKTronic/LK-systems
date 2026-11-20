"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { formatLKR } from "@/lib/formatters";
import {
  generateRdQuotationPdf,
  RdQuotationPdfData,
} from "@/lib/rdQuotationPdfGenerator";
import {
  RdQuotationType,
  DEFAULT_THREE_D_PRINT_SPECS,
  DEFAULT_PCB_SPECS,
  DEFAULT_THREE_D_PRINT_TERMS,
  DEFAULT_PCB_TERMS,
  DEFAULT_PROJECT_PROPOSAL_TERMS,
  DEFAULT_PROJECT_PROPOSAL_INTRO,
  DEFAULT_PROJECT_PROPOSAL_HARDWARE,
  DEFAULT_PROJECT_PROPOSAL_SERVICES,
  DEFAULT_UNI_QUOTATION_SPECS,
  DEFAULT_UNI_QUOTATION_GENERAL_TERMS,
  getUniQuotationTerms,
  getProjectProposalTerms,
  LK_TRONICS_BANK_DETAILS,
  calculate3DPrintPrice,
  MATERIAL_DENSITIES,
  getMaterialDensity,
} from "@/lib/rdQuotationDefaults";
import {
  FlaskConical,
  Calendar,
  CreditCard,
  UserCheck,
  Building,
  Plus,
  Trash2,
  Download,
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  Percent,
  Layers,
  Printer,
  Cpu,
  Lightbulb,
  GraduationCap,
  Clock,
  Shield,
  FileText,
  Wrench,
  HelpCircle,
  Upload,
  X,
  Sparkles,
  ImageIcon,
  Bold,
  Underline,
  Highlighter,
  List,
  ListOrdered,
  Type,
  AlertTriangle,
  Landmark,
  Calculator,
  Edit3,
  Copy,
} from "lucide-react";
import { BankAccountsModal } from "@/components/rad/BankAccountsModal";
import { BankAccount } from "@/lib/bankAccounts";

export interface ProposalSetItem {
  id: string;
  productOrService: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  itemType: "HARDWARE" | "SERVICE";
}

export interface ProposalSetData {
  id: string;
  title: string;
  leadTime: string;
  warranty: string;
  systemDesignImages: string[];
  hardwareItems: ProposalSetItem[];
  serviceItems: ProposalSetItem[];
  hardwareTotal: string;
  servicesTotal: string;
  commercialNote: string;
}

interface ItemRow {
  id: string;
  itemType: "HARDWARE" | "SERVICE";
  productOrService: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  image?: string;
  calcMode?: "MANUAL" | "AUTO";
  material?: string;
  filamentLengthM?: number | string;
  printTimeMinutes?: number | string;
  printTimeHours?: number | string;
}

interface ProductSearchResult {
  id: number;
  recordNo: string;
  sku?: string | null;
  productName: string;
  priceLKR: number | string | null;
}

function CreateRadQuotationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  // Quotation Type
  const initialType = (searchParams.get("type") as RdQuotationType) || "PROJECT_PROPOSAL";
  const [quotationType, setQuotationType] = useState<RdQuotationType>(initialType);

  useEffect(() => {
    const t = searchParams.get("type") as RdQuotationType | null;
    if (
      t &&
      (t === "PROJECT_PROPOSAL" ||
        t === "THREE_D_PRINT" ||
        t === "PCB" ||
        t === "UNI_QUOTATION") &&
      t !== quotationType
    ) {
      setQuotationType(t);
    }
  }, [searchParams, quotationType]);

  const getInitialQuotationNo = (type: RdQuotationType) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const pfx =
      type === "PROJECT_PROPOSAL" || type === "UNI_QUOTATION" ? "PQV" : "QV";
    return `${yyyy}${mm}${dd}${pfx}1`;
  };

  // Common Header Fields
  const [registrationNo, setRegistrationNo] = useState("P-V 00336036");
  const [quotationStatus, setQuotationStatus] = useState<"DRAFT" | "COMPLETED">("COMPLETED");
  const [quotationNo, setQuotationNo] = useState<string>(() => getInitialQuotationNo(initialType));
  const [unfilledFields, setUnfilledFields] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setUnfilledFields((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const [preparedDate, setPreparedDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [validityDays, setValidityDays] = useState<number | string>(5);
  const [paymentMethod, setPaymentMethod] = useState("ADVANCE_PAYMENT");
  const [advancePercent, setAdvancePercent] = useState<number | string>(80);
  const [preparedBy, setPreparedBy] = useState("");
  const [quotationTo, setQuotationTo] = useState("");

  // Project Proposal Specific Fields & Paired Sets (Slides 3 & 4 Repeater)
  const [activeProposalTab, setActiveProposalTab] = useState<number>(1);
  const [projectTitle, setProjectTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [overviewTab, setOverviewTab] = useState<"write" | "preview">("write");
  const [overviewFontSize, setOverviewFontSize] = useState<string>("22.0");
  const [termsFontSize, setTermsFontSize] = useState<string>("22.0");
  const [termsTab, setTermsTab] = useState<"write" | "preview">("write");
  const [commercialNoteTab, setCommercialNoteTab] = useState<"write" | "preview">("write");
  const [isUploadingDesignImages, setIsUploadingDesignImages] = useState(false);
  const [targetSetItemId, setTargetSetItemId] = useState<string | null>(null);

  const [proposalSets, setProposalSets] = useState<ProposalSetData[]>([
    {
      id: "set-1",
      title: "Set 1",
      leadTime: "10 Working Days",
      warranty: "1 Year",
      systemDesignImages: [],
      hardwareItems: DEFAULT_PROJECT_PROPOSAL_HARDWARE.map((it, idx) => ({
        ...it,
        id: `hw-init-${idx}`,
        itemType: "HARDWARE" as const,
      })),
      serviceItems: DEFAULT_PROJECT_PROPOSAL_SERVICES.map((it, idx) => ({
        ...it,
        id: `srv-init-${idx}`,
        itemType: "SERVICE" as const,
      })),
      hardwareTotal: "286440.00",
      servicesTotal: "65160.00",
      commercialNote: "",
    },
  ]);
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);

  // Fallback state variables for backward compatibility
  const [commercialNote, setCommercialNote] = useState<string>("");
  const [leadTime, setLeadTime] = useState("10 Working Days");
  const [warranty, setWarranty] = useState("1 Year");
  const [systemDesignImages, setSystemDesignImages] = useState<string[]>([]);
  const [customHardwareTotal, setCustomHardwareTotal] = useState<string>("");
  const [customServicesTotal, setCustomServicesTotal] = useState<string>("");


  // Uni Quotation Specific Fields
  const [engineeringCharges, setEngineeringCharges] = useState<number | string>("");
  const [discount, setDiscount] = useState<number | string>("");
  const [uniCompletionTime, setUniCompletionTime] = useState<string>("");

  // Bank Accounts Management & Selection
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [showBankModal, setShowBankModal] = useState<boolean>(false);

  // Technical Specs for 3D Print
  const [printSpecs, setPrintSpecs] = useState({ ...DEFAULT_THREE_D_PRINT_SPECS });
  const [customColorInput, setCustomColorInput] = useState("");

  const selectedPrintColors = printSpecs.availableColors
    ? printSpecs.availableColors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  const insertOverviewFormat = (prefix: string, suffix: string = "", defaultText: string = "") => {
    const el = document.getElementById("slide2-overview-textarea") as HTMLTextAreaElement | null;
    if (!el) {
      setOverview((prev) => (prev ? prev + "\n" + prefix + defaultText + suffix : prefix + defaultText + suffix));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = overview.substring(start, end) || defaultText;
    const updated = overview.substring(0, start) + prefix + selected + suffix + overview.substring(end);
    setOverview(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 15);
  };

  const insertCommercialNoteFormat = (prefix: string, suffix: string = "", defaultText: string = "") => {
    const el = document.getElementById("slide4-note-textarea") as HTMLTextAreaElement | null;
    if (!el) {
      setCommercialNote((prev) => (prev ? prev + "\n" + prefix + defaultText + suffix : prefix + defaultText + suffix));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = commercialNote.substring(start, end) || defaultText;
    const updated = commercialNote.substring(0, start) + prefix + selected + suffix + commercialNote.substring(end);
    setCommercialNote(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 15);
  };

  const renderTokensWithFormatting = (raw: string) => {
    const tokens = raw.split(
      /(\*\*|<b>|<\/b>|<u>|<\/u>|==|<mark>|<\/mark>|\[\/?(?:red|danger|orange|warning|amber|teal|blue|slate|color(?:=[^\]]+)?)\])/gi
    );
    let isBold = false;
    let isUnderline = false;
    let isHighlight = false;
    let activeColorClass = "";
    const res: React.ReactNode[] = [];

    tokens.forEach((t, i) => {
      if (!t) return;
      const lower = t.toLowerCase();
      if (t === "**" || lower === "<b>" || lower === "</b>") {
        isBold = t === "**" ? !isBold : lower === "<b>";
      } else if (lower === "<u>" || lower === "</u>") {
        isUnderline = lower === "<u>";
      } else if (t === "==" || lower === "<mark>" || lower === "</mark>") {
        isHighlight = t === "==" ? !isHighlight : lower === "<mark>";
      } else if (lower.startsWith("[color=")) {
        const col = lower.substring(7, lower.length - 1);
        if (col === "red" || col === "#dc2626") activeColorClass = "text-red-400";
        else if (col === "orange" || col === "#f28e2b") activeColorClass = "text-orange-400";
        else if (col === "teal" || col === "#007a87") activeColorClass = "text-teal-400";
        else if (col === "amber" || col === "#d97706") activeColorClass = "text-amber-400";
        else if (col === "blue") activeColorClass = "text-blue-400";
        else activeColorClass = "";
      } else if (
        lower.startsWith("[/color]") ||
        lower === "[/red]" ||
        lower === "[/danger]" ||
        lower === "[/orange]" ||
        lower === "[/warning]" ||
        lower === "[/amber]" ||
        lower === "[/teal]" ||
        lower === "[/blue]" ||
        lower === "[/slate]"
      ) {
        activeColorClass = "";
      } else if (lower === "[red]" || lower === "[danger]") {
        activeColorClass = "text-red-400";
      } else if (lower === "[orange]" || lower === "[warning]") {
        activeColorClass = "text-orange-400";
      } else if (lower === "[amber]") {
        activeColorClass = "text-amber-400";
      } else if (lower === "[teal]") {
        activeColorClass = "text-teal-400";
      } else if (lower === "[blue]") {
        activeColorClass = "text-blue-400";
      } else if (lower === "[slate]") {
        activeColorClass = "text-slate-400";
      } else {
        let el: React.ReactNode = t;
        if (isHighlight) {
          el = (
            <mark key={i} className="bg-yellow-300 text-slate-950 px-1 py-0.5 rounded font-medium">
              {el}
            </mark>
          );
        }
        res.push(
          <span
            key={i}
            className={`${activeColorClass || (isBold ? "font-bold text-teal-300" : "")} ${
              isUnderline ? "underline decoration-orange-400 decoration-1 underline-offset-2" : ""
            }`}
          >
            {el}
          </span>
        );
      }
    });
    return res;
  };

  const renderOverviewPreview = (text: string) => {
    if (!text || !text.trim()) {
      return <span className="text-slate-500 italic">No introduction or feature text entered yet.</span>;
    }
    return (
      <div className="space-y-2 text-xs text-slate-200 leading-relaxed font-sans">
        {text.split("\n").map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;
          const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
          const cleanLine = isBullet ? trimmed.replace(/^[•\-\*]\s*/, "") : line;

          const colonIdx = cleanLine.indexOf(":");
          let titlePart = "";
          let bodyPart = cleanLine;
          if (isBullet && colonIdx > 0 && colonIdx < 45) {
            titlePart = cleanLine.substring(0, colonIdx + 1);
            bodyPart = cleanLine.substring(colonIdx + 1);
          }

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-orange-400 font-bold shrink-0">•</span>
                <div className="flex-1">
                  {titlePart && (
                    <span className="font-bold text-teal-300 mr-1.5">
                      {renderTokensWithFormatting(titlePart)}
                    </span>
                  )}
                  <span className="text-slate-300">{renderTokensWithFormatting(bodyPart)}</span>
                </div>
              </div>
            );
          }

          return <p key={idx} className="text-slate-300">{renderTokensWithFormatting(cleanLine)}</p>;
        })}
      </div>
    );
  };

  const handleAutoBulletKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    getter: string,
    setter: (val: string) => void
  ) => {
    if (e.key !== "Enter" || e.shiftKey) return;

    const textarea = e.currentTarget;
    const cursor = textarea.selectionStart;

    const textBeforeCursor = getter.substring(0, cursor);
    const lastNewlineIdx = textBeforeCursor.lastIndexOf("\n");
    const currentLineStart = lastNewlineIdx === -1 ? 0 : lastNewlineIdx + 1;
    const currentLine = textBeforeCursor.substring(currentLineStart);

    // Bullet match: "• ", "- ", "* "
    const bulletMatch = currentLine.match(/^(\s*)(•|-|\*)\s*(.*)$/);
    if (bulletMatch) {
      e.preventDefault();
      const indent = bulletMatch[1];
      const bulletChar = bulletMatch[2] === "-" || bulletMatch[2] === "*" ? "•" : bulletMatch[2];
      const textAfterBullet = bulletMatch[3].trim();

      if (!textAfterBullet) {
        const newText = getter.substring(0, currentLineStart) + getter.substring(cursor);
        setter(newText);
        setTimeout(() => {
          textarea.setSelectionRange(currentLineStart, currentLineStart);
        }, 0);
        return;
      }

      const insertStr = `\n${indent}${bulletChar} `;
      const newText = getter.substring(0, cursor) + insertStr + getter.substring(cursor);
      setter(newText);
      setTimeout(() => {
        const nextPos = cursor + insertStr.length;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 0);
      return;
    }

    // Numbered list match: "1. "
    const numMatch = currentLine.match(/^(\s*)(\d+)([\.\)])\s*(.*)$/);
    if (numMatch) {
      e.preventDefault();
      const indent = numMatch[1];
      const currentNum = parseInt(numMatch[2], 10);
      const delimiter = numMatch[3];
      const textAfterNum = numMatch[4].trim();

      if (!textAfterNum) {
        const newText = getter.substring(0, currentLineStart) + getter.substring(cursor);
        setter(newText);
        setTimeout(() => {
          textarea.setSelectionRange(currentLineStart, currentLineStart);
        }, 0);
        return;
      }

      const nextNum = currentNum + 1;
      const insertStr = `\n${indent}${nextNum}${delimiter} `;
      const newText = getter.substring(0, cursor) + insertStr + getter.substring(cursor);
      setter(newText);
      setTimeout(() => {
        const nextPos = cursor + insertStr.length;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 0);
      return;
    }
  };

  const insertTermsFormat = (prefix: string, suffix: string = "", defaultText: string = "") => {
    const el = document.getElementById("slide5-terms-textarea") as HTMLTextAreaElement | null;
    if (!el) {
      setTerms((prev) => (prev ? prev + "\n" + prefix + defaultText + suffix : prefix + defaultText + suffix));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = terms.substring(start, end) || defaultText;
    const updated = terms.substring(0, start) + prefix + selected + suffix + terms.substring(end);
    setTerms(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 15);
  };

  const renderTermsPreview = (termsText: string) => {
    const defaultTerms = getProjectProposalTerms(Number(validityDays) || 4);
    const customLines = termsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const parseLineFormatted = (line: string) => {
      const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
      const cleanLine = isBullet ? line.replace(/^[•\-\*]\s*/, "") : line;
      const colonIdx = cleanLine.indexOf(":");
      let titlePart = "";
      let bodyPart = cleanLine;
      if (colonIdx > 0 && colonIdx < 45) {
        titlePart = cleanLine.substring(0, colonIdx + 1);
        bodyPart = cleanLine.substring(colonIdx + 1);
      }

      return (
        <div className="flex items-start gap-2">
          <span className="text-orange-400 font-bold shrink-0">•</span>
          <div className="flex-1">
            {titlePart && (
              <span className="font-bold text-teal-300 mr-1.5">
                {renderTokensWithFormatting(titlePart)}
              </span>
            )}
            <span className="text-slate-300">{renderTokensWithFormatting(bodyPart)}</span>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-2 text-xs leading-relaxed font-sans">
        {customLines.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wider pb-1 border-b border-slate-800">
              Custom Project Terms (Top Priority)
            </div>
            {customLines.map((line, idx) => (
              <div key={`custom-${idx}`}>{parseLineFormatted(line)}</div>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider pb-1 border-b border-slate-800">
            Standard LK Tronics Terms (Auto-Appended)
          </div>
          {defaultTerms.map((term, idx) => (
            <div key={`default-${idx}`}>{parseLineFormatted(term)}</div>
          ))}
        </div>
      </div>
    );
  };

  const handleTogglePrintColor = (colorName: string) => {
    let updated: string[];
    if (selectedPrintColors.includes(colorName)) {
      updated = selectedPrintColors.filter((c) => c !== colorName);
    } else {
      updated = [...selectedPrintColors, colorName];
    }
    setPrintSpecs({ ...printSpecs, availableColors: updated.join(", ") });
  };

  const handleRemovePrintColor = (colorName: string) => {
    const updated = selectedPrintColors.filter((c) => c !== colorName);
    setPrintSpecs({ ...printSpecs, availableColors: updated.join(", ") });
  };

  const handleAddCustomPrintColor = () => {
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    if (!selectedPrintColors.includes(trimmed)) {
      const updated = [...selectedPrintColors, trimmed];
      setPrintSpecs({ ...printSpecs, availableColors: updated.join(", ") });
    }
    setCustomColorInput("");
  };

  // Technical Specs for PCB & Images
  const [pcbSpecs, setPcbSpecs] = useState({ ...DEFAULT_PCB_SPECS });
  const [pcbImages, setPcbImages] = useState<string[]>([]);
  const [pcbLeadTime, setPcbLeadTime] = useState("12 - 21 Days");
  const [isUploadingPcbImage, setIsUploadingPcbImage] = useState(false);
  const [pcbUploadError, setPcbUploadError] = useState<string | null>(null);

  const handlePcbImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingPcbImage(true);
    setPcbUploadError(null);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const json = await res.json();
          if (json.url) {
            uploadedUrls.push(json.url);
          }
        }
      }
      setPcbImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setPcbUploadError(err.message || "Failed to upload image");
    } finally {
      setIsUploadingPcbImage(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemovePcbImage = (indexToRemove: number) => {
    setPcbImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Set updater helper
  const updateActiveSet = (updater: (prevSet: ProposalSetData) => ProposalSetData) => {
    setProposalSets((prev) => {
      const updated = [...prev];
      if (updated[activeSetIndex]) {
        updated[activeSetIndex] = updater(updated[activeSetIndex]);
      }
      return updated;
    });
  };

  const handleAddSet = () => {
    const newSetNumber = proposalSets.length + 1;
    const newSet: ProposalSetData = {
      id: `set-${Date.now()}`,
      title: `Set ${newSetNumber}`,
      leadTime: "10 Working Days",
      warranty: "1 Year",
      systemDesignImages: [],
      hardwareItems: [
        {
          id: `hw-${Date.now()}-1`,
          productOrService: "",
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          itemType: "HARDWARE",
        },
      ],
      serviceItems: [
        {
          id: `srv-${Date.now()}-1`,
          productOrService: "",
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          itemType: "SERVICE",
        },
      ],
      hardwareTotal: "",
      servicesTotal: "",
      commercialNote: "",
    };
    setProposalSets((prev) => [...prev, newSet]);
    setActiveSetIndex(proposalSets.length);
  };

  const handleDuplicateSet = (indexToDuplicate: number) => {
    const source = proposalSets[indexToDuplicate];
    if (!source) return;
    const newSetNumber = proposalSets.length + 1;
    const duplicated: ProposalSetData = {
      ...source,
      id: `set-${Date.now()}`,
      title: `Set ${newSetNumber}`,
      hardwareItems: source.hardwareItems.map((it, idx) => ({
        ...it,
        id: `hw-dup-${Date.now()}-${idx}`,
      })),
      serviceItems: source.serviceItems.map((it, idx) => ({
        ...it,
        id: `srv-dup-${Date.now()}-${idx}`,
      })),
      systemDesignImages: [...source.systemDesignImages],
    };
    setProposalSets((prev) => [...prev, duplicated]);
    setActiveSetIndex(proposalSets.length);
  };

  const handleDeleteSet = (indexToDelete: number) => {
    if (proposalSets.length <= 1) {
      alert("At least one proposal set (Slides 3 & 4) is required.");
      return;
    }
    if (!confirm(`Are you sure you want to delete Set ${indexToDelete + 1}?`)) {
      return;
    }
    setProposalSets((prev) => prev.filter((_, idx) => idx !== indexToDelete));
    setActiveSetIndex((prev) => (prev >= indexToDelete ? Math.max(0, prev - 1) : prev));
  };

  // Active Set Image Upload
  const handleActiveSetDesignImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const curSet = proposalSets[activeSetIndex];
    if (!curSet) return;
    const MAX_SET_IMAGES = 8;
    const remaining = MAX_SET_IMAGES - curSet.systemDesignImages.length;
    if (remaining <= 0) {
      alert("Maximum 8 images allowed per Slide 3 in this set.");
      return;
    }
    const filesToUpload = Array.from(files).slice(0, remaining);
    setIsUploadingDesignImages(true);

    try {
      const newUrls: string[] = [];
      for (const file of filesToUpload) {
        let uploaded = false;
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              newUrls.push(data.url);
              uploaded = true;
            }
          }
        } catch {}

        if (!uploaded) {
          const reader = new FileReader();
          await new Promise<void>((resolve) => {
            reader.onload = (ev) => {
              const base64 = ev.target?.result as string;
              if (base64) {
                newUrls.push(base64);
              }
              resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(file);
          });
        }
      }

      setProposalSets((prev) => {
        const updated = [...prev];
        if (updated[activeSetIndex]) {
          updated[activeSetIndex] = {
            ...updated[activeSetIndex],
            systemDesignImages: [...updated[activeSetIndex].systemDesignImages, ...newUrls].slice(0, 8),
          };
        }
        return updated;
      });
    } finally {
      setIsUploadingDesignImages(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleActiveSetRemoveDesignImage = (indexToRemove: number) => {
    setProposalSets((prev) => {
      const updated = [...prev];
      if (updated[activeSetIndex]) {
        updated[activeSetIndex] = {
          ...updated[activeSetIndex],
          systemDesignImages: updated[activeSetIndex].systemDesignImages.filter((_, idx) => idx !== indexToRemove),
        };
      }
      return updated;
    });
  };

  const handleActiveSetAddItem = (type: "HARDWARE" | "SERVICE") => {
    const curSet = proposalSets[activeSetIndex];
    if (!curSet) return;
    if (type === "HARDWARE") {
      if (curSet.hardwareItems.length >= 4) {
        alert("Maximum 4 Hardware Components allowed per slide in this set.");
        return;
      }
      const newItem: ProposalSetItem = {
        id: `hw-${Date.now()}-${curSet.hardwareItems.length + 1}`,
        productOrService: "",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        itemType: "HARDWARE",
      };
      setProposalSets((prev) => {
        const updated = [...prev];
        if (updated[activeSetIndex]) {
          updated[activeSetIndex] = {
            ...updated[activeSetIndex],
            hardwareItems: [...updated[activeSetIndex].hardwareItems, newItem],
          };
        }
        return updated;
      });
    } else {
      if (curSet.serviceItems.length >= 2) {
        alert("Maximum 2 Engineering Services allowed per slide in this set.");
        return;
      }
      const newItem: ProposalSetItem = {
        id: `srv-${Date.now()}-${curSet.serviceItems.length + 1}`,
        productOrService: "",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        itemType: "SERVICE",
      };
      setProposalSets((prev) => {
        const updated = [...prev];
        if (updated[activeSetIndex]) {
          updated[activeSetIndex] = {
            ...updated[activeSetIndex],
            serviceItems: [...updated[activeSetIndex].serviceItems, newItem],
          };
        }
        return updated;
      });
    }
  };

  const handleActiveSetItemChange = (
    itemId: string,
    field: "productOrService" | "quantity",
    val: any
  ) => {
    setProposalSets((prev) => {
      const updated = [...prev];
      if (updated[activeSetIndex]) {
        updated[activeSetIndex] = {
          ...updated[activeSetIndex],
          hardwareItems: updated[activeSetIndex].hardwareItems.map((it) =>
            it.id === itemId ? { ...it, [field]: val } : it
          ),
          serviceItems: updated[activeSetIndex].serviceItems.map((it) =>
            it.id === itemId ? { ...it, [field]: val } : it
          ),
        };
      }
      return updated;
    });
  };

  const handleActiveSetRemoveItem = (itemId: string) => {
    setProposalSets((prev) => {
      const updated = [...prev];
      if (updated[activeSetIndex]) {
        updated[activeSetIndex] = {
          ...updated[activeSetIndex],
          hardwareItems: updated[activeSetIndex].hardwareItems.filter((it) => it.id !== itemId),
          serviceItems: updated[activeSetIndex].serviceItems.filter((it) => it.id !== itemId),
        };
      }
      return updated;
    });
  };

  // Legacy design image upload handlers for compatibility
  const handleDesignImageUpload = handleActiveSetDesignImageUpload;
  const handleRemoveDesignImage = handleActiveSetRemoveDesignImage;

  // Terms & Conditions
  const [terms, setTerms] = useState("");

  // Items State (supports both HARDWARE and SERVICE rows)
  const [items, setItems] = useState<ItemRow[]>([
    {
      id: "item-1",
      itemType: "HARDWARE",
      productOrService: "",
      quantity: 1,
      unitPrice: 0,
      notes: "",
    },
  ]);

  // UI state
  const [savedQuotationId, setSavedQuotationId] = useState<number | string | null>(null);
  const [isLoadingNumber, setIsLoadingNumber] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // PMS Product Search Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Set default dates on mount
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    setPreparedDate(todayStr);

    const exp = new Date(today);
    exp.setDate(exp.getDate() + Number(validityDays || 5));
    setExpireDate(exp.toISOString().split("T")[0]);

    if (session?.user?.name) {
      setPreparedBy(session.user.name);
    } else {
      setPreparedBy("LK Tronics R&D Division");
    }
  }, [session]);

  // Recalculate expiry when preparedDate or validityDays change
  useEffect(() => {
    if (!preparedDate) return;
    const base = new Date(preparedDate);
    if (isNaN(base.getTime())) return;
    const exp = new Date(base);
    exp.setDate(exp.getDate() + (Number(validityDays) || 0));
    setExpireDate(exp.toISOString().split("T")[0]);
  }, [preparedDate, validityDays]);

  // Fetch next quotation number whenever quotationType changes
  useEffect(() => {
    const fetchNextNumber = async () => {
      setIsLoadingNumber(true);
      try {
        const res = await fetch(`/api/rad/next-number?type=${quotationType}`);
        if (res.ok) {
          const data = await res.json();
          const next = data.quotationNo || data.nextQuotationNo;
          if (next) {
            setQuotationNo(next);
          }
        }
      } catch (err) {
        console.error("Failed to fetch next number:", err);
      } finally {
        setIsLoadingNumber(false);
      }
    };

    fetchNextNumber();

    const emptyRow: ItemRow[] = [
      {
        id: "item-1",
        itemType: "HARDWARE",
        productOrService: "",
        quantity: 1,
        unitPrice: 0,
        notes: "",
        calcMode: quotationType === "THREE_D_PRINT" ? (printSpecs.pricingMode || "AUTO") : undefined,
        filamentLengthM: "",
        printTimeMinutes: "",
        printTimeHours: "",
      },
    ];

    // Set initial terms and items according to type
    if (quotationType === "PROJECT_PROPOSAL") {
      setTerms("");
      setLeadTime("10 Working Days");
      setWarranty("1 Year");
      setPaymentMethod("ADVANCE_PAYMENT");
      setAdvancePercent(60);
      setValidityDays(5);
      setProjectTitle("");
      setOverview("");
      setCustomHardwareTotal("");
      setCustomServicesTotal("");
      setItems([
        {
          id: "item-hw-1",
          itemType: "HARDWARE" as const,
          productOrService: "",
          quantity: 1,
          unitPrice: 0,
          notes: "",
        },
        {
          id: "item-srv-1",
          itemType: "SERVICE" as const,
          productOrService: "",
          quantity: 1,
          unitPrice: 0,
          notes: "",
        },
      ]);
    } else if (quotationType === "THREE_D_PRINT") {
      setTerms(DEFAULT_THREE_D_PRINT_TERMS.join("\n\n"));
      setLeadTime(printSpecs.leadTime || "2 - 4 Working Days");
      setWarranty("");
      setPaymentMethod("FULL_PAYMENT");
      setValidityDays(5);
      setItems(emptyRow);
    } else if (quotationType === "PCB") {
      setTerms(DEFAULT_PCB_TERMS.join("\n\n"));
      setLeadTime("12 - 21 Days");
      setPcbLeadTime("12 - 21 Days");
      setWarranty("");
      setPaymentMethod("FULL_PAYMENT");
      setValidityDays(5);
      setItems(emptyRow);
    } else if (quotationType === "UNI_QUOTATION") {
      setTerms(DEFAULT_UNI_QUOTATION_GENERAL_TERMS.join("\n\n"));
      setLeadTime("");
      setUniCompletionTime("");
      setWarranty("");
      setPaymentMethod("ADVANCE_PAYMENT");
      setAdvancePercent(80);
      setValidityDays(5);
      setProjectTitle("");
      setEngineeringCharges("");
      setDiscount("");
      setItems(emptyRow);
    }
  }, [quotationType]);

  const handleAutoGenerateNumber = async () => {
    setIsLoadingNumber(true);
    try {
      const res = await fetch(`/api/rad/next-number?type=${quotationType}`);
      if (res.ok) {
        const data = await res.json();
        const next = data.quotationNo || data.nextQuotationNo;
        if (next) {
          setQuotationNo(next);
        }
      }
    } catch (err) {
      console.error("Failed to fetch next number:", err);
    } finally {
      setIsLoadingNumber(false);
    }
  };

  // Load configured settlement bank accounts from system settings
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const res = await fetch("/api/rad/bank-accounts");
        if (res.ok) {
          const d = await res.json();
          const accs: BankAccount[] = d.bankAccounts || [];
          setBankAccounts(accs);
          if (!selectedBankAccountId && accs.length > 0) {
            const def = accs.find((a) => a.isDefault) || accs[0];
            setSelectedBankAccountId(def.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch bank accounts:", err);
      }
    };
    fetchBankAccounts();
  }, []);

  // Load configured 3D print pricing defaults from system settings
  useEffect(() => {
    if (quotationType === "THREE_D_PRINT") {
      fetch("/api/rad/3d-pricing")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.pricing) {
            const p = data.pricing;
            const price = Number(p.filamentPricePerKg) >= 0
              ? Number(p.filamentPricePerKg)
              : (Number(p.filamentPricePerSpool) >= 0 ? Number(p.filamentPricePerSpool) : 10000);
            const hourlyRate = Number(p.costPerHour) >= 0 ? Number(p.costPerHour) : 200;
            const markup = Number(p.markupPercent) >= 0 ? Number(p.markupPercent) : 35;
            const density = Number(p.materialDensity) > 0 ? Number(p.materialDensity) : 1.27;
            const diameter = Number(p.filamentDiameterMm) > 0 ? Number(p.filamentDiameterMm) : 1.75;
            const mat = p.materialType || "PLA";

            setPrintSpecs((prev) => ({
              ...prev,
              material: mat,
              materialDensity: density,
              filamentDiameterMm: diameter,
              filamentPricePerKg: price,
              filamentPricePerSpool: price,
              spoolLengthMeters: Number(p.spoolLengthMeters) || 330,
              costPerHour: hourlyRate,
              markupPercent: markup,
            }));

            // Recalculate auto items with new Omni Calculator pricing
            setItems((prevItems) =>
              prevItems.map((it) => {
                const mode = it.calcMode || "AUTO";
                const mins = it.printTimeMinutes !== undefined && it.printTimeMinutes !== ""
                  ? it.printTimeMinutes
                  : (Number(it.printTimeHours) || 0) * 60;
                if (mode === "AUTO" && (it.filamentLengthM || mins)) {
                  const c = calculate3DPrintPrice(
                    it.filamentLengthM || 0,
                    mins || 0,
                    price,
                    hourlyRate,
                    markup,
                    density,
                    diameter
                  );
                  return { ...it, unitPrice: c.unitPrice };
                }
                return it;
              })
            );
          }
        })
        .catch((err) => {
          console.error("Failed to fetch 3D pricing defaults:", err);
        });
    }
  }, [quotationType]);

  // Product Search Effect for Modal
  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingProducts(true);
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(
            productSearchQuery.trim()
          )}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
        }
      } catch (err) {
        console.error("Product search failed:", err);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearchQuery]);

  // Calculations
  const setsHardwareTotal = proposalSets.reduce((sum, s) => {
    if (s.hardwareTotal !== "" && !isNaN(Number(s.hardwareTotal))) {
      return sum + Number(s.hardwareTotal);
    }
    const calc = s.hardwareItems.reduce(
      (hSum, it) => hSum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
      0
    );
    return sum + calc;
  }, 0);

  const setsServicesTotal = proposalSets.reduce((sum, s) => {
    if (s.servicesTotal !== "" && !isNaN(Number(s.servicesTotal))) {
      return sum + Number(s.servicesTotal);
    }
    const calc = s.serviceItems.reduce(
      (sSum, it) => sSum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
      0
    );
    return sum + calc;
  }, 0);

  const hardwareItems =
    quotationType === "PROJECT_PROPOSAL"
      ? (proposalSets[activeSetIndex]?.hardwareItems || [])
      : items.filter((i) => i.itemType === "HARDWARE");
  const serviceItems =
    quotationType === "PROJECT_PROPOSAL"
      ? (proposalSets[activeSetIndex]?.serviceItems || [])
      : items.filter((i) => i.itemType === "SERVICE");

  const computedHardwareTotal = hardwareItems.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
    0
  );
  const computedServicesTotal = serviceItems.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
    0
  );

  const hardwareTotal =
    quotationType === "PROJECT_PROPOSAL"
      ? setsHardwareTotal
      : customHardwareTotal !== "" && !isNaN(Number(customHardwareTotal))
      ? Number(customHardwareTotal)
      : computedHardwareTotal;

  const servicesTotal =
    quotationType === "PROJECT_PROPOSAL"
      ? setsServicesTotal
      : customServicesTotal !== "" && !isNaN(Number(customServicesTotal))
      ? Number(customServicesTotal)
      : computedServicesTotal;

  const componentsTotal = items.slice(0, 4).reduce(
    (sum, i) =>
      sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
    0
  );

  const totalAmount =
    quotationType === "PROJECT_PROPOSAL"
      ? hardwareTotal + servicesTotal
      : quotationType === "UNI_QUOTATION"
      ? Math.max(
          0,
          componentsTotal +
            (Number(engineeringCharges) || 0) -
            (Number(discount) || 0)
        )
      : componentsTotal;

  // Step completion indicators for Project Proposal wizard (4 steps: 3 & 4 combined)
  const isStep1Complete = Boolean(
    quotationNo.trim() && quotationTo.trim() && projectTitle.trim()
  );
  const isStep2Complete = Boolean(overview.trim().length > 0);
  const isStep3Complete = Boolean(
    proposalSets.length > 0 &&
      proposalSets.some(
        (s) =>
          s.hardwareItems.length > 0 ||
          s.serviceItems.length > 0 ||
          s.systemDesignImages.length > 0
      )
  );
  const isStep4Complete = Boolean(terms !== undefined && terms.trim().length >= 0);

  const PROPOSAL_STEPS = [
    {
      step: 1,
      title: "1. General & Cover",
      sub: "General info & Slide 1 title",
      isComplete: isStep1Complete,
    },
    {
      step: 2,
      title: "2. System Overview",
      sub: "Slide 2 overview & intro",
      isComplete: isStep2Complete,
    },
    {
      step: 3,
      title: "3. Design & BOM",
      sub: `${proposalSets.length} Set(s) (Slides 3 & 4)`,
      isComplete: isStep3Complete,
    },
    {
      step: 4,
      title: "4. Terms & Conditions",
      sub: "Slide 5 terms & sign-off",
      isComplete: isStep4Complete,
    },
  ];

  // Add Item
  const handleAddItem = (type: "HARDWARE" | "SERVICE" = "HARDWARE") => {
    if (quotationType === "PROJECT_PROPOSAL") {
      // Multi-slide repeater supports 4 hardware items and 2 service items per slide
      if (type === "HARDWARE" && hardwareItems.length >= 32) {
        alert("Maximum 32 Hardware Components allowed across repeater slides.");
        return;
      }
      if (type === "SERVICE" && serviceItems.length >= 16) {
        alert("Maximum 16 Engineering Services allowed across repeater slides.");
        return;
      }
    }
    if (quotationType === "UNI_QUOTATION" && items.length >= 4) {
      alert("Maximum 4 Components allowed for Uni Quotation Table.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemType: type,
        productOrService: "",
        quantity: 1,
        unitPrice: 0,
        notes: "",
        calcMode: quotationType === "THREE_D_PRINT" ? (printSpecs.pricingMode || "AUTO") : undefined,
        material: quotationType === "THREE_D_PRINT" ? (printSpecs.material || "PLA") : undefined,
        filamentLengthM: "",
        printTimeMinutes: "",
        printTimeHours: "",
      },
    ]);
  };

  const updatePrintSpecParam = (
    key: "spoolLengthMeters" | "filamentPricePerSpool" | "costPerHour" | "markupPercent" | "filamentPricePerKg" | "materialDensity" | "filamentDiameterMm",
    val: number
  ) => {
    const updatedSpecs = { ...printSpecs, [key]: val };
    setPrintSpecs(updatedSpecs);
    if (quotationType === "THREE_D_PRINT") {
      setItems((prev) =>
        prev.map((it) => {
          const mode = it.calcMode || updatedSpecs.pricingMode || "AUTO";
          const mins = it.printTimeMinutes !== undefined && it.printTimeMinutes !== ""
            ? it.printTimeMinutes
            : (Number(it.printTimeHours) || 0) * 60;
          if (mode === "AUTO" && (it.filamentLengthM || mins)) {
            const price = updatedSpecs.filamentPricePerKg ?? updatedSpecs.filamentPricePerSpool ?? 10000;
            const itemMat = it.material || updatedSpecs.material || "ABS";
            const density = updatedSpecs.materialDensity ?? (MATERIAL_DENSITIES[itemMat] || 1.05);
            const diameter = updatedSpecs.filamentDiameterMm ?? 1.75;
            const calc = calculate3DPrintPrice(
              it.filamentLengthM || 0,
              mins || 0,
              price,
              updatedSpecs.costPerHour ?? 200,
              updatedSpecs.markupPercent ?? 35,
              density,
              diameter
            );
            return {
              ...it,
              unitPrice: calc.unitPrice,
            };
          }
          return it;
        })
      );
    }
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      alert("At least one line item is required.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Update Item Field
  const handleItemChange = (
    id: string,
    field: keyof ItemRow,
    value: any
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  // Select Product from Modal
  const handleSelectProduct = (prod: ProductSearchResult) => {
    if (targetSetItemId) {
      setProposalSets((prev) => {
        const updated = [...prev];
        if (updated[activeSetIndex]) {
          updated[activeSetIndex] = {
            ...updated[activeSetIndex],
            hardwareItems: updated[activeSetIndex].hardwareItems.map((it) =>
              it.id === targetSetItemId
                ? {
                    ...it,
                    productOrService: prod.productName,
                    unitPrice:
                      typeof prod.priceLKR === "number"
                        ? prod.priceLKR
                        : parseFloat(String(prod.priceLKR || 0)) || 0,
                  }
                : it
            ),
          };
        }
        return updated;
      });
      setTargetSetItemId(null);
    } else if (targetItemIndex !== null && items[targetItemIndex]) {
      const targetId = items[targetItemIndex].id;
      const price =
        typeof prod.priceLKR === "number"
          ? prod.priceLKR
          : parseFloat(String(prod.priceLKR || 0)) || 0;

      setItems((prev) =>
        prev.map((it) =>
          it.id === targetId
            ? {
                ...it,
                productOrService: prod.productName,
                unitPrice: price,
              }
            : it
        )
      );
      setTargetItemIndex(null);
    }
    setIsProductModalOpen(false);
    setProductSearchQuery("");
  };

  // Prepare Payload
  const preparePayload = (targetStatus?: "DRAFT" | "COMPLETED") => {
    const activeBank =
      bankAccounts.find((b) => b.id === selectedBankAccountId) ||
      bankAccounts.find((b) => b.isDefault) ||
      bankAccounts[0] ||
      null;

    const technicalSpecs =
      quotationType === "THREE_D_PRINT"
        ? {
            ...printSpecs,
            itemCalcDetails: items.map((it) => ({
              calcMode: it.calcMode || printSpecs.pricingMode || "AUTO",
              material: it.material || printSpecs.material || "PLA",
              filamentLengthM: it.filamentLengthM ?? "",
              printTimeMinutes: it.printTimeMinutes ?? (it.printTimeHours ? Number(it.printTimeHours) * 60 : ""),
              printTimeHours: it.printTimeHours ?? "",
            })),
            bankDetails: activeBank,
            bankAccountId: activeBank?.id,
          }
        : quotationType === "PCB"
        ? { ...pcbSpecs, images: pcbImages, leadTime: pcbLeadTime || "12 - 21 Days", bankDetails: activeBank, bankAccountId: activeBank?.id }
        : quotationType === "UNI_QUOTATION"
        ? {
            completionTime: uniCompletionTime || leadTime || "10 business working days",
            componentsTotal,
            engineeringCharges: Number(engineeringCharges) || 0,
            discount: Number(discount) || 0,
            validityDays: Number(validityDays) || 5,
            warrantyText: warranty || null,
            paymentTermsText:
              paymentMethod === "ADVANCE_PAYMENT"
                ? `${advancePercent || 80}% advance payment`
                : paymentMethod === "FULL_PAYMENT"
                ? "100% payment"
                : "Corporate Credit",
            advancePercent:
              paymentMethod === "ADVANCE_PAYMENT" ? Number(advancePercent) || 80 : null,
            itemImages: items.map((it) => it.image || null),
            bankDetails: activeBank,
            bankAccountId: activeBank?.id,
          }
        : {
            systemDesignImages: proposalSets.flatMap((s) => s.systemDesignImages),
            proposalSets: proposalSets.map((s) => ({
              id: s.id,
              title: s.title,
              leadTime: s.leadTime,
              warranty: s.warranty,
              systemDesignImages: s.systemDesignImages,
              hardwareItems: s.hardwareItems,
              serviceItems: s.serviceItems,
              hardwareTotal: s.hardwareTotal ? Number(s.hardwareTotal) : null,
              servicesTotal: s.servicesTotal ? Number(s.servicesTotal) : null,
              commercialNote: s.commercialNote || null,
            })),
            advancePercent: Number(advancePercent) || 60,
            overviewFontSize: Number(overviewFontSize) || 22.0,
            termsFontSize: Number(termsFontSize) || 22.0,
            commercialNote: proposalSets[0]?.commercialNote || commercialNote.trim() || null,
            bankDetails: activeBank,
            bankAccountId: activeBank?.id,
          };

    return {
      type: quotationType,
      quotationNo,
      registrationNo,
      status: targetStatus || quotationStatus || "COMPLETED",
      projectTitle:
        quotationType === "PROJECT_PROPOSAL" || quotationType === "UNI_QUOTATION"
          ? projectTitle
          : null,
      preparedDate,
      expireDate,
      validityDays: Number(validityDays) || 5,
      paymentMethod,
      advancePercent:
        paymentMethod === "ADVANCE_PAYMENT" ? Number(advancePercent) || 60 : null,
      preparedBy,
      quotationTo,
      leadTime:
        quotationType === "PROJECT_PROPOSAL"
          ? proposalSets[0]?.leadTime || leadTime
          : quotationType === "THREE_D_PRINT"
          ? printSpecs.leadTime
          : quotationType === "PCB"
          ? pcbLeadTime
          : quotationType === "UNI_QUOTATION"
          ? uniCompletionTime || leadTime
          : leadTime,
      warranty:
        quotationType === "PROJECT_PROPOSAL"
          ? proposalSets[0]?.warranty || warranty
          : quotationType === "UNI_QUOTATION"
          ? warranty
          : null,
      hardwareTotal:
        quotationType === "PROJECT_PROPOSAL"
          ? hardwareTotal
          : quotationType === "UNI_QUOTATION"
          ? componentsTotal
          : null,
      servicesTotal:
        quotationType === "PROJECT_PROPOSAL"
          ? servicesTotal
          : quotationType === "UNI_QUOTATION"
          ? Number(engineeringCharges) || 0
          : null,
      totalAmount,
      overview: quotationType === "PROJECT_PROPOSAL" ? overview : null,
      technicalSpecs,
      termsAndConditions:
        quotationType === "PROJECT_PROPOSAL" || quotationType === "UNI_QUOTATION"
          ? terms
          : null,
      items:
        quotationType === "PROJECT_PROPOSAL"
          ? proposalSets
              .flatMap((s) => [...s.hardwareItems, ...s.serviceItems])
              .map((it, idx) => ({
                itemIndex: idx + 1,
                itemType: it.itemType,
                productOrService: it.productOrService || "Item",
                quantity: Number(it.quantity) || 1,
                unitPrice: Number(it.unitPrice) || 0,
                totalPrice: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                notes: null,
              }))
          : items.map((it, idx) => ({
              itemIndex: idx + 1,
              itemType: it.itemType,
              productOrService: it.productOrService || "Item",
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice:
                (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
              notes:
                quotationType === "THREE_D_PRINT"
                  ? `3D_CALC:${JSON.stringify({
                      material: it.material || printSpecs.material || "PLA",
                      filamentLengthM: it.filamentLengthM !== undefined && it.filamentLengthM !== "" ? Number(it.filamentLengthM) : "",
                      printTimeMinutes: it.printTimeMinutes !== undefined && it.printTimeMinutes !== "" ? Number(it.printTimeMinutes) : (it.printTimeHours ? Number(it.printTimeHours) * 60 : ""),
                      calcMode: it.calcMode || printSpecs.pricingMode || "AUTO",
                    })}`
                  : quotationType === "UNI_QUOTATION" && it.image
                  ? JSON.stringify({ image: it.image, note: it.notes || "" })
                  : (it.notes || null),
            })),
    };
  };

  // Unsaved changes tracking
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("");
  const initialSnapshotRef = useRef<string>("");

  useEffect(() => {
    if (!initialSnapshotRef.current) {
      try {
        initialSnapshotRef.current = JSON.stringify(preparePayload());
      } catch {}
    }
  }, []);

  const currentPayloadStr = (() => {
    try {
      return JSON.stringify(preparePayload());
    } catch {
      return "";
    }
  })();

  const isFormDirty = Boolean(
    lastSavedSnapshot
      ? currentPayloadStr !== lastSavedSnapshot
      : initialSnapshotRef.current && currentPayloadStr !== initialSnapshotRef.current
  );

  const { markAsSaved } = useUnsavedChangesWarning({ isDirty: isFormDirty });

  // Check form completion and collect missing required fields for validation and highlight
  const getFormValidation = () => {
    const missing: Record<string, string> = {};

    const currentNo = quotationNo.trim();
    if (!currentNo) {
      missing["quotationNo"] = "Quotation Number";
    }
    if (!quotationTo.trim()) {
      missing["quotationTo"] = "Quotation To (Customer Name / Company)";
    }
    if (!preparedBy.trim()) {
      missing["preparedBy"] = "Prepared By (Author)";
    }
    if (!preparedDate) {
      missing["preparedDate"] = "Quotation Prepared Date";
    }
    if (!expireDate) {
      missing["expireDate"] = "Quotation Expire Date";
    } else if (preparedDate && new Date(expireDate) < new Date(preparedDate)) {
      missing["expireDate"] = "Quotation Expire Date (must be on or after Prepared Date)";
    }

    // Settlement Bank Account
    if (!selectedBankAccountId || !selectedBankAccountId.trim()) {
      missing["bankAccount"] = "Settlement Bank Account is required";
    }

    // Payment Method & Advance Percentage
    if (!paymentMethod || !paymentMethod.trim()) {
      missing["paymentMethod"] = "Payment Method is required";
    } else if (paymentMethod === "ADVANCE_PAYMENT") {
      const pct = Number(advancePercent);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        missing["advancePercent"] = "Advance Payment Percentage must be between 1% and 100%";
      }
    }

    if (quotationType === "PROJECT_PROPOSAL" || quotationType === "UNI_QUOTATION") {
      if (!projectTitle.trim()) {
        missing["projectTitle"] = "Project Proposal Title";
      }
    }

    if (quotationType === "UNI_QUOTATION") {
      if (!(uniCompletionTime || leadTime).trim()) {
        missing["uniCompletionTime"] = "Estimated Project Completion Time is required";
      }
      if (items.length > 4) {
        missing["items"] = "University Quotation can have at most 4 items";
      }
    }
    if (items.length === 0) {
      missing["items"] = "Line Items (at least 1 item required)";
    } else {
      items.forEach((it, idx) => {
        if (!it.productOrService || !it.productOrService.trim()) {
          missing[`item_${idx}_productOrService`] = `Item #${idx + 1} Description`;
        }
        if (Number(it.quantity) < 1) {
          missing[`item_${idx}_quantity`] = `Item #${idx + 1} Quantity`;
        }
        if (Number(it.unitPrice) < 0) {
          missing[`item_${idx}_unitPrice`] = `Item #${idx + 1} Unit Rate`;
        }
      });
    }

    return missing;
  };

  const scrollToFirstError = (missing: Record<string, string>) => {
    const firstKey = Object.keys(missing)[0];
    if (!firstKey) return;
    if (quotationType === "PROJECT_PROPOSAL") {
      if (
        [
          "quotationNo",
          "preparedBy",
          "preparedDate",
          "expireDate",
          "quotationTo",
          "projectTitle",
          "bankAccount",
          "paymentMethod",
          "advancePercent",
        ].includes(firstKey)
      ) {
        setActiveProposalTab(1);
      } else if (firstKey === "overview") {
        setActiveProposalTab(2);
      } else if (
        firstKey.startsWith("item_") ||
        firstKey.startsWith("set_") ||
        firstKey === "hardwareItems" ||
        firstKey === "serviceItems" ||
        ["leadTime", "warranty", "commercialNote"].includes(firstKey)
      ) {
        setActiveProposalTab(3);
      } else if (firstKey === "terms") {
        setActiveProposalTab(4);
      }
    }
    setTimeout(() => {
      const el = document.getElementById(`field-${firstKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus?.();
      }
    }, 60);
  };

  // Unified Save Quotation Handler: auto-saves DRAFT if half-filled, or COMPLETED if all required fields are filled
  const handleSave = async (andDownload = false) => {
    const missing = getFormValidation();
    const isComplete = Object.keys(missing).length === 0;
    const targetStatus: "DRAFT" | "COMPLETED" = isComplete ? "COMPLETED" : "DRAFT";

    if (andDownload && !isComplete) {
      setUnfilledFields(missing);
      const missingList = Object.values(missing);
      setMessage({
        type: "error",
        text: `Cannot download quotation. Please fill in required fields: ${missingList.join(", ")}.`,
      });
      scrollToFirstError(missing);
      return;
    }

    if (!isComplete) {
      setUnfilledFields(missing);
    } else {
      setUnfilledFields({});
    }

    let currentNo = quotationNo.trim();
    if (!currentNo) {
      try {
        const res = await fetch(`/api/rad/next-number?type=${quotationType}`);
        if (res.ok) {
          const data = await res.json();
          if (data.quotationNo) {
            currentNo = data.quotationNo;
            setQuotationNo(currentNo);
          }
        }
      } catch {}
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = preparePayload(targetStatus);
      const endpoint = savedQuotationId
        ? `/api/rad/quotations/${savedQuotationId}`
        : "/api/rad/quotations";
      const method = savedQuotationId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save quotation");
      }

      const data = await res.json();
      const newId = data?.quotation?.id || savedQuotationId;
      if (newId) {
        setSavedQuotationId(newId);
        try {
          window.history.replaceState(null, "", `/rad/${newId}/edit`);
        } catch {}
      }

      setLastSavedSnapshot(currentPayloadStr);
      markAsSaved();

      setQuotationStatus(targetStatus);

      if (targetStatus === "DRAFT") {
        const missingList = Object.values(missing);
        setMessage({
          type: "info",
          text: `Quotation saved as DRAFT (partially filled). Unfilled required fields are highlighted in red: ${missingList.join(", ")}.`,
        });
        scrollToFirstError(missing);
      } else {
        setMessage({
          type: "success",
          text: `Quotation ${quotationNo || currentNo} saved and finalized successfully!`,
        });
        if (andDownload) {
          await executePdfDownload();
        }
      }
    } catch (err: any) {
      console.error("Save failed:", err);
      setMessage({
        type: "error",
        text: err?.message || "Failed to save quotation",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Direct PDF Download
  const handleDownloadDirect = async () => {
    const missing = getFormValidation();
    const isComplete = Object.keys(missing).length === 0;

    if (!isComplete) {
      setUnfilledFields(missing);
      const missingList = Object.values(missing);
      setMessage({
        type: "error",
        text: `Cannot download quotation. Please fill in required fields: ${missingList.join(", ")}.`,
      });
      scrollToFirstError(missing);
      return;
    }

    setUnfilledFields({});
    await executePdfDownload();
  };

  const executePdfDownload = async () => {
    setIsGeneratingPdf(true);
    try {
      const payload = preparePayload("COMPLETED");
      const pdfData: RdQuotationPdfData = {
        type: payload.type,
        quotationNo: payload.quotationNo,
        registrationNo: payload.registrationNo,
        projectTitle: payload.projectTitle,
        preparedDate: payload.preparedDate,
        expireDate: payload.expireDate,
        validityDays: validityDays,
        paymentMethod: payload.paymentMethod,
        advancePercent: Number(advancePercent) || 60,
        preparedBy: payload.preparedBy,
        quotationTo: payload.quotationTo,
        leadTime: payload.leadTime,
        warranty: payload.warranty,
        hardwareTotal: payload.hardwareTotal,
        servicesTotal: payload.servicesTotal,
        totalAmount: payload.totalAmount,
        overview: payload.overview,
        overviewFontSize: Number(overviewFontSize) || 22.0,
        termsFontSize: Number(termsFontSize) || 22.0,
        commercialNote:
          quotationType === "PROJECT_PROPOSAL"
            ? proposalSets[0]?.commercialNote || null
            : commercialNote.trim() || null,
        technicalSpecs: payload.technicalSpecs,
        proposalSets:
          quotationType === "PROJECT_PROPOSAL"
            ? proposalSets.map((s) => ({
                id: s.id,
                title: s.title,
                leadTime: s.leadTime,
                warranty: s.warranty,
                systemDesignImages: s.systemDesignImages,
                hardwareItems: s.hardwareItems.map((h, i) => ({
                  itemIndex: i + 1,
                  itemType: "HARDWARE" as const,
                  productOrService: h.productOrService || "Component",
                  quantity: Number(h.quantity) || 1,
                  unitPrice: Number(h.unitPrice) || 0,
                  totalPrice: (Number(h.quantity) || 1) * (Number(h.unitPrice) || 0),
                })),
                serviceItems: s.serviceItems.map((srv, i) => ({
                  itemIndex: i + 1,
                  itemType: "SERVICE" as const,
                  productOrService: srv.productOrService || "Service",
                  quantity: Number(srv.quantity) || 1,
                  unitPrice: Number(srv.unitPrice) || 0,
                  totalPrice: (Number(srv.quantity) || 1) * (Number(srv.unitPrice) || 0),
                })),
                hardwareTotal: s.hardwareTotal ? Number(s.hardwareTotal) : null,
                servicesTotal: s.servicesTotal ? Number(s.servicesTotal) : null,
                commercialNote: s.commercialNote || null,
              }))
            : null,
        systemDesignImages:
          quotationType === "PROJECT_PROPOSAL"
            ? proposalSets.flatMap((s) => s.systemDesignImages)
            : systemDesignImages,
        termsAndConditions: payload.termsAndConditions,
        bankDetails:
          bankAccounts.find((b) => b.id === selectedBankAccountId) ||
          bankAccounts.find((b) => b.isDefault) ||
          bankAccounts[0] ||
          null,
        items: payload.items.map((it) => ({
          itemIndex: it.itemIndex,
          itemType: it.itemType,
          productOrService: it.productOrService,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          notes: it.notes,
        })),
      };

      const doc = await generateRdQuotationPdf(pdfData);
      const safeNumber = (quotationNo || "RD-QUOTATION").replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );
      doc.save(`${safeNumber}.pdf`);
      setMessage({
        type: "success",
        text: "Quotation PDF generated successfully!",
      });
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      setMessage({
        type: "error",
        text: err?.message || "Failed to generate PDF",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const typeConfig = {
    PROJECT_PROPOSAL: {
      title: "Create Project Proposal",
      subtitle: "Hardware BOM, engineering services, milestones & total investment (PQV Series)",
      icon: Lightbulb,
      color: "text-teal-400",
      activeTabClass: "bg-teal-600 text-white",
      savedLabel: "Saved Proposals",
      formLabel: "New Project Proposal",
      backHref: "/rad/project-proposal",
    },
    THREE_D_PRINT: {
      title: "Create 3D Print Quotation",
      subtitle: "3D printing parameters, materials, layer precision & turnaround (QV Series)",
      icon: Printer,
      color: "text-amber-400",
      activeTabClass: "bg-amber-600 text-white",
      savedLabel: "Saved Quotations",
      formLabel: "New 3D Print Quote",
      backHref: "/rad/3d-print",
    },
    PCB: {
      title: "Create PCB Fabrication Plan",
      subtitle: "PCB fabrication specifications, copper weight, layers & lead time (QV Series)",
      icon: Cpu,
      color: "text-emerald-400",
      activeTabClass: "bg-emerald-600 text-white",
      savedLabel: "Saved Plans",
      formLabel: "New PCB Plan",
      backHref: "/rad/pcb",
    },
    UNI_QUOTATION: {
      title: "Create Uni Quotation",
      subtitle: "University project proposal with components table, images & engineering charges (PQV Series)",
      icon: GraduationCap,
      color: "text-blue-400",
      activeTabClass: "bg-blue-600 text-white",
      savedLabel: "Saved Quotations",
      formLabel: "New Uni Quotation",
      backHref: "/rad/uni-quotation",
    },
  }[quotationType];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="space-y-6 w-full pb-20">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href={typeConfig.backHref}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Back to quotations list"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                {typeConfig.title}
              </h1>
              <p className="text-xs text-slate-400">
                {typeConfig.subtitle}
              </p>
            </div>
          </div>

          {/* Navigation Pill Tabs & Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Pill Tabs matching Inspection / Handover */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <Link
                href={typeConfig.backHref}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
                title={`View ${typeConfig.savedLabel}`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>{typeConfig.savedLabel}</span>
              </Link>
              <div
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm ${typeConfig.activeTabClass}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{typeConfig.formLabel}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadDirect}
              disabled={isGeneratingPdf}
              title="Download PDF (checks required fields)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition-colors"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <Download className="w-4 h-4 text-teal-400" />
              )}
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-colors disabled:opacity-50"
              title="Save quotation (auto-draft if partially filled, final save if complete)"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Quotation
            </button>
          </div>
        </div>

        {/* Floating Save / Action Popup Notification (Fixed in Viewport) */}
        {message && (
          <div className="fixed top-6 right-6 z-[9999] max-w-md w-full sm:w-auto min-w-[340px] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-2xl backdrop-blur-md ${
                message.type === "success"
                  ? "bg-emerald-950/95 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50"
                  : message.type === "info"
                  ? "bg-amber-950/95 border-amber-500/80 text-amber-200 shadow-amber-950/50"
                  : "bg-rose-950/95 border-rose-500/80 text-rose-200 shadow-rose-950/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {message.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : message.type === "info" ? (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider">
                    {message.type === "success"
                      ? "Quotation Saved"
                      : message.type === "info"
                      ? "Quotation Notice"
                      : "Action Required"}
                  </div>
                  <div className="text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">
                    {message.text}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors -mr-1 -mt-1"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      {/* Main Form Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Form Column (3/4 width: 75% / 9 cols) */}
        <div className="lg:col-span-9 xl:col-span-9 space-y-5 min-w-0">
          {/* Project Proposal Stepper Tabs */}
          {quotationType === "PROJECT_PROPOSAL" && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                {PROPOSAL_STEPS.map((s, idx) => {
                  const isActive = activeProposalTab === s.step;
                  const isDone = s.isComplete;
                  return (
                    <div key={s.step} className="flex items-center flex-1 last:flex-none">
                      <button
                        type="button"
                        onClick={() => setActiveProposalTab(s.step)}
                        className={`flex items-center gap-2.5 p-1.5 sm:p-2 rounded-xl transition-all text-left w-full sm:w-auto ${
                          isActive
                            ? "bg-slate-800/90 ring-2 ring-teal-500/70 border border-teal-500/50 shadow-md shadow-teal-950/50"
                            : isDone
                            ? "hover:bg-slate-800/60"
                            : "hover:bg-slate-800/40 opacity-80 hover:opacity-100"
                        }`}
                      >
                        {/* Number Circle with Fill Color */}
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-all ${
                            isDone
                              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black ring-2 ring-emerald-400"
                              : isActive
                              ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30 font-black ring-2 ring-teal-300"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : s.step}
                        </div>

                        {/* Step Info */}
                        <div className="hidden md:block min-w-0 pr-1">
                          <div
                            className={`text-xs font-bold leading-tight truncate ${
                              isActive
                                ? "text-teal-300"
                                : isDone
                                ? "text-emerald-300"
                                : "text-slate-300"
                            }`}
                          >
                            {s.title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate leading-tight">
                            {isDone ? "Completed ✓" : s.sub}
                          </div>
                        </div>
                      </button>

                      {/* Connecting Bar */}
                      {idx < PROPOSAL_STEPS.length - 1 && (
                        <div className="hidden lg:block flex-1 mx-2 h-0.5 rounded-full overflow-hidden bg-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isDone ? "bg-emerald-500/80 w-full" : "w-0"
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 1: General Quotation Information & Slide 1 Project Title */}
          {(quotationType !== "PROJECT_PROPOSAL" || activeProposalTab === 1) && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              General Quotation Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-400">
                    Quotation Number *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateNumber}
                    disabled={isLoadingNumber}
                    className="text-[11px] text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="field-quotationNo"
                    type="text"
                    value={quotationNo}
                    onChange={(e) => {
                      setQuotationNo(e.target.value);
                      if (e.target.value.trim()) clearFieldError("quotationNo");
                    }}
                    placeholder={
                      quotationType === "PROJECT_PROPOSAL"
                        ? "e.g. 20261117PQV1"
                        : "e.g. 20261118QV1"
                    }
                    className={`w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none transition-colors ${
                      unfilledFields["quotationNo"]
                        ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white placeholder-red-300/60"
                        : "bg-slate-950 border border-slate-700 text-white focus:border-teal-500"
                    }`}
                  />
                  {isLoadingNumber && (
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400 absolute right-3 top-2.5" />
                  )}
                </div>
                {unfilledFields["quotationNo"] && (
                  <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    <span>Quotation number is required</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Registration No
                </label>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Prepared By (Author) *
                </label>
                <input
                  id="field-preparedBy"
                  type="text"
                  value={preparedBy}
                  onChange={(e) => {
                    setPreparedBy(e.target.value);
                    if (e.target.value.trim()) clearFieldError("preparedBy");
                  }}
                  placeholder="e.g. Supun Wijesooriya"
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                    unfilledFields["preparedBy"]
                      ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white placeholder-red-300/60"
                      : "bg-slate-950 border border-slate-700 text-white focus:border-teal-500"
                  }`}
                />
                {unfilledFields["preparedBy"] && (
                  <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    <span>Prepared By (Author) is required</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Prepared Date *
                </label>
                <input
                  id="field-preparedDate"
                  type="date"
                  value={preparedDate}
                  onChange={(e) => {
                    setPreparedDate(e.target.value);
                    if (e.target.value) clearFieldError("preparedDate");
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                    unfilledFields["preparedDate"]
                      ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white"
                      : "bg-slate-950 border border-slate-700 text-white focus:border-teal-500"
                  }`}
                />
                {unfilledFields["preparedDate"] && (
                  <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    <span>Prepared Date is required</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Validity Period (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={validityDays}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValidityDays(v);
                    const num = Number(v);
                    if (!isNaN(num) && num > 0 && preparedDate) {
                      const base = new Date(preparedDate);
                      if (!isNaN(base.getTime())) {
                        const exp = new Date(base);
                        exp.setDate(exp.getDate() + num);
                        setExpireDate(exp.toISOString().split("T")[0]);
                        clearFieldError("expireDate");
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Expiry Date *
                </label>
                <input
                  id="field-expireDate"
                  type="date"
                  value={expireDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExpireDate(v);
                    if (v) clearFieldError("expireDate");
                    if (v && preparedDate) {
                      const p = new Date(preparedDate).getTime();
                      const ex = new Date(v).getTime();
                      if (!isNaN(p) && !isNaN(ex)) {
                        const diff = Math.round((ex - p) / (1000 * 60 * 60 * 24));
                        if (diff > 0) setValidityDays(diff);
                      }
                    }
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                    unfilledFields["expireDate"]
                      ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white"
                      : "bg-slate-950 border border-slate-700 text-white focus:border-teal-500"
                  }`}
                />
                {unfilledFields["expireDate"] && (
                  <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    <span>{unfilledFields["expireDate"]}</span>
                  </p>
                )}
              </div>

              {/* Settlement Bank Account & Payment Method */}
              <div
                id="field-settlementAndPayment"
                className={`sm:col-span-2 lg:col-span-5 bg-slate-950/80 rounded-xl p-4 space-y-4 border transition-colors ${
                  unfilledFields["bankAccount"] || unfilledFields["paymentMethod"] || unfilledFields["advancePercent"]
                    ? "border-amber-500/80 bg-amber-950/10"
                    : "border-slate-800"
                }`}
              >
                {/* Settlement Bank Account */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-teal-400" />
                      <span>Settlement Bank Account * (Printed on Document &amp; Bank Details)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBankModal(true)}
                      className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>+ Manage / Add Bank Account</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <div className="md:col-span-2">
                      <select
                        id="field-bankAccount"
                        value={selectedBankAccountId}
                        onChange={(e) => {
                          setSelectedBankAccountId(e.target.value);
                          if (e.target.value) clearFieldError("bankAccount");
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-xs font-medium focus:outline-none cursor-pointer transition-colors ${
                          unfilledFields["bankAccount"]
                            ? "border-2 border-red-500 bg-red-950/30 text-white"
                            : "bg-slate-900 border border-slate-700 text-white focus:border-teal-500"
                        }`}
                      >
                        <option value="" disabled className="bg-slate-900 text-slate-400">
                          -- Select Settlement Bank Account --
                        </option>
                        {bankAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                            {acc.bankName} - {acc.accountNumber} ({acc.branch}){acc.isDefault ? " [DEFAULT]" : ""}
                          </option>
                        ))}
                      </select>
                      {unfilledFields["bankAccount"] && (
                        <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                          <span>{unfilledFields["bankAccount"]}</span>
                        </p>
                      )}
                    </div>
                    {bankAccounts.find((b) => b.id === selectedBankAccountId) && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 leading-snug">
                        <span className="text-slate-300 font-medium">Beneficiary:</span>{" "}
                        {bankAccounts.find((b) => b.id === selectedBankAccountId)?.accountName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Method & Advance Percentage */}
                <div className="border-t border-slate-800/80 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Payment Method Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-teal-400" />
                        Payment Method *
                      </label>
                      <select
                        id="field-paymentMethod"
                        value={paymentMethod}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentMethod(val);
                          clearFieldError("paymentMethod");
                          if (val === "ADVANCE_PAYMENT" && !advancePercent) {
                            setAdvancePercent(80);
                          }
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-xs font-medium focus:outline-none transition-colors ${
                          unfilledFields["paymentMethod"]
                            ? "border-2 border-red-500 bg-red-950/30 text-white"
                            : "bg-slate-900 border border-slate-700 text-white focus:border-teal-500"
                        }`}
                      >
                        <option value="ADVANCE_PAYMENT">Advance Payment + Balance</option>
                        <option value="FULL_PAYMENT">100% Full Payment</option>
                        <option value="CREDIT">Corporate Credit</option>
                      </select>
                      {unfilledFields["paymentMethod"] && (
                        <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                          <span>{unfilledFields["paymentMethod"]}</span>
                        </p>
                      )}
                    </div>

                    {/* Advance Payment Percentage Input (shown when ADVANCE_PAYMENT) */}
                    {paymentMethod === "ADVANCE_PAYMENT" ? (
                      <div className="md:col-span-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-teal-400" />
                            Advance Payment Percentage *
                          </label>
                          <div className="flex items-center gap-1.5">
                            {[50, 60, 70, 80, 90].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  setAdvancePercent(pct);
                                  clearFieldError("advancePercent");
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                  Number(advancePercent) === pct
                                    ? "bg-teal-500 text-slate-950"
                                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                          <div className="relative">
                            <input
                              id="field-advancePercent"
                              type="number"
                              min="1"
                              max="99"
                              step="1"
                              value={advancePercent}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAdvancePercent(val);
                                if (val && Number(val) > 0 && Number(val) <= 100) {
                                  clearFieldError("advancePercent");
                                }
                              }}
                              placeholder="80"
                              className={`w-full rounded-lg pl-3 pr-8 py-2 text-xs font-mono font-bold focus:outline-none transition-colors ${
                                unfilledFields["advancePercent"]
                                  ? "border-2 border-red-500 bg-red-950/30 text-white"
                                  : "bg-slate-950 border border-slate-700 text-teal-400 focus:border-teal-500"
                              }`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                              %
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-300 bg-slate-950/80 px-2.5 py-1.5 rounded border border-slate-800">
                            <div>
                              Advance:{" "}
                              <strong className="text-teal-400 font-bold">
                                {advancePercent || 80}%
                              </strong>{" "}
                              ({formatLKR((totalAmount * (Number(advancePercent) || 80)) / 100)})
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              Balance:{" "}
                              <span>
                                {100 - (Number(advancePercent) || 80)}%
                              </span>{" "}
                              ({formatLKR(totalAmount - (totalAmount * (Number(advancePercent) || 80)) / 100)})
                            </div>
                          </div>
                        </div>

                        {unfilledFields["advancePercent"] && (
                          <p className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                            <span>{unfilledFields["advancePercent"]}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="md:col-span-2 text-xs text-slate-400 flex items-center bg-slate-900/40 p-3 rounded-lg border border-slate-800/60">
                        {paymentMethod === "FULL_PAYMENT"
                          ? "Client settles 100% full invoice amount upon order / document sign-off."
                          : "Official corporate credit terms apply with deferred settlement invoice."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quotation To (Customer / Client) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Quotation To (Customer Name, Organization &amp; Address) *
              </label>
              <textarea
                id="field-quotationTo"
                rows={2}
                value={quotationTo}
                onChange={(e) => {
                  setQuotationTo(e.target.value);
                  if (e.target.value.trim()) clearFieldError("quotationTo");
                }}
                placeholder="e.g. Apex Dynamics (Pvt) Ltd, No. 45, Technology Park, Colombo 03"
                className={`w-full rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none transition-colors ${
                  unfilledFields["quotationTo"]
                    ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white placeholder-red-300/60"
                    : "bg-slate-950 border border-slate-700 text-white focus:border-teal-500"
                }`}
              />
              {unfilledFields["quotationTo"] && (
                <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                  <span>Customer Name and Address is required</span>
                </p>
              )}
            </div>

            {/* Uni Quotation Specific Header Fields */}
            {quotationType === "UNI_QUOTATION" && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-blue-400 mb-1">
                      Project Proposal Title * (e.g. Cartridge Lighting System)
                    </label>
                    <input
                      id="field-projectTitle"
                      type="text"
                      value={projectTitle}
                      onChange={(e) => {
                        setProjectTitle(e.target.value);
                        if (e.target.value.trim()) clearFieldError("projectTitle");
                      }}
                      placeholder="e.g. Cartridge Lighting System"
                      className={`w-full rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-none transition-colors ${
                        unfilledFields["projectTitle"]
                          ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white placeholder-red-300/60"
                          : "bg-slate-950 border border-slate-700 focus:border-blue-500"
                      }`}
                    />
                    {unfilledFields["projectTitle"] && (
                      <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <span>Project Proposal Title is required</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Estimated Project Completion Time *
                    </label>
                    <input
                      id="field-uniCompletionTime"
                      type="text"
                      value={uniCompletionTime}
                      onChange={(e) => {
                        setUniCompletionTime(e.target.value);
                        setLeadTime(e.target.value);
                        if (e.target.value.trim()) clearFieldError("uniCompletionTime");
                      }}
                      placeholder="e.g. 10 business working days"
                      className={`w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors ${
                        unfilledFields["uniCompletionTime"]
                          ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white placeholder-red-300/60"
                          : "bg-slate-950 border border-slate-700 focus:border-blue-500"
                      }`}
                    />
                    {unfilledFields["uniCompletionTime"] && (
                      <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <span>Estimated Project Completion Time is required</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Slide 1 & Slide 2 Fields for Project Proposal */}
            {quotationType === "PROJECT_PROPOSAL" && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-teal-400">
                      Slide 1: Project Title * (Displayed prominently on Cover Slide)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Press <kbd className="px-1 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">Enter</kbd> to break line
                    </span>
                  </div>
                  <textarea
                    id="field-projectTitle"
                    rows={2}
                    value={projectTitle}
                    onChange={(e) => {
                      setProjectTitle(e.target.value);
                      if (e.target.value.trim()) clearFieldError("projectTitle");
                    }}
                    placeholder="e.g. PETROL PUMP AUTOMATION SYSTEMS&#10;(Press Enter to break line)"
                    className={`w-full rounded-lg px-3 py-2 text-sm text-white font-semibold focus:outline-none resize-y transition-colors ${
                      unfilledFields["projectTitle"]
                        ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30 text-white placeholder-red-300/60"
                        : "bg-slate-950 border border-slate-700 focus:border-teal-500"
                    }`}
                  />
                  {unfilledFields["projectTitle"] && (
                    <p className="text-[11px] text-red-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                      <span>Project Title is required for Project Proposals</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Step 1 Navigation Footer */}
          {quotationType === "PROJECT_PROPOSAL" && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400 font-medium">
                Step 1 of 5: General Information &amp; Cover Slide
              </span>
              <button
                type="button"
                onClick={() => setActiveProposalTab(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-950/40 transition-all hover:translate-x-0.5"
              >
                <span>Next: Slide 2 Overview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Slide 2 System Overview & Introduction */}
      {quotationType === "PROJECT_PROPOSAL" && activeProposalTab === 2 && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Slide 2: System Overview &amp; Introduction * (Manual Input)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter system overview, functional objectives, and key technical capabilities for Slide 2.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setOverviewTab("write")}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    overviewTab === "write"
                      ? "bg-teal-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewTab("preview")}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    overviewTab === "preview"
                      ? "bg-teal-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Formatted Preview
                </button>
              </div>
            </div>

            {overviewTab === "write" ? (
              <div className="space-y-1.5">
                {/* Formatting Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950/80 border border-slate-800 rounded-t-lg">
                  <button
                    type="button"
                    onClick={() => insertOverviewFormat("**", "**", "Bold Text")}
                    title="Bold (**text**)"
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Bold className="w-3.5 h-3.5" />
                    <span>Bold</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertOverviewFormat("<u>", "</u>", "Underlined Text")}
                    title="Underline (<u>text</u>)"
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs underline flex items-center gap-1 transition-colors"
                  >
                    <Underline className="w-3.5 h-3.5" />
                    <span>Underline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertOverviewFormat("==", "==", "Highlighted Text")}
                    title="Highlight (==text==)"
                    className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 hover:text-amber-200 border border-amber-700/60 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Highlight</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertOverviewFormat("\n• ", "", "Key Engineering Feature")}
                    title="Bullet Point (• Feature)"
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs flex items-center gap-1 transition-colors"
                  >
                    <List className="w-3.5 h-3.5 text-orange-400" />
                    <span>Bullet List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertOverviewFormat("\n1. ", "", "Ordered Milestone Feature")}
                    title="Numbered List"
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs flex items-center gap-1 transition-colors"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-teal-400" />
                    <span>Numbered List</span>
                  </button>
                  {/* Font Size Selector */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-xs text-slate-300">
                    <Type className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <select
                      value={overviewFontSize}
                      onChange={(e) => setOverviewFontSize(e.target.value)}
                      title="Slide 2 Font Size"
                      className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="18.0" className="bg-slate-900 text-white">18pt (Compact)</option>
                      <option value="20.5" className="bg-slate-900 text-white">20.5pt (Standard)</option>
                      <option value="22.0" className="bg-slate-900 text-white">22pt (Recommended)</option>
                      <option value="24.0" className="bg-slate-900 text-white">24pt (Large)</option>
                      <option value="26.0" className="bg-slate-900 text-white">26pt (X-Large)</option>
                      <option value="28.0" className="bg-slate-900 text-white">28pt</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      insertOverviewFormat(
                        "\n• Feature Title: ",
                        "",
                        "Detailed functional capability and parameters"
                      )
                    }
                    title="Add Feature Highlight with Title"
                    className="px-2 py-1 rounded bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-800/80 text-xs font-medium flex items-center gap-1 transition-colors ml-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    <span>+ Add Feature Item</span>
                  </button>
                </div>

                <textarea
                  id="slide2-overview-textarea"
                  rows={6}
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  onKeyDown={(e) => handleAutoBulletKeyDown(e, overview, setOverview)}
                  placeholder="Enter system overview, objectives, and key features for Slide 2... Use toolbar above for Bold (**text**), Highlight (==text==), Underline (<u>text</u>), and Bullet Lists (•). Press Enter to auto-continue bullets."
                  className="w-full bg-slate-950 border border-slate-700 border-t-0 rounded-b-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono leading-relaxed"
                />
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                  <span>
                    <span className="text-teal-400 font-semibold">Slide 2 Boundary:</span> Max ~700 characters | Max 8–10 lines recommended for optimal 16:9 widescreen presentation fit.
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      overview.length > 700 || overview.split("\n").filter((l) => l.trim()).length > 10
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {overview.length}/700 chars | {overview.split("\n").filter((l) => l.trim()).length}/10 lines
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-xs text-slate-200 min-h-[140px] space-y-2">
                <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  Live Slide 2 Formatted Preview
                </div>
                {renderOverviewPreview(overview)}
              </div>
            )}
          </div>

          {/* Step 2 Navigation Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveProposalTab(1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: General Info</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveProposalTab(3)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-950/40 transition-all hover:translate-x-0.5"
            >
              <span>Next: Slide 3 Design &amp; BOM</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

          {/* Type-Specific Parameter Panel: 3D Print */}
          {quotationType === "THREE_D_PRINT" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-4 h-4" />
                3D Printing Technical Specifications
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Technology
                  </label>
                  <select
                    value={printSpecs.printingTechnology}
                    onChange={(e) =>
                      setPrintSpecs({ ...printSpecs, printingTechnology: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="FDM (Fused Deposition Modeling)">
                      FDM (Fused Deposition Modeling)
                    </option>
                    <option value="SLA (Stereolithography Resin)">
                      SLA (Stereolithography Resin)
                    </option>
                    <option value="SLS (Selective Laser Sintering)">
                      SLS (Selective Laser Sintering)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Infill Percentage
                  </label>
                  <input
                    type="text"
                    value={printSpecs.infillDensity}
                    onChange={(e) =>
                      setPrintSpecs({ ...printSpecs, infillDensity: e.target.value })
                    }
                    placeholder="e.g. 20% (Standard Rigid)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                    <span>Material</span>
                    <span className="text-[11px] text-amber-300 font-mono font-medium">
                      {printSpecs.materialDensity ?? getMaterialDensity(printSpecs.material)} g/cm³
                    </span>
                  </label>
                  <div className="space-y-1.5">
                    <select
                      value={
                        ["PLA", "ABS", "TPU (Flexible)", "PETG", "PETT", "HIPS", "Standard Resin", "Tough Resin", "Nylon"].includes(
                          printSpecs.material
                        )
                          ? printSpecs.material
                          : "CUSTOM"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        const mat = val === "CUSTOM" ? "Custom Material" : val;
                        const density = getMaterialDensity(mat);
                        const updated: any = {
                          ...printSpecs,
                          material: mat,
                          materialDensity: density,
                        };
                        if (mat === "PLA") {
                          updated.availableColors = "White, Black, Transparent";
                        } else if (mat.includes("TPU") || mat.includes("Flexible")) {
                          updated.availableColors = "White";
                        }
                        setPrintSpecs(updated);
                        // Automatically recalculate all auto line items with this material & density
                        setItems((prev) =>
                          prev.map((it) => {
                            const mode = it.calcMode || updated.pricingMode || "AUTO";
                            const mins = it.printTimeMinutes !== undefined && it.printTimeMinutes !== ""
                              ? Number(it.printTimeMinutes)
                              : (Number(it.printTimeHours) || 0) * 60;
                            if (mode === "AUTO" && (it.filamentLengthM || mins)) {
                              const price = updated.filamentPricePerKg ?? updated.filamentPricePerSpool ?? 10000;
                              const diameter = updated.filamentDiameterMm ?? 1.75;
                              const calc = calculate3DPrintPrice(
                                it.filamentLengthM || 0,
                                mins || 0,
                                price,
                                updated.costPerHour ?? 200,
                                updated.markupPercent ?? 35,
                                density,
                                diameter
                              );
                              return {
                                ...it,
                                unitPrice: calc.unitPrice,
                              };
                            }
                            return it;
                          })
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
                    >
                      <option value="PLA">PLA (Polylactic Acid - 1.27 g/cm³)</option>
                      <option value="TPU (Flexible)">TPU / Flexible (1.30 g/cm³)</option>
                      <option value="ABS">ABS (Acrylonitrile Butadiene Styrene - 1.05 g/cm³)</option>
                      <option value="PETG">PETG (Polyethylene Terephthalate - 1.25 g/cm³)</option>
                      <option value="PETT">PETT (T-Glase - 1.45 g/cm³)</option>
                      <option value="HIPS">HIPS (High Impact Polystyrene - 1.04 g/cm³)</option>
                      <option value="Standard Resin">Standard Resin (1.15 g/cm³)</option>
                      <option value="Tough Resin">Tough Resin (1.15 g/cm³)</option>
                      <option value="Nylon">Nylon (1.14 g/cm³)</option>
                      <option value="CUSTOM">Custom / Other Material...</option>
                    </select>
                    {!["PLA", "ABS", "TPU (Flexible)", "PETG", "PETT", "HIPS", "Standard Resin", "Tough Resin", "Nylon"].includes(
                      printSpecs.material
                    ) && (
                      <input
                        type="text"
                        value={printSpecs.material}
                        onChange={(e) => {
                          const mat = e.target.value;
                          const density = getMaterialDensity(mat);
                          const updated = { ...printSpecs, material: mat, materialDensity: density };
                          setPrintSpecs(updated);
                        }}
                        placeholder="Enter custom material name (e.g. Carbon Fiber PLA)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Layer Height / Precision
                  </label>
                  <input
                    type="text"
                    value={printSpecs.printQuality}
                    onChange={(e) =>
                      setPrintSpecs({
                        ...printSpecs,
                        printQuality: e.target.value,
                      })
                    }
                    placeholder="e.g. 0.2 mm (Standard)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Lead Time
                  </label>
                  <input
                    type="text"
                    value={printSpecs.leadTime}
                    onChange={(e) =>
                      setPrintSpecs({ ...printSpecs, leadTime: e.target.value })
                    }
                    placeholder="e.g. 2 - 4 Working Days"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Colors / Finish Multi-Select & Add */}
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Colors / Finish (Select multiple presets or add new)
                  </label>
                  <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    {/* Selected Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 min-h-[30px]">
                      {selectedPrintColors.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">
                          No colors selected (choose presets below or add new)
                        </span>
                      ) : (
                        selectedPrintColors.map((color) => (
                          <span
                            key={color}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 border border-amber-800 text-amber-300"
                          >
                            {color}
                            <button
                              type="button"
                              onClick={() => handleRemovePrintColor(color)}
                              className="text-amber-400 hover:text-white text-xs font-bold"
                              title="Remove color"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Presets & Dropdown */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                      <span className="text-[11px] font-semibold text-slate-400">Presets:</span>
                      {["White", "Black", "Transparent", "Grey", "Red", "Blue", "Green", "Yellow"].map((c) => {
                        const isSelected = selectedPrintColors.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleTogglePrintColor(c)}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              isSelected
                                ? "bg-amber-600 text-white font-semibold shadow-sm"
                                : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                            }`}
                          >
                            {isSelected ? `✓ ${c}` : `+ ${c}`}
                          </button>
                        );
                      })}

                      {/* Dropdown to pick more colors */}
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleTogglePrintColor(e.target.value);
                          }
                        }}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">+ More colors...</option>
                        <option value="Orange">Orange</option>
                        <option value="Purple">Purple</option>
                        <option value="Brown">Brown</option>
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Bronze">Bronze</option>
                        <option value="Matte Black">Matte Black</option>
                        <option value="Glow in the Dark">Glow in the Dark</option>
                      </select>
                    </div>

                    {/* Add Custom Color Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={customColorInput}
                        onChange={(e) => setCustomColorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomPrintColor();
                          }
                        }}
                        placeholder="Add custom color name (e.g. Matte Navy, Silk Silver)..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPrintColor}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors shrink-0"
                      >
                        + Add Color
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Type-Specific Parameter Panel: PCB */}
          {quotationType === "PCB" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    PCB Artwork & Design Previews
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Upload PCB design images, Gerber previews, or schematics to display below the table in the generated PDF.
                  </p>
                </div>
                <div className="text-xs text-emerald-400/80 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 self-start sm:self-auto">
                  Fixed Terms Applied from Template
                </div>
              </div>

              {/* Lead Time Field */}
              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Production Lead Time & Contingencies
                </label>
                <input
                  type="text"
                  value={pcbLeadTime}
                  onChange={(e) => setPcbLeadTime(e.target.value)}
                  placeholder="e.g. 12 - 21 Days"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Upload Zone */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Upload PCB Artwork Images (PNG, JPG, WEBP)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-colors">
                    {isUploadingPcbImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{isUploadingPcbImage ? "Uploading..." : "Upload Images"}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePcbImageUpload}
                      className="hidden"
                      disabled={isUploadingPcbImage}
                    />
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Recommended: 1 to 3 images (matches Word template layout)
                  </span>
                </div>

                {pcbUploadError && (
                  <p className="text-xs text-rose-400">{pcbUploadError}</p>
                )}

                {/* Previews */}
                {pcbImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                    {pcbImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-lg border border-slate-700 bg-slate-950 p-2 overflow-hidden flex flex-col items-center shadow"
                      >
                        <img
                          src={imgUrl}
                          alt={`PCB Preview ${idx + 1}`}
                          className="w-full h-24 object-contain rounded bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePcbImage(idx)}
                          className="absolute top-2 right-2 p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-full transition-opacity shadow"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-400 mt-1 truncate max-w-full">
                          Preview {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bill of Materials & Services Section */}
          {quotationType === "PROJECT_PROPOSAL" ? (
            <>
              {/* Tab 3: Slide 3 Design Images + Slide 4 BOM, Services, Lead Time, Warranty & Notes (Paired Sets Repeater) */}
              {activeProposalTab === 3 && (() => {
                const currentSet = proposalSets[activeSetIndex] || proposalSets[0];
                const setHwTotalNum = Number(currentSet.hardwareTotal) || 0;
                const setSrvTotalNum = Number(currentSet.servicesTotal) || 0;
                const setSubtotal = setHwTotalNum + setSrvTotalNum;

                return (
                  <div className="space-y-5">
                    {/* Top Proposal Set Selector Sub-Bar */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-teal-400" />
                          Proposal Sets:
                        </span>
                        {proposalSets.map((s, idx) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setActiveSetIndex(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              activeSetIndex === idx
                                ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 ring-1 ring-teal-300 font-black"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60"
                            }`}
                          >
                            <span>Set {idx + 1}</span>
                            <span className="text-[10px] opacity-80 font-normal">
                              ({s.systemDesignImages.length} img, {s.hardwareItems.length} HW, {s.serviceItems.length} Srv)
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={handleAddSet}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-950/80 border border-teal-800/80 hover:bg-teal-900 text-teal-300 transition-colors"
                          title="Add a new set"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Set</span>
                        </button>
                        {proposalSets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSet(activeSetIndex)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 transition-colors"
                            title="Delete active set"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Set</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Set Title & Header Banner */}
                    <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-950 text-teal-300 border border-teal-800/60">
                          Set {activeSetIndex + 1} of {proposalSets.length}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">
                          Configuring Slide 3 (Design) &amp; Slide 4 (BOM, Pricing, Lead Time, Warranty &amp; Note)
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-teal-400 font-semibold">
                        Set Subtotal: LKR {setSubtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Estimated Lead Time & Warranty */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Clock className="w-4 h-4 text-teal-400" />
                        Estimated Lead Time &amp; Warranty (Set {activeSetIndex + 1})
                      </h2>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-teal-400" />
                            Estimated Lead Time *
                          </label>
                          <input
                            type="text"
                            value={currentSet.leadTime}
                            onChange={(e) => updateActiveSet((s) => ({ ...s, leadTime: e.target.value }))}
                            placeholder="e.g. 10 Working Days"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-teal-400" />
                            Warranty &amp; Support *
                          </label>
                          <input
                            type="text"
                            value={currentSet.warranty}
                            onChange={(e) => updateActiveSet((s) => ({ ...s, warranty: e.target.value }))}
                            placeholder="e.g. 1 Year"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Slide 3: System Design & Architecture Images */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Slide 3: System Design &amp; Architecture Images
                          </h2>
                          <p className="text-xs text-slate-400">
                            Upload hardware, module, or architecture diagram images (Maximum of 8 images, auto-resized into clean rows on Slide 3)
                          </p>
                        </div>
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-800 text-teal-300 border border-slate-700 w-fit">
                          {currentSet.systemDesignImages.length} / 8 Uploaded
                        </span>
                      </div>

                      {/* Upload Drop Zone / Button */}
                      {currentSet.systemDesignImages.length < 8 && (
                        <label className="border-2 border-dashed border-slate-700 hover:border-teal-500/70 bg-slate-950/50 hover:bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleActiveSetDesignImageUpload}
                            disabled={isUploadingDesignImages}
                            className="hidden"
                          />
                          {isUploadingDesignImages ? (
                            <div className="flex items-center gap-2 text-xs text-teal-400">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Uploading design image...</span>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-teal-400" />
                              <span className="text-xs font-semibold text-slate-300">
                                Click or drag images to upload for Slide 3
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Supports PNG, JPG, WebP. Maximum 8 images total.
                              </span>
                            </>
                          )}
                        </label>
                      )}

                      {/* Thumbnails Grid */}
                      {currentSet.systemDesignImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                          {currentSet.systemDesignImages.map((imgUrl, idx) => (
                            <div
                              key={idx}
                              className="group relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950 h-28 flex items-center justify-center p-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={`Design image ${idx + 1}`}
                                className="max-h-full max-w-full object-contain"
                              />
                              <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-teal-300 border border-slate-700">
                                #{idx + 1} • Slide 3
                              </span>
                              <button
                                type="button"
                                onClick={() => handleActiveSetRemoveDesignImage(idx)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/90 text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                title="Remove image"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 1. Hardware BOM List */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                            <Package className="w-4 h-4 text-teal-400" />
                            1. Hardware Components (BOM)
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-teal-950/70 text-teal-300 border-teal-800/60">
                              {currentSet.hardwareItems.length}/4 (Max 4)
                            </span>
                          </h2>
                          <p className="text-xs text-slate-400">
                            Physical components and modules (Max 4 items on Slide 4).
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleActiveSetAddItem("HARDWARE")}
                          disabled={currentSet.hardwareItems.length >= 4}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto ${
                            currentSet.hardwareItems.length >= 4
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                              : "bg-teal-950/70 border border-teal-800/80 hover:bg-teal-900/60 text-teal-300"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Add Hardware
                        </button>
                      </div>

                      {/* Hardware Items List */}
                      <div className="space-y-2.5">
                        {currentSet.hardwareItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            No hardware components added yet. Click &ldquo;+ Add Hardware&rdquo; to add components.
                          </div>
                        ) : (
                          currentSet.hardwareItems.map((item, hIdx) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                            >
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="w-6 h-6 rounded-full bg-slate-800 text-teal-300 text-xs font-bold flex items-center justify-center">
                                  {hIdx + 1}
                                </span>
                              </div>

                              <div className="flex-1 w-full">
                                <input
                                  type="text"
                                  value={item.productOrService}
                                  onChange={(e) => handleActiveSetItemChange(item.id, "productOrService", e.target.value)}
                                  placeholder="Component description (e.g. Arduino Nano, Modbus Converter...)"
                                  className="w-full rounded-lg px-3 py-2 text-xs text-white bg-slate-900 border border-slate-700 focus:outline-none focus:border-teal-500 transition-colors"
                                />
                              </div>

                              <div className="w-28 shrink-0 flex flex-col items-center">
                                <div className="flex items-center gap-1.5 w-full">
                                  <span className="text-[11px] text-slate-400">Qty:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      handleActiveSetItemChange(item.id, "quantity", val);
                                    }}
                                    className="w-full rounded-lg px-2.5 py-2 text-xs font-bold font-mono focus:outline-none text-center bg-slate-900 border border-slate-700 text-teal-400 focus:border-teal-500 transition-colors"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetSetItemId(item.id);
                                    setIsProductModalOpen(true);
                                  }}
                                  className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                                  title="Import from PMS inventory"
                                >
                                  <Search className="w-3 h-3 text-teal-400" />
                                  <span>PMS</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleActiveSetRemoveItem(item.id)}
                                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                  title="Delete hardware component"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Hardware Full Price Box */}
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-teal-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider">
                            Slide 4: Hardware Components Full Price (LKR) *
                          </label>
                          <span className="text-[11px] text-slate-400">
                            Total hardware BOM price printed on Slide 4.
                          </span>
                        </div>
                        <div className="w-full sm:w-64">
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentSet.hardwareTotal}
                              onChange={(e) => updateActiveSet((s) => ({ ...s, hardwareTotal: e.target.value }))}
                              placeholder="e.g. 286440.00"
                              className="w-full bg-slate-900 border border-teal-600/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono font-bold text-right focus:outline-none focus:border-teal-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Engineering Services List */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-indigo-400" />
                            2. Engineering &amp; Professional Services
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-indigo-950/70 text-indigo-300 border-indigo-800/60">
                              {currentSet.serviceItems.length}/2 (Max 2)
                            </span>
                          </h2>
                          <p className="text-xs text-slate-400">
                            Engineering charges, installation, programming, testing &amp; calibration services (Max 2 services on Slide 4).
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleActiveSetAddItem("SERVICE")}
                          disabled={currentSet.serviceItems.length >= 2}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto ${
                            currentSet.serviceItems.length >= 2
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                              : "bg-indigo-950/70 border border-indigo-800/80 hover:bg-indigo-900/60 text-indigo-300"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Add Service
                        </button>
                      </div>

                      {/* Services List */}
                      <div className="space-y-2.5">
                        {currentSet.serviceItems.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            No engineering services added yet. Click &ldquo;+ Add Service&rdquo; to add service charges.
                          </div>
                        ) : (
                          currentSet.serviceItems.map((item, sIdx) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-lg border bg-indigo-950/20 border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                            >
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="w-6 h-6 rounded-full bg-slate-800 text-indigo-300 text-xs font-bold flex items-center justify-center">
                                  {sIdx + 1}
                                </span>
                              </div>

                              <div className="flex-1 w-full">
                                <input
                                  type="text"
                                  value={item.productOrService}
                                  onChange={(e) => handleActiveSetItemChange(item.id, "productOrService", e.target.value)}
                                  placeholder="Service description (e.g. Testing / Engineering Charges, IoT Installation...)"
                                  className="w-full rounded-lg px-3 py-2 text-xs text-white bg-slate-900 border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => handleActiveSetRemoveItem(item.id)}
                                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                  title="Delete service"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Services Full Price Box */}
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Slide 4: Engineering Services Full Price (LKR) *
                          </label>
                          <span className="text-[11px] text-slate-400">
                            Total services charge printed on Slide 4.
                          </span>
                        </div>
                        <div className="w-full sm:w-64">
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentSet.servicesTotal}
                              onChange={(e) => updateActiveSet((s) => ({ ...s, servicesTotal: e.target.value }))}
                              placeholder="e.g. 65160.00"
                              className="w-full bg-slate-900 border border-indigo-600/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono font-bold text-right focus:outline-none focus:border-indigo-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. Slide 4: Special Note / Warranty Exclusion (Optional) */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            Slide 4: Special Note / Warranty Exclusion (Optional)
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Renders an alert box on Slide 4. Leave blank to omit the box entirely.
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setCommercialNoteTab("write")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              commercialNoteTab === "write"
                                ? "bg-amber-600 text-white"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Write
                          </button>
                          <button
                            type="button"
                            onClick={() => setCommercialNoteTab("preview")}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              commercialNoteTab === "preview"
                                ? "bg-amber-600 text-white"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Formatted Preview
                          </button>
                        </div>
                      </div>

                      {commercialNoteTab === "write" ? (
                        <div className="space-y-1.5">
                          {/* Formatting Toolbar */}
                          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950/80 border border-slate-800 rounded-t-lg">
                            <button
                              type="button"
                              onClick={() => insertCommercialNoteFormat("**", "**", "Important Note:")}
                              title="Bold (**text**)"
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold flex items-center gap-1 transition-colors"
                            >
                              <Bold className="w-3.5 h-3.5" />
                              <span>Bold</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertCommercialNoteFormat("<u>", "</u>", "Underlined Note")}
                              title="Underline (<u>text</u>)"
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs underline flex items-center gap-1 transition-colors"
                            >
                              <Underline className="w-3.5 h-3.5" />
                              <span>Underline</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertCommercialNoteFormat("==", "==", "highlighted note")}
                              title="Highlight (==text==)"
                              className="px-2 py-1 rounded bg-yellow-950/70 hover:bg-yellow-900/80 text-yellow-300 border border-yellow-800/80 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Highlighter className="w-3.5 h-3.5" />
                              <span>Highlight</span>
                            </button>
                            {/* Color buttons */}
                            <button
                              type="button"
                              onClick={() => insertCommercialNoteFormat("[red]", "[/red]", "Warranty Void Condition")}
                              title="Red Text ([red]text[/red])"
                              className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                              <span>Red</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertCommercialNoteFormat("[orange]", "[/orange]", "Operating Requirement")}
                              title="Orange Text ([orange]text[/orange])"
                              className="px-2 py-1 rounded bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 border border-orange-800/80 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                              <span>Orange</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => insertCommercialNoteFormat("[teal]", "[/teal]", "Standard Condition")}
                              title="Teal Text ([teal]text[/teal])"
                              className="px-2 py-1 rounded bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-800/80 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                              <span>Teal</span>
                            </button>

                            {/* Template Insert */}
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveSet((s) => ({
                                  ...s,
                                  commercialNote:
                                    "**Warranty Exclusion:** The machine room environment is currently unsuitable for electronic equipment. The [red]warranty will remain void[/red] until the environmental conditions are corrected to meet the required operating standards.",
                                }))
                              }
                              title="Insert standard warranty exclusion note"
                              className="ml-auto px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>Insert Warranty Exclusion Template</span>
                            </button>
                          </div>

                          <textarea
                            id="slide4-note-textarea"
                            rows={3}
                            value={currentSet.commercialNote}
                            onChange={(e) => updateActiveSet((s) => ({ ...s, commercialNote: e.target.value }))}
                            placeholder="e.g. Warranty Exclusion: The machine room environment is currently unsuitable for electronic equipment. The warranty will remain void until the environmental conditions are corrected to meet the required operating standards..."
                            className="w-full bg-slate-950 border border-slate-700 border-t-0 rounded-b-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
                          />

                          {/* Limits counter */}
                          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                            <span>
                              <span className="text-amber-400 font-semibold">Slide 4 Boundary:</span> Max ~350 characters | Max 4–5 lines recommended for optimal presentation fit.
                            </span>
                            <span
                              className={`font-mono font-semibold ${
                                currentSet.commercialNote.length > 350 || currentSet.commercialNote.split("\n").filter((l) => l.trim()).length > 5
                                  ? "text-amber-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {currentSet.commercialNote.length}/350 chars | {currentSet.commercialNote.split("\n").filter((l) => l.trim()).length}/5 lines
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-xs text-slate-200 min-h-[90px] space-y-2">
                          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Live Slide 4 Note Preview (Warranty Exclusion)
                          </div>
                          {currentSet.commercialNote.trim() ? (
                            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg">
                              {renderTokensWithFormatting(currentSet.commercialNote)}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No special note entered. The box will be omitted on Slide 4.</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step 3 Navigation Footer */}
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveProposalTab(2)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back: Slide 2 Overview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveProposalTab(4)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-950/40 transition-all hover:translate-x-0.5"
                      >
                        <span>Next: Slide 5 Terms &amp; Conditions</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Tab 4: Slide 5 Terms & Conditions */}
              {activeProposalTab === 4 && (
                <div className="space-y-5">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    Slide 5: Terms &amp; Conditions
                  </h2>
                  <span className="text-xs text-teal-400/90 bg-teal-500/10 px-2.5 py-1 rounded border border-teal-500/20 self-start sm:self-auto font-medium">
                    6 Standard LK Tronics Terms Auto-Appended
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Additional Terms &amp; Conditions (Optional)
                    </label>
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setTermsTab("write")}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          termsTab === "write"
                            ? "bg-teal-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setTermsTab("preview")}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          termsTab === "preview"
                            ? "bg-teal-600 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Formatted Preview
                      </button>
                    </div>
                  </div>

                  {termsTab === "write" ? (
                    <div className="space-y-1.5">
                      {/* Terms Formatting Toolbar */}
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950/80 border border-slate-800 rounded-t-lg">
                        <button
                          type="button"
                          onClick={() => insertTermsFormat("**", "**", "Bold Term")}
                          title="Bold (**text**)"
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Bold className="w-3.5 h-3.5" />
                          <span>Bold</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTermsFormat("<u>", "</u>", "Underlined Text")}
                          title="Underline (<u>text</u>)"
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs underline flex items-center gap-1 transition-colors"
                        >
                          <Underline className="w-3.5 h-3.5" />
                          <span>Underline</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTermsFormat("==", "==", "Highlighted Term")}
                          title="Highlight (==text==)"
                          className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 hover:text-amber-200 border border-amber-700/60 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Highlighter className="w-3.5 h-3.5" />
                          <span>Highlight</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertTermsFormat("\n• ", "", "Client Requirement Term")}
                          title="Bullet Point (• Term)"
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs flex items-center gap-1 transition-colors"
                        >
                          <List className="w-3.5 h-3.5 text-orange-400" />
                          <span>Bullet List</span>
                        </button>
                        {/* Terms Font Size Selector */}
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-xs text-slate-300">
                          <Type className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <select
                            value={termsFontSize}
                            onChange={(e) => setTermsFontSize(e.target.value)}
                            title="Terms Slide Font Size"
                            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                          >
                            <option value="17.0" className="bg-slate-900 text-white">17pt (Compact)</option>
                            <option value="19.5" className="bg-slate-900 text-white">19.5pt (Standard)</option>
                            <option value="22.0" className="bg-slate-900 text-white">22pt (Recommended)</option>
                            <option value="24.0" className="bg-slate-900 text-white">24pt (Large)</option>
                            <option value="26.0" className="bg-slate-900 text-white">26pt (X-Large)</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            insertTermsFormat(
                              "\n• Term Title: ",
                              "",
                              "Detailed engineering compliance requirement or commercial condition."
                            )
                          }
                          title="Add Custom Term with Title"
                          className="px-2 py-1 rounded bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-800/80 text-xs font-medium flex items-center gap-1 transition-colors ml-auto"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                          <span>+ Add Term Item</span>
                        </button>
                      </div>

                      <textarea
                        id="slide5-terms-textarea"
                        rows={5}
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        onKeyDown={(e) => handleAutoBulletKeyDown(e, terms, setTerms)}
                        placeholder="Enter optional extra terms here (1 per line). Use toolbar above for Bold (**text**), Highlight (==text==), Underline (<u>text</u>), and Bullet Lists (•). Press Enter to auto-continue bullets."
                        className="w-full bg-slate-950 border border-slate-700 border-t-0 rounded-b-lg px-3 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500 leading-relaxed"
                      />
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                        <span>
                          <span className="text-teal-400 font-semibold">Slide 5/6 Boundary:</span> Max ~1,200 characters | Max 8–10 clauses recommended (auto-continues to Slide 6 if exceeded).
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            terms.length > 1200
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          {terms.length}/1200 chars | {terms.split("\n").filter((l) => l.trim()).length} clauses
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Standard LK Tronics engineering terms (Supervision, Warranty, Source Code, Delivery, Scope, and Environmental Conditions) are permanently included at the bottom of the proposal. Any custom terms entered above will be placed on top.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-xs text-slate-200 min-h-[140px] space-y-2">
                      <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-400" />
                        Live Slide 6 Terms &amp; Conditions Formatted Preview
                      </div>
                      {renderTermsPreview(terms)}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4 Navigation Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveProposalTab(3)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all w-full sm:w-auto justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back: Slide 3 &amp; 4 Design &amp; BOM</span>
                </button>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shadow-md transition-all"
                  >
                    <Save className="w-4 h-4 text-teal-400" />
                    <span>Save Quotation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-950/40 transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save &amp; Download PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
            /* Standard Table for THREE_D_PRINT & PCB */
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-teal-400" />
                    Quotation Line Items
                  </h2>
                  <p className="text-xs text-slate-400">
                    {quotationType === "THREE_D_PRINT"
                      ? "Add printed parts with auto-costing from length & time or manual rates"
                      : "Add quoted items with quantity and unit rates"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {quotationType === "THREE_D_PRINT" && (
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const newMode = "AUTO";
                          setPrintSpecs((prev) => ({ ...prev, pricingMode: newMode }));
                          setItems((prev) =>
                            prev.map((it) => {
                              const calc = calculate3DPrintPrice(
                                it.filamentLengthM || 0,
                                it.printTimeHours || 0,
                                printSpecs.spoolLengthMeters ?? 330,
                                printSpecs.filamentPricePerSpool ?? 6500,
                                printSpecs.costPerHour ?? 200,
                                printSpecs.markupPercent ?? 25
                              );
                              return {
                                ...it,
                                calcMode: newMode,
                                unitPrice:
                                  it.filamentLengthM || it.printTimeHours
                                    ? calc.unitPrice
                                    : it.unitPrice,
                              };
                            })
                          );
                        }}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                          (printSpecs.pricingMode || "AUTO") === "AUTO"
                            ? "bg-amber-500 text-slate-950 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Auto-calculate Unit Rate from filament length & printing time"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Auto-Calculate (Length &amp; Time)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newMode = "MANUAL";
                          setPrintSpecs((prev) => ({ ...prev, pricingMode: newMode }));
                          setItems((prev) =>
                            prev.map((it) => ({
                              ...it,
                              calcMode: newMode,
                            }))
                          );
                        }}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                          (printSpecs.pricingMode || "AUTO") === "MANUAL"
                            ? "bg-amber-500 text-slate-950 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Manually type Unit Rate (LKR)"
                      >
                        Manual Unit Rate (LKR)
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={quotationType === "UNI_QUOTATION" && items.length >= 4}
                    onClick={() => handleAddItem("HARDWARE")}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white rounded-lg text-xs font-semibold transition-colors ${
                      quotationType === "UNI_QUOTATION" && items.length >= 4
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                        : quotationType === "UNI_QUOTATION"
                        ? "bg-blue-600 hover:bg-blue-500"
                        : "bg-teal-600 hover:bg-teal-500"
                    }`}
                    title={
                      quotationType === "UNI_QUOTATION" && items.length >= 4
                        ? "Maximum 4 components allowed for Uni Quotation Table"
                        : "Add Line Item"
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {quotationType === "UNI_QUOTATION"
                      ? `+ Add Component ${items.length >= 4 ? "(Max 4 Reached)" : `(${items.length}/4)`}`
                      : "Add Line Item"}
                  </button>
                </div>
              </div>

              {/* Line Items List */}
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const is3D = quotationType === "THREE_D_PRINT";
                  const itemMode = is3D
                    ? item.calcMode || printSpecs.pricingMode || "AUTO"
                    : "MANUAL";
                  const isAuto = is3D && itemMode === "AUTO";

                  const calc = isAuto
                    ? calculate3DPrintPrice(
                        item.filamentLengthM || 0,
                        item.printTimeHours || 0,
                        printSpecs.spoolLengthMeters ?? 330,
                        printSpecs.filamentPricePerSpool ?? 6500,
                        printSpecs.costPerHour ?? 200,
                        printSpecs.markupPercent ?? 25
                      )
                    : null;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border bg-slate-950/60 border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          {is3D && (
                            <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                              <button
                                type="button"
                                onClick={() => {
                                  const newMode = "AUTO";
                                  handleItemChange(item.id, "calcMode", newMode);
                                  if (item.filamentLengthM || item.printTimeHours) {
                                    const c = calculate3DPrintPrice(
                                      item.filamentLengthM || 0,
                                      item.printTimeHours || 0,
                                      printSpecs.spoolLengthMeters ?? 330,
                                      printSpecs.filamentPricePerSpool ?? 6500,
                                      printSpecs.costPerHour ?? 200,
                                      printSpecs.markupPercent ?? 25
                                    );
                                    handleItemChange(item.id, "unitPrice", c.unitPrice);
                                  }
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  isAuto
                                    ? "bg-amber-500/20 text-amber-300 font-bold"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                Auto (L&amp;T)
                              </button>
                              <span className="text-slate-600">|</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(item.id, "calcMode", "MANUAL")
                                }
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  !isAuto
                                    ? "bg-amber-500/20 text-amber-300 font-bold"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                Manual Rate
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetItemIndex(idx);
                              setIsProductModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                            title="Import from PMS inventory"
                          >
                            <Search className="w-3 h-3 text-teal-400" />
                            <span>PMS Item</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isAuto ? (
                        /* Auto-Calculated 3D Print Layout (2 Clean Lines) */
                        <div className="space-y-3">
                          {/* Line 1: Description, Filament Length, Print Time (min), Unit Rate */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-5">
                              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                Product / Item Description *
                              </label>
                              <input
                                id={`field-item_${idx}_productOrService`}
                                type="text"
                                value={item.productOrService}
                                onChange={(e) => {
                                  handleItemChange(
                                    item.id,
                                    "productOrService",
                                    e.target.value
                                  );
                                  if (e.target.value.trim()) clearFieldError(`item_${idx}_productOrService`);
                                }}
                                placeholder="e.g. Enclosure Top Lid"
                                className={`w-full rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition-colors ${
                                  unfilledFields[`item_${idx}_productOrService`]
                                    ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30"
                                    : "bg-slate-900 border border-slate-700 focus:border-amber-500"
                                }`}
                              />
                              {unfilledFields[`item_${idx}_productOrService`] && (
                                <p className="text-[10px] text-red-400 font-medium mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                                  <span>Description is required</span>
                                </p>
                              )}
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-medium text-amber-300 mb-1 flex items-center justify-between">
                                <span>Filament Length</span>
                                <span className="text-[10px] text-slate-400">meters (m)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.filamentLengthM ?? ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value) || 0;
                                  const currentMins = item.printTimeMinutes !== undefined && item.printTimeMinutes !== ""
                                    ? item.printTimeMinutes
                                    : (Number(item.printTimeHours) || 0) * 60;
                                  const price = printSpecs.filamentPricePerKg ?? printSpecs.filamentPricePerSpool ?? 10000;
                                  const density = printSpecs.materialDensity ?? getMaterialDensity(printSpecs.material);
                                  const diameter = printSpecs.filamentDiameterMm ?? 1.75;
                                  const c = calculate3DPrintPrice(
                                    val || 0,
                                    currentMins || 0,
                                    price,
                                    printSpecs.costPerHour ?? 200,
                                    printSpecs.markupPercent ?? 35,
                                    density,
                                    diameter
                                  );
                                  setItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id
                                        ? {
                                            ...i,
                                            filamentLengthM: val,
                                            unitPrice: c.unitPrice,
                                          }
                                        : i
                                    )
                                  );
                                }}
                                placeholder="e.g. 9.2"
                                className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-medium text-amber-300 mb-1 flex items-center justify-between">
                                <span>Print Time</span>
                                <span className="text-[10px] text-slate-400">minutes (min)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.printTimeMinutes ?? (item.printTimeHours ? Number(item.printTimeHours) * 60 : "")}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? ""
                                      : parseFloat(e.target.value) || 0;
                                  const price = printSpecs.filamentPricePerKg ?? printSpecs.filamentPricePerSpool ?? 10000;
                                  const density = printSpecs.materialDensity ?? getMaterialDensity(printSpecs.material);
                                  const diameter = printSpecs.filamentDiameterMm ?? 1.75;
                                  const c = calculate3DPrintPrice(
                                    item.filamentLengthM || 0,
                                    val || 0,
                                    price,
                                    printSpecs.costPerHour ?? 200,
                                    printSpecs.markupPercent ?? 35,
                                    density,
                                    diameter
                                  );
                                  setItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id
                                        ? {
                                            ...i,
                                            printTimeMinutes: val,
                                            printTimeHours: typeof val === "number" ? Math.round((val / 60) * 100) / 100 : "",
                                            unitPrice: c.unitPrice,
                                          }
                                        : i
                                    )
                                  );
                                }}
                                placeholder="e.g. 60"
                                className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                                <span>Unit Rate (LKR)</span>
                                <span className="text-[10px] text-amber-400/90 font-mono">Rounded to 10</span>
                              </label>
                              <div
                                className="w-full bg-slate-900/90 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono font-bold text-right flex items-center justify-between"
                                title={`Rs. ${(Number(item.unitPrice) || 0).toLocaleString()} (Rounded up to 10)`}
                              >
                                <span className="text-[10px] text-slate-400 font-medium font-sans truncate max-w-[90px]">
                                  {printSpecs.material || "PLA"}
                                </span>
                                <span>
                                  {(Number(item.unitPrice) || 0).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Line 2: Qty, Total (LKR), Summary */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80 items-center">
                            <div className="md:col-span-3">
                              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                Qty *
                              </label>
                              <input
                                id={`field-item_${idx}_quantity`}
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleItemChange(item.id, "quantity", val);
                                  if (val >= 1) clearFieldError(`item_${idx}_quantity`);
                                }}
                                className={`w-full rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono text-center transition-colors ${
                                  unfilledFields[`item_${idx}_quantity`]
                                    ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30"
                                    : "bg-slate-900 border border-slate-700 focus:border-amber-500"
                                }`}
                              />
                            </div>

                            <div className="md:col-span-4">
                              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                Total (LKR)
                              </label>
                              <div className="w-full bg-slate-900/70 border border-emerald-500/40 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono font-bold text-right">
                                {formatLKR(
                                  (Number(item.quantity) || 0) *
                                    (Number(item.unitPrice) || 0)
                                )}
                              </div>
                            </div>

                            <div className="md:col-span-5 text-[11px] text-slate-400 flex items-center justify-end pr-1 pt-3.5">
                              <span>
                                Item Total:{" "}
                                <strong className="text-white font-mono">
                                  {formatLKR(
                                    (Number(item.quantity) || 0) *
                                      (Number(item.unitPrice) || 0)
                                  )}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Manual Unit Rate Layout (Standard, PCB or Uni Quotation) */
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          {quotationType === "UNI_QUOTATION" && (
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-medium text-blue-400 mb-1">
                                Image
                              </label>
                              <div className="flex items-center gap-1.5">
                                {item.image ? (
                                  <div className="relative group w-10 h-10 rounded border border-slate-700 bg-slate-900 overflow-hidden shrink-0">
                                    <img
                                      src={item.image}
                                      alt="Part"
                                      className="w-full h-full object-contain"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleItemChange(item.id, "image", "")}
                                      className="absolute inset-0 bg-red-950/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remove"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : null}
                                <label className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-blue-300 border border-slate-700 rounded text-[10px] font-medium cursor-pointer inline-flex items-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <span>{item.image ? "Change" : "Upload"}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          handleItemChange(item.id, "image", reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                          <div className={quotationType === "UNI_QUOTATION" ? "md:col-span-4" : "md:col-span-6"}>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Product / Item Description *
                            </label>
                            <input
                              id={`field-item_${idx}_productOrService`}
                              type="text"
                              value={item.productOrService}
                              onChange={(e) => {
                                handleItemChange(
                                  item.id,
                                  "productOrService",
                                  e.target.value
                                );
                                if (e.target.value.trim()) clearFieldError(`item_${idx}_productOrService`);
                              }}
                              className={`w-full rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition-colors ${
                                unfilledFields[`item_${idx}_productOrService`]
                                  ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30"
                                  : "bg-slate-900 border border-slate-700 focus:border-teal-500"
                              }`}
                            />
                            {unfilledFields[`item_${idx}_productOrService`] && (
                              <p className="text-[10px] text-red-400 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                                <span>Description is required</span>
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Quantity *
                            </label>
                            <input
                              id={`field-item_${idx}_quantity`}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                handleItemChange(item.id, "quantity", val);
                                if (val >= 1) clearFieldError(`item_${idx}_quantity`);
                              }}
                              className={`w-full rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono transition-colors ${
                                unfilledFields[`item_${idx}_quantity`]
                                  ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30"
                                  : "bg-slate-900 border border-slate-700 focus:border-teal-500"
                              }`}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Unit Rate (LKR) *
                            </label>
                            <input
                              id={`field-item_${idx}_unitPrice`}
                              type="number"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                handleItemChange(item.id, "unitPrice", val);
                                if (val >= 0) clearFieldError(`item_${idx}_unitPrice`);
                              }}
                              className={`w-full rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono transition-colors ${
                                unfilledFields[`item_${idx}_unitPrice`]
                                  ? "border-2 border-red-500 ring-2 ring-red-500/50 bg-red-950/30"
                                  : "bg-slate-900 border border-slate-700 focus:border-teal-500"
                              }`}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Total (LKR)
                            </label>
                            <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono font-semibold text-right">
                              {formatLKR(
                                (Number(item.quantity) || 0) *
                                  (Number(item.unitPrice) || 0)
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pinned Sticky Investment Summary (Compact width: 25% / 3 cols) */}
        <div className="lg:col-span-3 xl:col-span-3 self-start lg:sticky lg:top-20 z-10 max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-0.5">
          <div className="space-y-3">
            {/* Investment Summary Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-teal-400" />
                Investment Summary
              </h2>

              {/* Quotation Metadata Quick Reference */}
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Quotation No:</span>
                  <span className="font-mono text-teal-400 font-semibold">{quotationNo || "Draft"}</span>
                </div>
                {quotationTo && (
                  <div className="flex justify-between items-start text-slate-400 gap-1.5">
                    <span className="shrink-0">Client:</span>
                    <span className="text-slate-300 text-right truncate font-medium">{quotationTo}</span>
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              {quotationType === "PROJECT_PROPOSAL" ? (
                <div className="space-y-2 bg-slate-950/60 p-2.5 sm:p-3 rounded-lg border border-slate-800/80 text-[11px]">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Hardware Subtotal:</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {formatLKR(hardwareTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Services Subtotal:</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {formatLKR(servicesTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 text-[10px] pt-1 border-t border-slate-800/50">
                    <span>Design / BOM Slides:</span>
                    <span className="font-mono text-teal-400 font-semibold">
                      {proposalSets.length} Design / {proposalSets.length} BOM ({proposalSets.length * 2} Slides)
                    </span>
                  </div>
                  <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                    <span className="text-teal-400 font-bold text-xs">Total Investment:</span>
                    <span className="font-mono text-emerald-400 text-base font-bold">
                      {formatLKR(totalAmount)}
                    </span>
                  </div>
                </div>
              ) : quotationType === "UNI_QUOTATION" ? (
                <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 text-xs">
                  <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider pb-1 border-b border-slate-800/80">
                    Table 2: Key Cost Elements (Fixed)
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-medium">1. Total Estimated Cost of Project Components:</span>
                    <span className="font-mono text-slate-100 font-bold">
                      {formatLKR(componentsTotal)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    (Auto-calculated from Table 1 components utilized, max 4 items)
                  </p>

                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-medium">2. Engineering Charges *</span>
                      <span className="font-mono text-blue-300 font-bold">
                        {formatLKR(Number(engineeringCharges) || 0)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={engineeringCharges}
                      onChange={(e) => setEngineeringCharges(e.target.value)}
                      placeholder="Engineering Charges (LKR)"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <div className="flex justify-between items-center text-red-400">
                      <span className="font-medium">Discount (Deduction in Red)</span>
                      <span className="font-mono text-red-400 font-bold">
                        -{formatLKR(Number(discount) || 0)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="Discount Amount (LKR)"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="border-t-2 border-slate-700 pt-2.5 flex justify-between items-center">
                    <span className="text-white font-bold text-sm">Total Project Cost:</span>
                    <span className="font-mono text-emerald-400 text-lg font-bold underline decoration-double">
                      {formatLKR(totalAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-teal-400 font-bold text-sm">Total Amount:</span>
                    <span className="font-mono text-emerald-400 text-lg font-bold">
                      {formatLKR(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Split & Delivery Badges */}
              {quotationType === "PROJECT_PROPOSAL" || quotationType === "UNI_QUOTATION" ? (
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Payment Terms:</span>
                    <span className="text-slate-200 font-semibold">
                      {paymentMethod === "ADVANCE_PAYMENT"
                        ? `${advancePercent || 80}% Advance / ${100 - (Number(advancePercent) || 80)}% Balance`
                        : paymentMethod === "FULL_PAYMENT"
                        ? "100% Full Payment"
                        : "Corporate Credit"}
                    </span>
                  </div>
                  {paymentMethod === "ADVANCE_PAYMENT" && (
                    <>
                      <div className="flex justify-between items-center text-[11px] text-teal-400/90 font-mono">
                        <span>Advance Amount ({advancePercent || 80}%):</span>
                        <span className="font-bold">{formatLKR((totalAmount * (Number(advancePercent) || 80)) / 100)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                        <span>Balance on Completion:</span>
                        <span className="font-bold">{formatLKR(totalAmount - (totalAmount * (Number(advancePercent) || 80)) / 100)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center text-slate-400">
                    <span>{quotationType === "UNI_QUOTATION" ? "Completion Time:" : "Lead Time:"}</span>
                    <span className="text-slate-200 font-medium">
                      {quotationType === "PROJECT_PROPOSAL"
                        ? proposalSets[activeSetIndex]?.leadTime || proposalSets[0]?.leadTime || leadTime || "10 Working Days"
                        : uniCompletionTime || leadTime || "10 business working days"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Warranty:</span>
                    <span className="text-slate-200 font-medium">
                      {quotationType === "PROJECT_PROPOSAL"
                        ? proposalSets[activeSetIndex]?.warranty || proposalSets[0]?.warranty || warranty || "1 Year"
                        : warranty || "As per manufacturer"}
                    </span>
                  </div>
                </div>
              ) : (
                /* For 3D Print / PCB */
                <div className="space-y-3 pt-1 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="FULL_PAYMENT">100% Full Payment</option>
                      <option value="ADVANCE_PAYMENT">Advance Payment</option>
                      <option value="CREDIT">Corporate Credit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      Lead Time
                    </label>
                    <input
                      type="text"
                      value={
                        quotationType === "THREE_D_PRINT"
                          ? printSpecs.leadTime
                          : pcbLeadTime
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (quotationType === "THREE_D_PRINT") {
                          setPrintSpecs({ ...printSpecs, leadTime: val });
                        } else {
                          setPcbLeadTime(val);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>


            {/* Action Buttons Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2.5">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing &amp; Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Save &amp; Download PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-slate-700 shadow-sm"
                title="Save quotation (auto-draft if partially filled, final save if complete)"
              >
                <Save className="w-4 h-4 text-teal-400" />
                <span>Save Quotation</span>
              </button>

              <Link
                href="/rad"
                className="w-full py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* PMS Product Search Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-400" />
                  Select Component from PMS Inventory
                </h3>
                <p className="text-xs text-slate-400">
                  Search by product name, record #, or SKU
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  setProductSearchQuery("");
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Type product name, SKU, or record number..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {isSearchingProducts ? (
                <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-400 mb-2" />
                  Searching PMS database...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {productSearchQuery
                    ? "No matching products found."
                    : "Start typing to search PMS products."}
                </div>
              ) : (
                searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod)}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-teal-600/80 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        {prod.productName}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Record: {prod.recordNo} {prod.sku ? `| SKU: ${prod.sku}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-semibold text-emerald-400">
                        {formatLKR(Number(prod.priceLKR) || 0)}
                      </div>
                      <span className="text-[10px] text-teal-400 font-medium">
                        Select →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bank Accounts Management Modal */}
      <BankAccountsModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onUpdated={(updated) => {
          setBankAccounts(updated);
          if (!updated.some((a) => a.id === selectedBankAccountId)) {
            const def = updated.find((a) => a.isDefault) || updated[0];
            if (def) setSelectedBankAccountId(def.id);
          }
        }}
      />
    </div>
  );
}

export default function CreateRadQuotationPage() {
  return (
    <AppLayout
      title="Create R&D Quotation"
      description="Design Project Proposals, 3D Printing Quotations, and PCB Fabrication Plans"
    >
      <Suspense
        fallback={
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
            Loading creator...
          </div>
        }
      >
        <CreateRadQuotationContent />
      </Suspense>
    </AppLayout>
  );
}

