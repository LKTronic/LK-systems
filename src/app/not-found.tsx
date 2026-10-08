"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Package, Search } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 py-16 selection:bg-indigo-500/30">
      {/* Background ambient lighting effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-lg w-full text-center space-y-8 p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl shadow-indigo-950/20">
        {/* Badge & Decorative Icon */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium tracking-wide">
            <Search className="w-3.5 h-3.5" />
            <span>Error 404 &bull; Page Not Found</span>
          </div>

          {/* Large Gradient 404 Title */}
          <h1 className="text-7xl sm:text-8xl font-black tracking-tight bg-gradient-to-br from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent select-none drop-shadow-sm">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-2.5">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            This page could not be found.
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            The page you are looking for might have been moved, removed, or is temporarily unavailable.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/products");
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-all hover:border-slate-600 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            Go Back
          </button>

          <Link
            href="/products"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all hover:shadow-indigo-600/40 cursor-pointer"
          >
            <Package className="w-4 h-4" />
            Product Repository
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-400" />
            Dashboard
          </Link>
        </div>

        {/* Footer Support Notice */}
        <div className="pt-4 border-t border-slate-800/60 text-[11px] text-slate-400">
          Product Management System &bull; LK Tronics
        </div>
      </div>
    </div>
  );
}
