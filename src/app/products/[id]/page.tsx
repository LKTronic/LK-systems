"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { formatDateDMY, formatLKR } from "@/lib/formatters";
import {
  ArrowLeft,
  Edit2,
  Calendar,
  Hash,
  Image as ImageIcon,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Truck,
  ExternalLink,
  Weight,
  Boxes,
  FileText,
  ShieldCheck,
  History,
  RotateCcw,
  Globe,
} from "lucide-react";

interface PriceHistoryEntry {
  id: number;
  priceLKR: number;
  supplierName?: string | null;
  warrantyPeriod?: string | null;
  leadTime?: string | null;
  note?: string | null;
  createdAt: string;
  supplier?: {
    name: string;
  } | null;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequestingPrice, setIsRequestingPrice] = useState(false);

  const loadProduct = async () => {
    try {
      const res = await fetch(`/api/products/${resolvedParams.id}`);
      if (!res.ok) {
        throw new Error("Product not found");
      }
      const data = await res.json();
      setProduct(data);
    } catch (err: any) {
      setError(err.message || "Failed to load product details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [resolvedParams.id]);

  const handleRequestPrice = async () => {
    if (!confirm("Request updated price quotation for this product? Status will become Pending.")) {
      return;
    }

    setIsRequestingPrice(true);
    try {
      const res = await fetch(`/api/products/${resolvedParams.id}/request-price`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        loadProduct();
      } else {
        alert(data.error || "Failed to request price.");
      }
    } catch (e: any) {
      alert(e.message || "Network error");
    } finally {
      setIsRequestingPrice(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending Quotation
          </span>
        );
      case "ACTIVE":
      case "QUOTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Expired (Needs Quotation)
          </span>
        );
      case "PRICE_NOT_AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Price Not Available
          </span>
        );
      case "NOT_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3.5 h-3.5" />
            Not Requested
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout
      title="Product Details"
      description="View full specifications, supplier quotation, and historical pricing timeline"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </Link>

          <div className="flex items-center gap-3">
            {/* Request Price Button */}
            {product && (
              <button
                onClick={handleRequestPrice}
                disabled={isRequestingPrice}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 transition-all"
                title={
                  product.status === "PENDING"
                    ? "Currently Pending: Click to re-request quote"
                    : "Request updated quotation from suppliers"
                }
              >
                {isRequestingPrice ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Request Price
              </button>
            )}

            {product && (
              <Link
                href={`/products/${product.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Edit2 className="w-4 h-4" />
                Edit Details
              </Link>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : error || !product ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-rose-400">
            {error || "Product not found"}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                {(() => {
                  const isOnlineWeb =
                    product.source === "ONLINE_WEB" ||
                    product.source === "LK_TRONICS" ||
                    Boolean(product.externalId);
                  return (
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`font-mono text-sm font-bold ${
                          isOnlineWeb ? "text-orange-400" : "text-blue-400"
                        }`}
                      >
                        SKU: {product.sku || product.referenceNo || product.recordNo}
                      </span>
                      {getStatusBadge(product.status)}
                      {isOnlineWeb ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
                          <Globe className="w-3.5 h-3.5 text-orange-400" />
                          Online Web
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          PMS
                        </span>
                      )}
                    </div>
                  );
                })()}
                <h2 className="text-xl font-bold text-white mt-1">
                  {product.modelAndName || product.productName}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <p className="text-xs text-slate-400">
                    Requested by {product.author?.name || "System"} on {formatDateDMY(product.productDate || product.createdAt)}
                    {product.priceUpdatedAt && (
                      <span className="ml-2 text-slate-500">
                        • Last Quoted: {formatDateDMY(product.priceUpdatedAt)}
                      </span>
                    )}
                  </p>
                  {(product.referenceLink || product.externalUrl) && (
                    <a
                      href={product.referenceLink || product.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 hover:underline font-semibold"
                    >
                      <span>View on Web Site</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Price Display */}
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Price (LKR)
                </span>
                <span className="text-2xl font-bold text-emerald-400">
                  {product.status === "PRICE_NOT_AVAILABLE"
                    ? "Price Not Available"
                    : formatLKR(product.priceLKR || product.price)}
                </span>
                {product.priceUSD && (
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Sending Sheet Price: ${Number(product.priceUSD).toFixed(2)} USD
                  </span>
                )}
              </div>
            </div>

            {/* Specifications and Image Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center min-h-[340px]">
                {product.imagePath ? (
                  <img
                    src={product.imagePath}
                    alt={product.modelAndName || product.productName}
                    referrerPolicy="no-referrer"
                    className="max-h-[300px] w-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-600">
                    <ImageIcon className="w-16 h-16 stroke-1" />
                    <span className="text-xs font-medium">No product image uploaded</span>
                  </div>
                )}
              </div>

              {/* Specifications Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-3 flex items-center gap-2">
                  <Boxes className="w-4 h-4" />
                  Product Specifications
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    {(() => {
                      let catList: string[] = [];
                      if (product.categoryNames) {
                        try {
                          const parsed = JSON.parse(product.categoryNames);
                          if (Array.isArray(parsed)) catList = parsed.filter(Boolean);
                        } catch {
                          catList = product.categoryNames
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean);
                        }
                      }
                      if (catList.length === 0 && product.category?.name) {
                        catList = [product.category.name];
                      }

                      return (
                        <>
                          <span className="text-slate-400 block mb-1">
                            {catList.length > 1 ? "Categories" : "Category"}
                          </span>
                          {catList.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {catList.map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="font-semibold text-slate-500">Uncategorized</span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Quantity / Stock</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {product.shippingClass === "over-the-sea" || product.shippingClass === "Over the Sea" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                          <span>🚢</span>
                          <span>Over the Sea</span>
                        </span>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-200 border border-slate-700">
                            {product.quantity ?? 1}
                          </span>
                          {product.stockStatus === "outofstock" ? (
                            <span className="text-[10px] font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                              In Stock
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Weight (KG)</span>
                    <span className="font-semibold text-white">
                      {product.weight ? `${Number(product.weight)} KG` : "Not specified"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Source</span>
                    {product.source === "ONLINE_WEB" || product.source === "LK_TRONICS" || product.externalId ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
                        <Globe className="w-3.5 h-3.5 text-orange-400" />
                        Online Web (lk-tronics.com)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        PMS Local
                      </span>
                    )}
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-1">Reference Link</span>
                    {product.referenceLink && (product.referenceLink.startsWith("http://") || product.referenceLink.startsWith("https://")) ? (
                      <a
                        href={product.referenceLink}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 truncate max-w-full"
                      >
                        {product.referenceLink} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </div>

                {product.description && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 block text-xs mb-1">Brief Description</span>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                )}

                {product.additionalNote && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 block text-xs mb-1">Additional Note</span>
                    <p className="text-xs text-amber-300/90 whitespace-pre-wrap">
                      {product.additionalNote}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Current Supplier Quotation Terms */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Current Supplier Terms
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Supplier</span>
                  <span className="font-bold text-white">
                    {product.supplier?.name || "Awaiting Supplier Quotation"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Warranty Period</span>
                  <span className="font-medium text-slate-200">
                    {product.warrantyPeriod || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Price Validity</span>
                  <span className="font-medium text-slate-200">
                    {product.priceValidity || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Package Preparation Lead Time</span>
                  <span className="font-medium text-slate-200">
                    {product.leadTime || "—"}
                  </span>
                </div>
              </div>

              {product.supplierNote && (
                <div className="pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400 block mb-1">Supplier Special Note</span>
                  <p className="text-slate-200 italic whitespace-pre-wrap">
                    &quot;{product.supplierNote}&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Price History Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Supplier Price Quotation History
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Historical record of supplier quotation updates with effective dates and pricing
                  </p>
                </div>
              </div>

              {product.priceHistory && product.priceHistory.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Quotation Date</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3 text-right">Price (LKR)</th>
                        <th className="px-3 py-3">Warranty</th>
                        <th className="px-3 py-3">Lead Time</th>
                        <th className="px-4 py-3">Special Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {product.priceHistory.map((entry: PriceHistoryEntry, idx: number) => (
                        <tr key={entry.id || idx} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                            {formatDateDMY(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-amber-300 whitespace-nowrap">
                            {entry.supplier?.name || entry.supplierName || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                            {Number(entry.priceLKR) === 0 ? (
                              <span className="text-rose-400 font-normal">Price Not Available</span>
                            ) : (
                              formatLKR(entry.priceLKR)
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-300">
                            {entry.warrantyPeriod || "—"}
                          </td>
                          <td className="px-3 py-3 text-slate-300">
                            {entry.leadTime || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-400 max-w-[240px] truncate">
                            {entry.note || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  No previous supplier price quotation updates on record yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
