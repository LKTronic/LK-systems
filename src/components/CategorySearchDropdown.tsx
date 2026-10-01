"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check, X, Tag } from "lucide-react";

export interface CategoryOption {
  id: number;
  name: string;
}

interface CategorySearchDropdownProps {
  categories: CategoryOption[];
  value: string; // "ALL" or stringified number
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySearchDropdown({
  categories,
  value,
  onChange,
  className = "",
  placeholder = "All Categories",
  disabled = false,
}: CategorySearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected category name
  const selectedCategory = categories.find((c) => c.id.toString() === value);
  const isAllSelected = value === "ALL" || !value;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation / Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("ALL");
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 bg-slate-950 border rounded-xl px-3 py-2 text-xs text-left transition-all ${
          isOpen
            ? "border-indigo-500 ring-1 ring-indigo-500/30 text-white"
            : !isAllSelected
            ? "border-indigo-600/60 bg-indigo-950/20 text-indigo-200"
            : "border-slate-800 text-slate-200 hover:border-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        title={selectedCategory ? selectedCategory.name : placeholder}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Tag
            className={`w-3.5 h-3.5 shrink-0 ${
              !isAllSelected ? "text-indigo-400" : "text-slate-500"
            }`}
          />
          <span className="truncate">
            {selectedCategory ? selectedCategory.name : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isAllSelected && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange("ALL");
                }
              }}
              title="Clear category filter"
              className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 sm:w-72 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Subheader with count */}
          <div className="px-3 py-1 bg-slate-800/40 border-b border-slate-800/60 flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Categories</span>
            <span>
              {searchQuery
                ? `${filteredCategories.length} of ${categories.length}`
                : `${categories.length} total`}
            </span>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/40 text-xs">
            {/* "All Categories" option (shown when search is empty or matches "all") */}
            {(!searchQuery || "all categories".includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={() => handleSelect("ALL")}
                className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                  isAllSelected
                    ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                    : "text-slate-200 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  All Categories
                </span>
                {isAllSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
              </button>
            )}

            {/* Filtered categories */}
            {filteredCategories.length > 0 ? (
              filteredCategories.map((c) => {
                const isSelected = c.id.toString() === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id.toString())}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                        : "text-slate-200 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="truncate pr-2">{c.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-400">
                <p className="text-xs mb-1.5">No categories found</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
