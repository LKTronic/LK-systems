"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, Loader2, Clipboard, Check } from "lucide-react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled = false }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (disabled || isUploading) return;

      // Validate type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        setError("Please select a valid image file (JPG, PNG, WEBP).");
        return;
      }

      // Validate size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB.");
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        const uploadFile =
          file.name === "image.png" || !file.name
            ? new File([file], `pasted-${Date.now()}.png`, { type: file.type })
            : file;

        formData.append("file", uploadFile);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }

        onChange(data.url);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 3000);
      } catch (err: any) {
        setError(err.message || "Failed to upload image.");
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, isUploading, onChange]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await processFile(file);
    }
  };

  // Clipboard Paste Handler: allows pasting image (Ctrl+V) from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isUploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [disabled, isUploading, processFile]);

  const handleRemove = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-2" ref={containerRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative group w-full h-56 bg-slate-900 border ${
            isDragging ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-slate-700"
          } rounded-xl overflow-hidden flex items-center justify-center transition-all`}
        >
          {/* Preview Image */}
          <img
            src={value}
            alt="Product preview"
            className="w-full h-full object-contain p-2"
          />

          <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg transition-all"
              >
                Change Image
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-lg transition-all"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[11px] text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1.5">
              <Clipboard className="w-3 h-3 text-indigo-400" />
              Or paste image (Ctrl+V) / drag & drop to replace
            </span>
          </div>

          {isUploading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-200 font-medium">Uploading new image...</p>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-slate-700 hover:border-indigo-500/80 bg-slate-900/50 hover:bg-slate-900/90"
          } rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-300 font-medium">Uploading image...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3 group-hover:text-indigo-400">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Click to browse, drag & drop, or paste image
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-800 border border-slate-700 text-indigo-300 px-2 py-0.5 rounded">
                  <Clipboard className="w-3 h-3 text-indigo-400" /> Ctrl + V to Paste Image
                </span>
                <span className="text-[11px] text-slate-500 font-medium">•</span>
                <span className="text-xs text-slate-400">
                  JPG, PNG, or WEBP up to 5MB
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {pasteSuccess && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in">
          <Check className="w-3.5 h-3.5" />
          <span>Image pasted and uploaded successfully!</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-400 font-medium">{error}</p>
      )}
    </div>
  );
}
