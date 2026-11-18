"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calculator,
  RefreshCw,
} from "lucide-react";
import {
  ThreeDPrintPricingSettings,
  DEFAULT_THREE_D_PRINT_PRICING,
  MATERIAL_DENSITIES,
} from "@/lib/threeDPrintPricing";

interface ThreeDPrintPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (pricing: ThreeDPrintPricingSettings) => void;
}

export function ThreeDPrintPricingModal({
  isOpen,
  onClose,
  onSaved,
}: ThreeDPrintPricingModalProps) {
  const [pricing, setPricing] = useState<ThreeDPrintPricingSettings>({
    ...DEFAULT_THREE_D_PRINT_PRICING,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);
    setFeedback(null);

    fetch("/api/rad/3d-pricing")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.pricing) {
          const p = data.pricing;
          const price = Number(p.filamentPricePerKg) >= 0
            ? Number(p.filamentPricePerKg)
            : (Number(p.filamentPricePerSpool) >= 0 ? Number(p.filamentPricePerSpool) : 10000);

          setPricing({
            materialType: p.materialType || "ABS",
            materialDensity: Number(p.materialDensity) > 0 ? Number(p.materialDensity) : 1.05,
            filamentDiameterMm: Number(p.filamentDiameterMm) > 0 ? Number(p.filamentDiameterMm) : 1.75,
            filamentPricePerKg: price,
            filamentPricePerSpool: price,
            spoolLengthMeters: Number(p.spoolLengthMeters) || 330,
            costPerHour: Number(p.costPerHour) || 200,
            markupPercent: Number(p.markupPercent) || 35,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch 3D print pricing:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Omni Calculator Live Cost per Meter preview:
  // Volume of 1m = π * (d/2)² * 1 (with d in mm and L=1m)
  const d = Number(pricing.filamentDiameterMm) || 1.75;
  const rho = Number(pricing.materialDensity) || 1.05;
  const priceKg = Number(pricing.filamentPricePerKg) || 10000;
  const vol1m = Math.PI * Math.pow(d / 2, 2) * 1;
  const weight1mKg = (vol1m * rho) / 1000;
  const costPerMeter = weight1mKg * priceKg;

  const handleMaterialChange = (mat: string) => {
    const defaultDensity = MATERIAL_DENSITIES[mat];
    setPricing((prev) => ({
      ...prev,
      materialType: mat,
      materialDensity: defaultDensity !== undefined ? defaultDensity : prev.materialDensity,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/rad/3d-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricing),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save 3D print pricing");
      }

      const data = await res.json();
      setFeedback({
        type: "success",
        text: "3D print pricing settings saved successfully!",
      });
      if (onSaved && data.pricing) {
        onSaved(data.pricing);
      }
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Failed to save pricing",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setPricing({ ...DEFAULT_THREE_D_PRINT_PRICING });
    setFeedback({
      type: "success",
      text: "Reset parameters to standard Omni Calculator defaults (ABS 1.05 g/cm³, 10,000 LKR/kg, Rs. 200/hr, 35%).",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                3D Print Cost Calculator Settings
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumetric Density &amp; Machine Hourly Cost Parameters (Omni Calculator Formula)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {feedback && (
            <div
              className={`flex items-center gap-2.5 p-3 rounded-lg text-xs font-medium border ${
                feedback.type === "success"
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : "bg-red-950/40 border-red-800 text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Current Rate Breakdown Pill */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono text-amber-400 gap-2">
            <span className="font-semibold text-slate-300">Live Rate Preview:</span>
            <div className="flex flex-wrap items-center gap-2">
              <span>ρ = {rho.toFixed(2)} g/cm³</span>
              <span className="text-slate-600">•</span>
              <span>Rs. {costPerMeter.toFixed(2)}/m</span>
              <span className="text-slate-600">•</span>
              <span>Rs. {pricing.costPerHour}/hr</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400">+{pricing.markupPercent}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Material Type
              </label>
              <select
                value={pricing.materialType || "ABS"}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="ABS">ABS (Acrylonitrile Butadiene Styrene) - 1.05 g/cm³</option>
                <option value="PLA">PLA (Polylactic Acid) - 1.27 g/cm³</option>
                <option value="TPU">TPU (Thermoplastic Polyurethane) - 1.30 g/cm³</option>
                <option value="PETG">PETG (Polyethylene Terephthalate) - 1.25 g/cm³</option>
                <option value="PETT">PETT (T-Glase filament) - 1.45 g/cm³</option>
                <option value="HIPS">HIPS (High Impact Polystyrene) - 1.04 g/cm³</option>
                <option value="CUSTOM">Custom Material</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Selects standard filament polymer density
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Material Density (ρ)</span>
                <span className="text-[10px] text-slate-400">g/cm³</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="0.01"
                value={pricing.materialDensity}
                onChange={(e) =>
                  setPricing((prev) => ({
                    ...prev,
                    materialDensity: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="1.05"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                e.g. 1.05 for ABS, 1.27 for PLA, 1.30 for TPU
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Filament Diameter (d)</span>
                <span className="text-[10px] text-slate-400">mm</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.05"
                value={pricing.filamentDiameterMm}
                onChange={(e) =>
                  setPricing((prev) => ({
                    ...prev,
                    filamentDiameterMm: parseFloat(e.target.value) || 1.75,
                  }))
                }
                placeholder="1.75"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard FDM filament diameter (1.75 mm)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Filament Price / kg (LKR)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={pricing.filamentPricePerKg}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setPricing((prev) => ({
                    ...prev,
                    filamentPricePerKg: val,
                    filamentPricePerSpool: val,
                  }));
                }}
                placeholder="10000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <span className="text-[11px] text-amber-400/90 mt-1 block font-medium">
                Price per 1kg spool (same for PLA &amp; TPU)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cost per hour (LKR)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={pricing.costPerHour}
                onChange={(e) =>
                  setPricing((prev) => ({
                    ...prev,
                    costPerHour: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="200"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Machine runtime &amp; electricity
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Markup (%)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={pricing.markupPercent}
                onChange={(e) =>
                  setPricing((prev) => ({
                    ...prev,
                    markupPercent: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="35"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Profit margin percentage
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-950/40 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
