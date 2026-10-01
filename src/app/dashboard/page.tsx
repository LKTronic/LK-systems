"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { formatDateDMY, formatLKR } from "@/lib/formatters";
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Download,
  Upload,
  ArrowRight,
  Loader2,
  Truck,
  Boxes,
  Tag,
} from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  pendingRequests: number;
  quotedProducts: number;
  priceNotAvailable: number;
  activeProducts: number;
  notRequestedProducts?: number;
  totalSuppliers: number;
  addedToday: number;
  recentProducts: Array<{
    id: number;
    recordNo: string;
    referenceNo?: string | null;
    productName: string;
    modelAndName?: string | null;
    price: number;
    priceLKR?: number | null;
    status: string;
    createdAt: string;
    category?: { name: string } | null;
    supplier?: { name: string } | null;
    author?: { name: string; username: string } | null;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard statistics:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "QUOTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Quoted
          </span>
        );
      case "PRICE_NOT_AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            Not Available
          </span>
        );
      case "NOT_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3 h-3" />
            Not Requested
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {st}
          </span>
        );
    }
  };

  return (
    <AppLayout
      title="System Dashboard"
      description="Quotation lifecycles, supplier activities, and product operations"
    >
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Quick Action Operations Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-100 via-indigo-50/50 to-slate-100 dark:from-indigo-950/60 dark:to-slate-900 border border-slate-200 dark:border-indigo-900/40 shadow-sm dark:shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Quotation & Product Operations
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Add new product requests, export pending requests for supplier pricing in USD, and upload completed supplier sheets in LKR.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/products/add"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all"
              >
                <Plus className="w-4 h-4" />
                PMS Data Adding
              </Link>
              <a
                href="/api/products/export/pending"
                download
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Pending (USD $)
              </a>
              <Link
                href="/supply"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-semibold text-xs border border-slate-300 dark:border-slate-700 shadow-sm transition-all"
              >
                <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Supplier Sheet Upload (LKR)
              </Link>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Pending Requests */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Pending Requests
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">
                  {stats?.pendingRequests || 0}
                </span>
                <span className="text-xs text-amber-400/90 font-medium">Awaiting Quote</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Sending Sheet in $</span>
                <Link
                  href="/products?status=PENDING"
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Quoted & Available */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Quoted Products
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">
                  {stats?.quotedProducts || 0}
                </span>
                <span className="text-xs text-emerald-400 font-medium">Priced in LKR</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>With shipping charges</span>
                <Link
                  href="/products?status=QUOTED"
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Price Not Available */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-rose-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Price Not Available
                </span>
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">
                  {stats?.priceNotAvailable || 0}
                </span>
                <span className="text-xs text-rose-400/90 font-medium">LKR 00 / Out of Stock</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Marked from sheet</span>
                <Link
                  href="/products?status=PRICE_NOT_AVAILABLE"
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Active Suppliers */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-indigo-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Suppliers
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight">
                  {stats?.totalSuppliers || 0}
                </span>
                <span className="text-xs text-slate-400 font-medium">Partners</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>DAN, Grace, Rainy...</span>
                <Link
                  href="/supply"
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Products / Requests Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white">Recent Requests & Quotations</h4>
                <p className="text-xs text-slate-400">Latest product submissions and supplier updates</p>
              </div>
              <Link
                href="/products"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                View Full Repository <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Ref No</th>
                    <th className="px-4 py-3">Model No & Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Price (LKR)</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats?.recentProducts && stats.recentProducts.length > 0 ? (
                    stats.recentProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                          {p.referenceNo || p.recordNo}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white max-w-[200px] truncate">
                          {p.modelAndName || p.productName}
                        </td>
                        <td className="px-4 py-3">
                          {p.category ? (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                              {p.category.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getStatusBadge(p.status)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {p.status === "PRICE_NOT_AVAILABLE" ? (
                            <span className="text-rose-400 text-[11px]">Not Available</span>
                          ) : (
                            <span className="text-emerald-400">
                              {formatLKR(p.priceLKR || p.price)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.supplier ? (
                            <span className="text-amber-300 font-medium">
                              {p.supplier.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {p.author?.name || "System"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {formatDateDMY(p.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No product requests registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
