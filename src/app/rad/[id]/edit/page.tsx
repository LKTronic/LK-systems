"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
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
  getProjectProposalTerms,
  extractAdditionalTerms,
  LK_TRONICS_BANK_DETAILS,
} from "@/lib/rdQuotationDefaults";
import {
  FlaskConical,
  Calendar,
  CreditCard,
  Building,
  Plus,
  Trash2,
  Download,
  Save,
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  Printer,
  Cpu,
  Lightbulb,
  Clock,
  Shield,
  FileText,
  Wrench,
  Upload,
  X,
  Sparkles,
  ImageIcon,
  Bold,
  Underline,
  List,
  ListOrdered,
  Type,
} from "lucide-react";

interface ItemRow {
  id: string;
  itemType: "HARDWARE" | "SERVICE";
  productOrService: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

interface ProductSearchResult {
  id: number;
  recordNo: string;
  sku?: string | null;
  productName: string;
  priceLKR: number | string | null;
}

export default function EditRadQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const quotationId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [quotationType, setQuotationType] = useState<RdQuotationType>("PROJECT_PROPOSAL");

  // Common Header Fields
  const [registrationNo, setRegistrationNo] = useState("P-V 00336036");
  const [quotationNo, setQuotationNo] = useState("");
  const [preparedDate, setPreparedDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [validityDays, setValidityDays] = useState<number | string>(4);
  const [paymentMethod, setPaymentMethod] = useState("ADVANCE_PAYMENT");
  const [advancePercent, setAdvancePercent] = useState<number | string>(60);
  const [preparedBy, setPreparedBy] = useState("");
  const [quotationTo, setQuotationTo] = useState("");

  // Project Proposal Specific Fields
  const [projectTitle, setProjectTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [overviewTab, setOverviewTab] = useState<"write" | "preview">("write");
  const [overviewFontSize, setOverviewFontSize] = useState<string>("16.5");
  const [termsFontSize, setTermsFontSize] = useState<string>("14.0");
  const [termsTab, setTermsTab] = useState<"write" | "preview">("write");
  const [leadTime, setLeadTime] = useState("");
  const [warranty, setWarranty] = useState("");
  const [systemDesignImages, setSystemDesignImages] = useState<string[]>([]);
  const [isUploadingDesignImages, setIsUploadingDesignImages] = useState(false);
  const [customHardwareTotal, setCustomHardwareTotal] = useState<string>("");
  const [customServicesTotal, setCustomServicesTotal] = useState<string>("");

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

          const renderLineTokens = (raw: string) => {
            const tokens = raw.split(/(\*\*|<b>|<\/b>|<u>|<\/u>)/);
            let isBold = false;
            let isUnderline = false;
            const res: React.ReactNode[] = [];
            tokens.forEach((t, i) => {
              if (!t) return;
              if (t === "**" || t === "<b>" || t === "</b>") {
                isBold = t === "**" ? !isBold : t === "<b>";
              } else if (t === "<u>" || t === "</u>") {
                isUnderline = t === "<u>";
              } else {
                res.push(
                  <span
                    key={i}
                    className={`${isBold ? "font-bold text-teal-300" : ""} ${
                      isUnderline ? "underline decoration-orange-400 decoration-1 underline-offset-2" : ""
                    }`}
                  >
                    {t}
                  </span>
                );
              }
            });
            return res;
          };

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-orange-400 font-bold shrink-0">•</span>
                <div className="flex-1">
                  {titlePart && (
                    <span className="font-bold text-teal-300 mr-1.5">
                      {renderLineTokens(titlePart)}
                    </span>
                  )}
                  <span className="text-slate-300">{renderLineTokens(bodyPart)}</span>
                </div>
              </div>
            );
          }

          return <p key={idx} className="text-slate-300">{renderLineTokens(cleanLine)}</p>;
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

      const renderTokens = (raw: string) => {
        const tokens = raw.split(/(\*\*|<b>|<\/b>|<u>|<\/u>)/);
        let isBold = false;
        let isUnderline = false;
        const res: React.ReactNode[] = [];
        tokens.forEach((t, i) => {
          if (!t) return;
          if (t === "**" || t === "<b>" || t === "</b>") {
            isBold = t === "**" ? !isBold : t === "<b>";
          } else if (t === "<u>" || t === "</u>") {
            isUnderline = t === "<u>";
          } else {
            res.push(
              <span
                key={i}
                className={`${isBold ? "font-bold text-teal-300" : ""} ${
                  isUnderline ? "underline decoration-orange-400 decoration-1 underline-offset-2" : ""
                }`}
              >
                {t}
              </span>
            );
          }
        });
        return res;
      };

      return (
        <div className="flex items-start gap-2">
          <span className="text-orange-400 font-bold shrink-0">•</span>
          <div className="flex-1">
            {titlePart && (
              <span className="font-bold text-teal-300 mr-1.5">
                {renderTokens(titlePart)}
              </span>
            )}
            <span className="text-slate-300">{renderTokens(bodyPart)}</span>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3 text-xs leading-relaxed">
        {customLines.length > 0 && (
          <div className="space-y-2 pb-3 border-b border-slate-800">
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block mb-1">
              Custom Project Conditions ({customLines.length})
            </span>
            {customLines.map((line, i) => (
              <div key={i}>{parseLineFormatted(line)}</div>
            ))}
          </div>
        )}

        <div className="space-y-2 opacity-80">
          <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block mb-1">
            Standard LK Tronics Engineering Conditions (Permanent)
          </span>
          {defaultTerms.map((line, i) => (
            <div key={i}>{parseLineFormatted(line)}</div>
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

  // System Design Images Upload for Project Proposal (Slide 3, Max 8 Images)
  const handleDesignImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = 8 - systemDesignImages.length;
    if (remaining <= 0) {
      alert("Maximum 8 images allowed for System Design & Architecture.");
      return;
    }
    const filesToUpload = Array.from(files).slice(0, remaining);
    setIsUploadingDesignImages(true);

    try {
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
              setSystemDesignImages((prev) => [...prev, data.url]);
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
                setSystemDesignImages((prev) => [...prev, base64]);
              }
              resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(file);
          });
        }
      }
    } finally {
      setIsUploadingDesignImages(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveDesignImage = (indexToRemove: number) => {
    setSystemDesignImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAutoGenerateNumber = async () => {
    try {
      const res = await fetch(`/api/rad/next-number?type=${quotationType}`);
      if (res.ok) {
        const data = await res.json();
        if (data.quotationNo) {
          setQuotationNo(data.quotationNo);
        }
      }
    } catch (err) {
      console.error("Failed to auto-generate number:", err);
    }
  };

  // Terms & Conditions
  const [terms, setTerms] = useState("");

  // Items State
  const [items, setItems] = useState<ItemRow[]>([]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // PMS Product Search Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Fetch Existing Quotation
  useEffect(() => {
    const fetchQuotation = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/rad/quotations/${quotationId}`);
        if (!res.ok) {
          throw new Error("Failed to load quotation details");
        }
        const data = await res.json();
        const q = data.quotation;

        setQuotationType(q.type);
        setQuotationNo(q.quotationNo || "");
        setRegistrationNo(q.registrationNo || "P-V 00336036");
        setProjectTitle(q.projectTitle || "");
        setPreparedDate(
          q.preparedDate
            ? typeof q.preparedDate === "string"
              ? q.preparedDate.split("T")[0]
              : new Date(q.preparedDate).toISOString().split("T")[0]
            : ""
        );
        setExpireDate(
          q.expireDate
            ? typeof q.expireDate === "string"
              ? q.expireDate.split("T")[0]
              : new Date(q.expireDate).toISOString().split("T")[0]
            : ""
        );
        setPaymentMethod(q.paymentMethod || "ADVANCE_PAYMENT");
        setAdvancePercent(q.advancePercent || 70);
        setPreparedBy(q.preparedBy || "");
        setQuotationTo(q.quotationTo || "");
        setLeadTime(q.leadTime || "");
        setWarranty(q.warranty || "");
        setOverview(q.overview || "");
        if (q.type === "PROJECT_PROPOSAL") {
          setTerms(extractAdditionalTerms(q.termsAndConditions).join("\n\n"));
        } else {
          setTerms(q.termsAndConditions || "");
        }

        if (q.type === "THREE_D_PRINT" && q.technicalSpecs) {
          setPrintSpecs({ ...DEFAULT_THREE_D_PRINT_SPECS, ...q.technicalSpecs });
        } else if (q.type === "PCB" && q.technicalSpecs) {
          setPcbSpecs({ ...DEFAULT_PCB_SPECS, ...q.technicalSpecs });
          if (Array.isArray(q.technicalSpecs.images)) {
            setPcbImages(q.technicalSpecs.images);
          } else if (Array.isArray(q.technicalSpecs.pcbImages)) {
            setPcbImages(q.technicalSpecs.pcbImages);
          }
          if (q.technicalSpecs.leadTime) {
            setPcbLeadTime(q.technicalSpecs.leadTime);
          } else if (q.leadTime) {
            setPcbLeadTime(q.leadTime);
          }
        }

        if (q.type === "PROJECT_PROPOSAL") {
          if (q.hardwareTotal != null) {
            setCustomHardwareTotal(String(q.hardwareTotal));
          }
          if (q.servicesTotal != null) {
            setCustomServicesTotal(String(q.servicesTotal));
          }
          if (q.validityDays != null) {
            setValidityDays(q.validityDays);
          }
          if (q.technicalSpecs) {
            let specs = q.technicalSpecs;
            if (typeof specs === "string") {
              try {
                specs = JSON.parse(specs);
              } catch {}
            }
            if (specs && Array.isArray(specs.systemDesignImages)) {
              setSystemDesignImages(specs.systemDesignImages);
            }
            if (specs?.advancePercent != null) {
              setAdvancePercent(specs.advancePercent);
            }
            if (specs?.overviewFontSize) {
              setOverviewFontSize(String(specs.overviewFontSize));
            }
            if (specs?.termsFontSize) {
              setTermsFontSize(String(specs.termsFontSize));
            }
          }
        }

        if (Array.isArray(q.items) && q.items.length > 0) {
          setItems(
            q.items.map((it: any) => ({
              id: `item-${it.id || Math.random()}`,
              itemType: it.itemType || "HARDWARE",
              productOrService: it.productOrService || "",
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              notes: it.notes || "",
            }))
          );
        } else {
          setItems([
            {
              id: "item-1",
              itemType: "HARDWARE",
              productOrService: "",
              quantity: 1,
              unitPrice: 0,
              notes: "",
            },
          ]);
        }
      } catch (err: any) {
        console.error("Load failed:", err);
        setMessage({
          type: "error",
          text: err?.message || "Failed to load quotation",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (quotationId) {
      fetchQuotation();
    }
  }, [quotationId]);

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
  const hardwareItems = items.filter((i) => i.itemType === "HARDWARE");
  const serviceItems = items.filter((i) => i.itemType === "SERVICE");

  const computedHardwareTotal = hardwareItems.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
    0
  );
  const computedServicesTotal = serviceItems.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
    0
  );

  const hardwareTotal =
    customHardwareTotal !== "" && !isNaN(Number(customHardwareTotal))
      ? Number(customHardwareTotal)
      : computedHardwareTotal;

  const servicesTotal =
    customServicesTotal !== "" && !isNaN(Number(customServicesTotal))
      ? Number(customServicesTotal)
      : computedServicesTotal;

  const totalAmount =
    quotationType === "PROJECT_PROPOSAL"
      ? hardwareTotal + servicesTotal
      : items.reduce(
          (sum, i) =>
            sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
          0
        );

  // Add Item
  const handleAddItem = (type: "HARDWARE" | "SERVICE" = "HARDWARE") => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemType: type,
        productOrService: "",
        quantity: 1,
        unitPrice: 0,
        notes: "",
      },
    ]);
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
    if (targetItemIndex !== null && items[targetItemIndex]) {
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
    }
    setIsProductModalOpen(false);
    setProductSearchQuery("");
    setTargetItemIndex(null);
  };

  // Prepare Payload
  const preparePayload = () => {
    const technicalSpecs =
      quotationType === "THREE_D_PRINT"
        ? printSpecs
        : quotationType === "PCB"
        ? { ...pcbSpecs, images: pcbImages, leadTime: pcbLeadTime || "12 - 21 Days" }
        : {
            systemDesignImages,
            advancePercent: Number(advancePercent) || 60,
            overviewFontSize,
            termsFontSize,
          };

    return {
      type: quotationType,
      quotationNo,
      registrationNo,
      projectTitle: quotationType === "PROJECT_PROPOSAL" ? projectTitle : null,
      preparedDate,
      expireDate,
      validityDays: Number(validityDays) || 4,
      paymentMethod,
      advancePercent:
        paymentMethod === "ADVANCE_PAYMENT" ? Number(advancePercent) || 60 : null,
      preparedBy,
      quotationTo,
      leadTime:
        quotationType === "THREE_D_PRINT"
          ? printSpecs.leadTime
          : quotationType === "PCB"
          ? pcbLeadTime
          : leadTime,
      warranty: quotationType === "PROJECT_PROPOSAL" ? warranty : null,
      hardwareTotal:
        quotationType === "PROJECT_PROPOSAL" ? hardwareTotal : null,
      servicesTotal:
        quotationType === "PROJECT_PROPOSAL" ? servicesTotal : null,
      totalAmount,
      overview: quotationType === "PROJECT_PROPOSAL" ? overview : null,
      technicalSpecs,
      termsAndConditions:
        quotationType === "PROJECT_PROPOSAL" ? terms : null,
      items: items.map((it, idx) => ({
        itemIndex: idx + 1,
        itemType: it.itemType,
        productOrService: it.productOrService || "Item",
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice:
          (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
        notes: it.notes || null,
      })),
    };
  };

  // Comprehensive validation across all quotation fields and constraints
  const validateForm = async () => {
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
      } catch (err) {
        console.error("Auto generation on submit failed:", err);
      }
    }
    if (!currentNo) {
      setMessage({ type: "error", text: "Quotation number is required." });
      return false;
    }
    if (!preparedBy.trim()) {
      setMessage({ type: "error", text: "Prepared By (Author) name is required." });
      return false;
    }
    if (!quotationTo.trim()) {
      setMessage({
        type: "error",
        text: "Please provide customer or company details under 'Quotation To'.",
      });
      return false;
    }
    if (!preparedDate) {
      setMessage({ type: "error", text: "Quotation Prepared Date is required." });
      return false;
    }
    if (!expireDate) {
      setMessage({ type: "error", text: "Quotation Expire Date is required." });
      return false;
    }
    if (new Date(expireDate) < new Date(preparedDate)) {
      setMessage({
        type: "error",
        text: "Quotation Expire Date must be on or after Prepared Date.",
      });
      return false;
    }
    if (quotationType === "PROJECT_PROPOSAL") {
      if (!projectTitle.trim()) {
        setMessage({
          type: "error",
          text: "Project Title is required for Project Proposals.",
        });
        return false;
      }
      if (advancePercent !== null && advancePercent !== undefined) {
        const adv = Number(advancePercent);
        if (isNaN(adv) || adv < 1 || adv > 100) {
          setMessage({
            type: "error",
            text: "Advance payment percentage must be between 1% and 100%.",
          });
          return false;
        }
      }
      if (validityDays !== null && validityDays !== undefined) {
        const val = Number(validityDays);
        if (isNaN(val) || val < 1) {
          setMessage({
            type: "error",
            text: "Quotation validity period must be at least 1 day.",
          });
          return false;
        }
      }
    }
    if (items.length === 0) {
      setMessage({
        type: "error",
        text: "Please add at least one line item to the quotation.",
      });
      return false;
    }
    if (items.some((i) => !i.productOrService.trim())) {
      setMessage({
        type: "error",
        text: "All line items must have a valid description or service title.",
      });
      return false;
    }
    if (items.some((i) => Number(i.quantity) < 1)) {
      setMessage({
        type: "error",
        text: "All line item quantities must be at least 1.",
      });
      return false;
    }
    if (items.some((i) => Number(i.unitPrice) < 0)) {
      setMessage({
        type: "error",
        text: "Line item unit prices cannot be negative.",
      });
      return false;
    }
    return true;
  };

  // Save Quotation Handler (PUT)
  const handleSave = async (andDownload = false) => {
    const isValid = await validateForm();
    if (!isValid) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = preparePayload();
      const res = await fetch(`/api/rad/quotations/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update quotation");
      }

      setMessage({
        type: "success",
        text: `Quotation ${quotationNo} updated successfully!`,
      });

      if (andDownload) {
        await handleDownloadDirect();
      }

      setTimeout(() => {
        router.push("/rad");
      }, 1200);
    } catch (err: any) {
      console.error("Update failed:", err);
      setMessage({
        type: "error",
        text: err?.message || "Failed to update quotation",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Direct PDF Download
  const handleDownloadDirect = async () => {
    const isValid = await validateForm();
    if (!isValid) return;
    setIsGeneratingPdf(true);
    try {
      const payload = preparePayload();
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
        overviewFontSize: overviewFontSize,
        termsFontSize: termsFontSize,
        technicalSpecs: payload.technicalSpecs,
        systemDesignImages,
        termsAndConditions: payload.termsAndConditions,
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
        text: `Failed to generate PDF: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Edit R&D Quotation"
        description="Modify parameters and regenerate documents"
      >
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-400 mb-3" />
          Loading quotation details...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Edit R&D Quotation - ${quotationNo}`}
      description="Modify parameters, update bill of materials, and regenerate PDF"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-20">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/rad"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-teal-400" />
                Edit Quotation: <span className="text-teal-400 font-mono">{quotationNo}</span>
              </h1>
              <p className="text-xs text-slate-400">
                Type: {quotationType.replace(/_/g, " ")} | Registered ID #{quotationId}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadDirect}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              ) : (
                <Download className="w-4 h-4 text-teal-400" />
              )}
              Download PDF
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save & Download
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
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

        {/* Main Form Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Info */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                Quotation Details
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
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={quotationNo}
                    onChange={(e) => setQuotationNo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-teal-500"
                  />
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
                    Prepared By
                  </label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Prepared Date
                  </label>
                  <input
                    type="date"
                    value={preparedDate}
                    onChange={(e) => setPreparedDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
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
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Quotation To (Customer Name & Organization) *
                </label>
                <textarea
                  rows={2}
                  value={quotationTo}
                  onChange={(e) => setQuotationTo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

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
                      rows={2}
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="e.g. PETROL PUMP AUTOMATION SYSTEMS&#10;(Press Enter to break line)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-teal-500 resize-y"
                    />
                  </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-teal-400">
                      Slide 2: System Overview &amp; Introduction * (Manual Input)
                    </label>
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
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
                            <option value="14.0" className="bg-slate-900 text-white">14pt (Compact)</option>
                            <option value="16.5" className="bg-slate-900 text-white">16.5pt (Standard)</option>
                            <option value="18.5" className="bg-slate-900 text-white">18.5pt (Medium)</option>
                            <option value="21.0" className="bg-slate-900 text-white">21pt (Large)</option>
                            <option value="24.0" className="bg-slate-900 text-white">24pt (X-Large)</option>
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
                        placeholder="Enter system overview, objectives, and key features for Slide 2... Use toolbar above for Bold (**text**), Underline (<u>text</u>), and Bullet Lists (•). Press Enter to auto-continue bullets."
                        className="w-full bg-slate-950 border border-slate-700 border-t-0 rounded-b-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono leading-relaxed"
                      />
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-teal-400 font-bold">Tip:</span> Highlight text and click{" "}
                        <strong className="text-white">Bold</strong> or{" "}
                        <strong className="text-white">Underline</strong>, or click{" "}
                        <strong className="text-white">Bullet List</strong> to insert features. Formatted live into Slide 2 of the presentation PDF.
                      </p>
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
                </div>
              )}
            </div>

            {/* Payment Method, Lead Time & Warranty (Below Slide 2, Above Slide 3) */}
            {quotationType === "PROJECT_PROPOSAL" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                  <CreditCard className="w-4 h-4 text-teal-400" />
                  Payment Method, Estimated Lead Time &amp; Warranty
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-teal-400" />
                      Payment Method *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="ADVANCE_PAYMENT">Advance Payment + Balance</option>
                      <option value="FULL_PAYMENT">100% Full Payment</option>
                      <option value="CREDIT">Corporate Credit</option>
                    </select>
                  </div>

                  {/* Estimated Lead Time */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      Estimated Lead Time *
                    </label>
                    <input
                      type="text"
                      value={leadTime}
                      onChange={(e) => setLeadTime(e.target.value)}
                      placeholder="e.g. 10 Working Days"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Warranty & Support */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-teal-400" />
                      Warranty &amp; Support *
                    </label>
                    <input
                      type="text"
                      value={warranty}
                      onChange={(e) => setWarranty(e.target.value)}
                      placeholder="e.g. 1 Year"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Advance Payment Slider */}
                {paymentMethod === "ADVANCE_PAYMENT" && (
                  <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 space-y-2 mt-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Advance Payment Split:</span>
                      <span className="font-mono text-teal-400 font-bold">
                        {advancePercent}% Advance / {100 - (Number(advancePercent) || 60)}% Balance
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={advancePercent}
                      onChange={(e) => setAdvancePercent(e.target.value)}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs font-mono text-slate-300">
                      <span>
                        Advance ({advancePercent}%):{" "}
                        <strong className="text-teal-400">{formatLKR((totalAmount * (Number(advancePercent) || 60)) / 100)}</strong>
                      </span>
                      <span>
                        Balance ({100 - (Number(advancePercent) || 60)}%):{" "}
                        <strong className="text-slate-200">{formatLKR(totalAmount - (totalAmount * (Number(advancePercent) || 60)) / 100)}</strong>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Rendered on Slide 4 as: &ldquo;Payment Terms: {advancePercent}% Advance Payment / {100 - (Number(advancePercent) || 60)}% Upon Completion&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Slide 3: System Design & Architecture Images (Max 8 Images) */}
            {quotationType === "PROJECT_PROPOSAL" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Slide 3: System Design & Architecture Images
                    </h2>
                    <p className="text-xs text-slate-400">
                      Upload hardware, module, or architecture diagram images (Maximum of 8 images, auto-resized into clean rows on Slide 3)
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-800 text-teal-300 border border-slate-700 w-fit">
                    {systemDesignImages.length} / 8 Uploaded
                  </span>
                </div>

                {/* Upload Drop Zone / Button */}
                {systemDesignImages.length < 8 && (
                  <label className="border-2 border-dashed border-slate-700 hover:border-teal-500/70 bg-slate-950/50 hover:bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleDesignImageUpload}
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
                {systemDesignImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {systemDesignImages.map((imgUrl, idx) => (
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
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDesignImage(idx)}
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
            )}

            {/* Type-Specific: 3D Print */}
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
                    <input
                      type="text"
                      value={printSpecs.printingTechnology}
                      onChange={(e) =>
                        setPrintSpecs({ ...printSpecs, printingTechnology: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
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
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Material
                    </label>
                    <div className="space-y-1.5">
                      <select
                        value={
                          ["PLA", "TPU (Flexible)", "PETG", "ABS", "Standard Resin", "Tough Resin", "Nylon"].includes(
                            printSpecs.material
                          )
                            ? printSpecs.material
                            : "CUSTOM"
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "CUSTOM") {
                            setPrintSpecs({ ...printSpecs, material: "Custom Material" });
                          } else {
                            setPrintSpecs({ ...printSpecs, material: val });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="PLA">PLA</option>
                        <option value="TPU (Flexible)">TPU (Flexible)</option>
                        <option value="PETG">PETG</option>
                        <option value="ABS">ABS</option>
                        <option value="Standard Resin">Standard Resin</option>
                        <option value="Tough Resin">Tough Resin</option>
                        <option value="Nylon">Nylon</option>
                        <option value="CUSTOM">Custom / Other Material...</option>
                      </select>
                      {!["PLA", "TPU (Flexible)", "PETG", "ABS", "Standard Resin", "Tough Resin", "Nylon"].includes(
                        printSpecs.material
                      ) && (
                        <input
                          type="text"
                          value={printSpecs.material}
                          onChange={(e) =>
                            setPrintSpecs({ ...printSpecs, material: e.target.value })
                          }
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
                        {["Black", "White", "Yellow", "Grey", "Red", "Blue", "Green", "Transparent"].map((c) => {
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

            {/* Type-Specific: PCB */}
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
            <div className="space-y-6">
              {/* 1. Hardware BOM List */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-400" />
                      1. Hardware Components (BOM)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Physical components and modules. Individual unit rates &amp; row totals are omitted per PPTX design.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddItem("HARDWARE")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-950/70 border border-teal-800/80 hover:bg-teal-900/60 text-teal-300 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Hardware
                  </button>
                </div>

                {/* Hardware Items List (Description & Qty only) */}
                <div className="space-y-2.5">
                  {hardwareItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                      No hardware components added yet. Click &ldquo;+ Add Hardware&rdquo; to add components.
                    </div>
                  ) : (
                    hardwareItems.map((item, hIdx) => {
                      const globalIndex = items.findIndex((it) => it.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border bg-slate-950/60 border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                        >
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-teal-300 text-xs font-bold flex items-center justify-center shrink-0">
                            {hIdx + 1}
                          </span>

                          {/* Component Description */}
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              value={item.productOrService}
                              onChange={(e) =>
                                handleItemChange(item.id, "productOrService", e.target.value)
                              }
                              placeholder="Component description (e.g. Arduino Nano, Modbus Converter...)"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                            />
                          </div>

                          {/* Quantity */}
                          <div className="w-28 shrink-0 flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-teal-400 font-bold font-mono focus:outline-none focus:border-teal-500 text-center"
                            />
                          </div>

                          {/* Actions: PMS & Delete */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setTargetItemIndex(globalIndex);
                                setIsProductModalOpen(true);
                              }}
                              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                              title="Import from PMS inventory"
                            >
                              <Search className="w-3 h-3 text-teal-400" />
                              <span className="hidden md:inline">PMS</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                              title="Delete hardware component"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Hardware Full Price / Subtotal */}
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
                        value={customHardwareTotal}
                        onChange={(e) => setCustomHardwareTotal(e.target.value)}
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
                    </h2>
                    <p className="text-xs text-slate-400">
                      Engineering charges, installation, programming, testing &amp; calibration services
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddItem("SERVICE")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/70 border border-indigo-800/80 hover:bg-indigo-900/60 text-indigo-300 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Service
                  </button>
                </div>

                {/* Services Items List (Description & Qty only) */}
                <div className="space-y-2.5">
                  {serviceItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                      No engineering services added yet. Click &ldquo;+ Add Service&rdquo; to add service charges.
                    </div>
                  ) : (
                    serviceItems.map((item, sIdx) => {
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border bg-indigo-950/20 border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                        >
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                            {sIdx + 1}
                          </span>

                          {/* Service Scope Description */}
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              value={item.productOrService}
                              onChange={(e) =>
                                handleItemChange(item.id, "productOrService", e.target.value)
                              }
                              placeholder="Service description (e.g. Testing / Engineering Charges, IoT Installation...)"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          {/* Quantity / Scope */}
                          <div className="w-28 shrink-0 flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-indigo-300 font-bold font-mono focus:outline-none focus:border-indigo-500 text-center"
                            />
                          </div>

                          {/* Actions: Delete */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                              title="Delete service"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Services Full Price / Subtotal */}
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
                        value={customServicesTotal}
                        onChange={(e) => setCustomServicesTotal(e.target.value)}
                        placeholder="e.g. 65160.00"
                        className="w-full bg-slate-900 border border-indigo-600/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono font-bold text-right focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 5: Terms & Conditions Box (Below Bill of Materials) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-400" />
                    Slide 5: Terms &amp; Conditions
                  </h2>
                  <span className="text-xs text-teal-400/90 bg-teal-500/10 px-2.5 py-1 rounded border border-teal-500/20 self-start sm:self-auto font-medium">
                    7 Standard LK Tronics Terms Auto-Appended
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300 shrink-0">Validity Period:</span>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-semibold focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-xs text-slate-400">
                    Days (Term 1: valid for {validityDays || 4} days from date of issue)
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Additional Terms &amp; Conditions (Optional)
                    </label>
                    {/* Write / Preview Tab switcher */}
                    <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTermsTab("write")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                          termsTab === "write"
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setTermsTab("preview")}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                          termsTab === "preview"
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Formatted Preview
                      </button>
                    </div>
                  </div>

                  {termsTab === "write" ? (
                    <div>
                      {/* Rich Formatting Toolbar */}
                      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 border border-slate-700 border-b-0 rounded-t-lg px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => insertTermsFormat("**", "**", "Bold Term Title")}
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
                            <option value="12.0" className="bg-slate-900 text-white">12pt (Small)</option>
                            <option value="13.0" className="bg-slate-900 text-white">13pt (Compact)</option>
                            <option value="14.0" className="bg-slate-900 text-white">14pt (Standard)</option>
                            <option value="15.5" className="bg-slate-900 text-white">15.5pt (Medium)</option>
                            <option value="17.0" className="bg-slate-900 text-white">17pt (Large)</option>
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
                        placeholder="Enter optional extra terms here (1 per line). Use toolbar above for Bold (**text**), Underline (<u>text</u>), and Bullet Lists (•). Press Enter to auto-continue bullets."
                        className="w-full bg-slate-950 border border-slate-700 border-t-0 rounded-b-lg px-3 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500 leading-relaxed"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Standard LK Tronics engineering terms (Quotation Validity, Supervision, Hardware Warranty, Source Code, Delivery, Scope, and Environmental Conditions) are permanently included at the bottom of the proposal. Any custom terms entered above will be placed on top.
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
            </div>
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
                    Add quoted items with quantity and unit rates
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddItem("HARDWARE")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
              </div>

              {/* Standard Line Items Table */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border bg-slate-950/60 border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
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

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-6">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Product / Item Description
                        </label>
                        <input
                          type="text"
                          value={item.productOrService}
                          onChange={(e) =>
                            handleItemChange(item.id, "productOrService", e.target.value)
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Unit Rate (LKR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "unitPrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Pinned Sticky Sidebar (No Inner Scroll, Immediate Access to Save & Summary) */}
        <div className="self-start lg:sticky lg:top-6">
          <div className="space-y-4">
            {/* Investment Summary Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-400" />
                Investment Summary
              </h2>

              {/* Quotation Metadata Quick Reference */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Quotation No:</span>
                  <span className="font-mono text-teal-400 font-semibold">{quotationNo || "Draft"}</span>
                </div>
                {quotationTo && (
                  <div className="flex justify-between items-start text-slate-400 gap-2">
                    <span className="shrink-0">Client:</span>
                    <span className="text-slate-300 text-right truncate font-medium">{quotationTo}</span>
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              {quotationType === "PROJECT_PROPOSAL" ? (
                <div className="space-y-2.5 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 text-xs">
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
                  <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                    <span className="text-teal-400 font-bold text-sm">Total Investment:</span>
                    <span className="font-mono text-emerald-400 text-lg font-bold">
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
              {quotationType === "PROJECT_PROPOSAL" ? (
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Payment Terms:</span>
                    <span className="text-slate-200 font-semibold">
                      {paymentMethod === "ADVANCE_PAYMENT"
                        ? `${advancePercent}% Advance / ${100 - (Number(advancePercent) || 60)}% Balance`
                        : paymentMethod === "FULL_PAYMENT"
                        ? "100% Full Payment"
                        : "Corporate Credit"}
                    </span>
                  </div>
                  {paymentMethod === "ADVANCE_PAYMENT" && (
                    <>
                      <div className="flex justify-between items-center text-[11px] text-teal-400/90 font-mono">
                        <span>Advance Amount ({advancePercent}%):</span>
                        <span className="font-bold">{formatLKR((totalAmount * (Number(advancePercent) || 60)) / 100)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                        <span>Balance on Completion:</span>
                        <span className="font-bold">{formatLKR(totalAmount - (totalAmount * (Number(advancePercent) || 60)) / 100)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center text-slate-400">
                    <span>Lead Time:</span>
                    <span className="text-slate-200 font-medium">{leadTime || "10 Working Days"}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Warranty:</span>
                    <span className="text-slate-200 font-medium">{warranty || "1 Year"}</span>
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
                    <span>Update &amp; Download PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-slate-700"
              >
                <Save className="w-4 h-4 text-teal-400" />
                <span>Save Changes Only</span>
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
      </div>
    </AppLayout>
  );
}

