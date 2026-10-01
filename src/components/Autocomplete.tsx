"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion?: (item: { productName: string; sku?: string; price?: number }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Autocomplete({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = "Search existing product names or enter new...",
  className = "",
  disabled = false,
}: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Array<{ id: number; productName: string; sku: string; price: any }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExactMatch, setIsExactMatch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsExactMatch(false);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products/suggestions?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          // Check for exact duplicate match
          const exact = data.some(
            (item: any) => item.productName.toLowerCase().trim() === trimmed.toLowerCase()
          );
          setIsExactMatch(exact);
          setIsOpen(data.length > 0);
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-2.5 bg-slate-900 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
            isExactMatch
              ? "border-rose-500 focus:ring-rose-500"
              : "border-slate-700 hover:border-slate-600"
          } ${className}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          ) : (
            <Search className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {isExactMatch && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Product name already exists in database (duplicate).</span>
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/60 border-b border-slate-700/60">
            Matching Existing Products
          </div>
          <ul className="divide-y divide-slate-800">
            {suggestions.map((item) => (
              <li
                key={item.id}
                onClick={() => {
                  onChange(item.productName);
                  if (onSelectSuggestion) onSelectSuggestion(item);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 hover:bg-indigo-600/20 hover:text-indigo-200 cursor-pointer flex items-center justify-between transition-colors text-sm"
              >
                <div>
                  <span className="font-medium text-slate-200">{item.productName}</span>
                  <span className="ml-2 text-xs text-slate-400 font-mono">[{item.sku}]</span>
                </div>
                <span className="text-xs text-emerald-400 font-medium font-mono">
                  {Number(item.price).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
