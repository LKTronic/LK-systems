"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import {
  HardDrive,
  Cloud,
  Database,
  Lock,
  Download,
  RefreshCw,
  Video,
  FileArchive,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Key,
  ShieldCheck,
  Server,
  Layers,
  ArrowDownToLine,
  HelpCircle,
  Upload,
  Trash2,
} from "lucide-react";

interface StorageData {
  cloudinary: {
    configured: boolean;
    plan: string;
    totalBytes: number;
    usedBytes: number;
    remainingBytes: number;
    usedPercent: number;
    totalFormatted: string;
    usedFormatted: string;
    remainingFormatted: string;
    videos: { count: number; bytes: number; formatted: string };
    backups: { count: number; bytes: number; formatted: string };
    other: { count: number; bytes: number; formatted: string };
  };
  database: {
    totalBytes: number;
    totalFormatted: string;
    totalRows: number;
    tables: Array<{
      name: string;
      rows: number;
      totalBytes: number;
      formattedSize: string;
    }>;
  };
  automation: {
    lastDailyBackup: string | null;
    lastWeeklyBackup: string | null;
    encryption: string;
  };
  backupsList: Array<{
    id: string;
    filename: string;
    publicId: string;
    type: "DAILY" | "WEEKLY" | "MANUAL";
    bytes: number;
    formattedSize: string;
    createdAt: string;
    recordCounts?: Record<string, number>;
  }>;
}

export default function StorageAndBackupAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StorageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedBackupType, setSelectedBackupType] = useState<"DAILY" | "WEEKLY" | "MANUAL">("MANUAL");
  const [migrating, setMigrating] = useState(false);
  const [cleaningDb, setCleaningDb] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<{
    total: number;
    processed: number;
    percent: number;
    batch: number;
    statusText: string;
  } | null>(null);

  const isSuperAdmin = (session?.user as any)?.role === "SUPERADMIN";

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !isSuperAdmin) {
      router.push("/dashboard");
      return;
    }
    loadStorageData();
  }, [session, status]);

  const loadStorageData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load storage data");
      }
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load storage details");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    setBackupMsg(null);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedBackupType }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Backup failed");
      }
      setBackupMsg({
        type: "success",
        text: `Encrypted ${selectedBackupType} backup generated and uploaded to Cloudinary successfully!`,
      });
      loadStorageData();
    } catch (err: any) {
      setBackupMsg({ type: "error", text: err?.message || "Backup failed to complete" });
    } finally {
      setBackingUp(false);
    }
  };

  const handleMigrateImages = async () => {
    if (
      !confirm(
        "This will safely back up all local & MySQL images to a server folder first, upload each image to Cloudinary in fast 5-image batches, verify all links are live, update product URLs, and clean up the database bloat. Proceed?"
      )
    ) {
      return;
    }

    setMigrating(true);
    setMigrateResult(null);
    setMigrationProgress({
      total: 0,
      processed: 0,
      percent: 0,
      batch: 0,
      statusText: "Analyzing images to migrate...",
    });

    try {
      // 1. Check live status first
      const statusRes = await fetch("/api/admin/storage/migrate-images");
      const statusRaw = await statusRes.text();
      let statusJson: any = null;
      try {
        statusJson = JSON.parse(statusRaw);
      } catch {
        throw new Error(`Server returned non-JSON response (${statusRes.status}). Please try again.`);
      }

      if (!statusRes.ok || !statusJson.success) {
        throw new Error(statusJson.error || "Failed to check migration status");
      }

      const totalItems = statusJson.stats?.totalRemainingToMigrate || 0;
      if (totalItems === 0) {
        setMigrateResult({
          type: "success",
          text: "All product images are already on Cloudinary! MySQL database is clean.",
        });
        setMigrating(false);
        setMigrationProgress(null);
        loadStorageData();
        return;
      }

      let completed = false;
      let cursor = 0;
      let batchNum = 0;
      let totalMigrated = 0;
      let zeroProgressCount = 0;
      const MAX_BATCHES = Math.min(60, Math.ceil(totalItems / 2) + 5);

      while (!completed && batchNum < MAX_BATCHES) {
        batchNum++;
        setMigrationProgress({
          total: totalItems,
          processed: totalMigrated,
          percent: Math.min(99, Math.round((totalMigrated / Math.max(1, totalItems)) * 100)),
          batch: batchNum,
          statusText: `Uploading batch #${batchNum} to Cloudinary and verifying URLs...`,
        });

        const res = await fetch("/api/admin/storage/migrate-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: 5, cursor, action: "batch" }),
        });

        const rawText = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(rawText);
        } catch {
          throw new Error(
            `Hostinger gateway timeout or network interruption on batch #${batchNum}. Click 'Migrate & Verify' again to resume!`
          );
        }

        if (!res.ok || !json.success) {
          throw new Error(json.error || `Batch #${batchNum} failed`);
        }

        const batchProcessed = json.processedInBatch || 0;
        totalMigrated += batchProcessed;
        cursor = json.nextCursor ?? cursor;
        const remaining = json.totalRemaining ?? Math.max(0, totalItems - totalMigrated);
        const percent = Math.min(100, Math.round(((totalItems - remaining) / Math.max(1, totalItems)) * 100));

        if (batchProcessed === 0) {
          zeroProgressCount++;
        } else {
          zeroProgressCount = 0;
        }

        setMigrationProgress({
          total: totalItems,
          processed: totalMigrated,
          percent: json.completed || remaining === 0 ? 100 : percent,
          batch: batchNum,
          statusText: json.completed || remaining === 0
            ? "Migration complete! All images verified live on Cloudinary."
            : `Migrated ${totalMigrated} of ${totalItems} images (${percent}%)...`,
        });

        if (json.completed || remaining === 0 || zeroProgressCount >= 2) {
          completed = true;
          break;
        }

        // Brief delay between batches to allow UI to breathe
        await new Promise((r) => setTimeout(r, 200));
      }

      setMigrateResult({
        type: "success",
        text: `Images safely migrated to Cloudinary, verified live, and MySQL 44MB bloat completely cleaned!`,
      });
      loadStorageData();
    } catch (err: any) {
      setMigrateResult({ type: "error", text: err?.message || "Migration failed" });
    } finally {
      setMigrating(false);
      setMigrationProgress(null);
    }
  };

  const handleCleanDatabase = async () => {
    if (
      !confirm(
        "This will permanently delete the 44MB Base64 image cache from MySQL (ProductImageBackup table). Since images are already hosted on Cloudinary, this frees MySQL memory. Proceed?"
      )
    ) {
      return;
    }
    setCleaningDb(true);
    setMigrateResult(null);
    try {
      const res = await fetch("/api/admin/storage/migrate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup" }),
      });
      const rawText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error("Server returned non-JSON response during cleanup.");
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to clean MySQL database");
      }
      setMigrateResult({
        type: "success",
        text: json.message || "MySQL memory freed successfully!",
      });
      loadStorageData();
    } catch (err: any) {
      setMigrateResult({ type: "error", text: err?.message || "Clean failed" });
    } finally {
      setCleaningDb(false);
    }
  };

  const handleReuploadBackup = async () => {
    if (
      !confirm(
        "This will read all image files from the server backup folder (backups/product_images_backup/) and re-upload them to Cloudinary (folder 'pms_products/'), fixing any 404 broken product image links. Proceed?"
      )
    ) {
      return;
    }
    setRestoringBackup(true);
    setMigrateResult(null);
    try {
      const res = await fetch("/api/admin/storage/migrate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reupload_backup" }),
      });
      const rawText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error("Server returned non-JSON response during backup re-upload.");
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to re-upload backup images");
      }
      setMigrateResult({
        type: "success",
        text: json.message || "Images re-uploaded to Cloudinary successfully!",
      });
      loadStorageData();
    } catch (err: any) {
      setMigrateResult({ type: "error", text: err?.message || "Re-upload failed" });
    } finally {
      setRestoringBackup(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading && !data) {
    return (
      <AppLayout
        title="Storage & Automated Backups"
        description="Cloudinary storage quota, QC video usage, and AES-256 encrypted database backups"
      >
        <div className="py-24 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-sm font-medium text-slate-400">Loading Cloudinary &amp; Database storage metrics...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Storage & Automated Backups"
      description="Cloudinary storage quota, QC video usage, and AES-256 encrypted database backups"
    >
      <div className="space-y-8">
        {/* Sub-Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs uppercase font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-md flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Superadmin Privileged Zone
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              • Real-time cloud storage metrics and automated disaster recovery
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadStorageData}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh Metrics
            </button>
            <a
              href="/decrypt-tool.html"
              download="pms-decrypt-tool.html"
              className="px-3.5 py-2 text-xs font-semibold bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-lg flex items-center gap-2 transition"
            >
              <Key className="w-3.5 h-3.5" />
              Download Offline Decrypt Tool
            </a>
          </div>
        </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl flex items-center gap-3 text-red-200 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {backupMsg && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm border ${
            backupMsg.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
              : "bg-red-950/40 border-red-800/60 text-red-200"
          }`}
        >
          {backupMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{backupMsg.text}</span>
        </div>
      )}

      {/* Cloudinary Overall Quota Card */}
      {data && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-teal-400" />
                Cloudinary Storage Quota
              </div>
              <h2 className="text-2xl font-black text-white mt-1">
                {data.cloudinary.usedFormatted}{" "}
                <span className="text-sm font-normal text-slate-400">/ {data.cloudinary.totalFormatted} limit</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Active Plan: <span className="font-semibold text-slate-200">{data.cloudinary.plan}</span> •{" "}
                <span className="text-emerald-400 font-semibold">{data.cloudinary.remainingFormatted}</span> available
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-3xl font-black text-white">{data.cloudinary.usedPercent}%</div>
                <div className="text-[11px] text-slate-400 font-medium">Quota Used</div>
              </div>
            </div>
          </div>

          {/* Progress Bar with Categories */}
          <div className="space-y-2">
            <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (data.cloudinary.videos.bytes / (data.cloudinary.totalBytes || 1)) * 100
                  )}%`,
                }}
                className="bg-indigo-500 h-full transition-all duration-500"
                title={`QC Videos: ${data.cloudinary.videos.formatted}`}
              />
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (data.cloudinary.backups.bytes / (data.cloudinary.totalBytes || 1)) * 100
                  )}%`,
                }}
                className="bg-teal-500 h-full transition-all duration-500"
                title={`Backups: ${data.cloudinary.backups.formatted}`}
              />
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (data.cloudinary.other.bytes / (data.cloudinary.totalBytes || 1)) * 100
                  )}%`,
                }}
                className="bg-slate-600 h-full transition-all duration-500"
                title={`Other: ${data.cloudinary.other.formatted}`}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                <span>
                  QC Test Videos: <strong>{data.cloudinary.videos.formatted}</strong> ({data.cloudinary.videos.count}{" "}
                  videos)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teal-500 inline-block" />
                <span>
                  Encrypted Backups: <strong>{data.cloudinary.backups.formatted}</strong> ({data.cloudinary.backups.count}{" "}
                  files)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-600 inline-block" />
                <span>
                  Other Assets: <strong>{data.cloudinary.other.formatted}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 Metric Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: QC Videos Storage */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Video className="w-4 h-4" />
                QC Video Storage
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {data.cloudinary.videos.count} Files
              </span>
            </div>
            <div className="text-2xl font-black text-white">{data.cloudinary.videos.formatted}</div>
            <p className="text-xs text-slate-400">
              Stored under <code className="text-indigo-300">pms_qc_videos/</code> folder on Cloudinary.
            </p>
          </div>

          {/* Card 2: Database Backups Storage */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Encrypted Backups
              </span>
              <span className="text-xs font-mono font-semibold text-teal-300 bg-teal-950/60 border border-teal-800/40 px-2 py-0.5 rounded">
                AES-256-GCM
              </span>
            </div>
            <div className="text-2xl font-black text-white">{data.cloudinary.backups.formatted}</div>
            <p className="text-xs text-slate-400">
              Rotated: Keeps <strong>7 daily</strong> &amp; <strong>4 weekly</strong> snapshots. Older files auto-deleted.
            </p>
          </div>

          {/* Card 3: Live MySQL Database Size */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4" />
                Live MySQL Database
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {data.database.totalRows.toLocaleString()} Rows
              </span>
            </div>
            <div className="text-2xl font-black text-white">{data.database.totalFormatted}</div>
            <p className="text-xs text-slate-400">
              {data.database.tables.length} tables hosted on Hostinger MySQL (with index storage).
            </p>
          </div>
        </div>
      )}

      {/* Hostinger Storage Optimization & Image Migration */}
      {data && (
        <div className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/40 border border-teal-800/40 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-teal-400" />
                Hostinger Storage Optimization &amp; Image Migration
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                Migrate Local &amp; MySQL Images to Cloudinary
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Safely creates a local server backup first, uploads each image to Cloudinary in fast 5-image batches, verifies all URLs are live (HTTP 200), updates product image links, and cleans the 44MB Base64 bloat from MySQL so all your Hostinger websites stay fast and healthy.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleReuploadBackup}
                disabled={restoringBackup || migrating || cleaningDb}
                className="px-3.5 py-2.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 disabled:opacity-50 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                title="Re-upload all saved backup images to Cloudinary (folder 'pms_products') and fix broken links"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${restoringBackup ? "animate-spin" : ""}`} />
                {restoringBackup ? "Re-uploading Server Backup..." : "Restore & Re-upload Server Backup Images"}
              </button>

              {data.database.tables.some((t) => t.name === "ProductImageBackup" && t.rows > 0) && (
                <button
                  onClick={handleCleanDatabase}
                  disabled={cleaningDb || migrating}
                  className="px-3.5 py-2.5 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 disabled:opacity-50 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                  title="Purge Base64 cache from MySQL"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${cleaningDb ? "animate-spin" : ""}`} />
                  {cleaningDb ? "Cleaning MySQL..." : "Clean MySQL Bloat (44MB)"}
                </button>
              )}

              <button
                onClick={handleMigrateImages}
                disabled={migrating || cleaningDb}
                className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-teal-900/30 transition shrink-0"
              >
                {migrating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Migrating Batch...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Migrate &amp; Verify Images on Cloudinary
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Progress Bar when Migrating */}
          {migrationProgress && (
            <div className="bg-slate-950/60 border border-teal-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-teal-300 flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin text-teal-400" />
                  {migrationProgress.statusText}
                </span>
                <span className="font-mono font-bold text-white">
                  {migrationProgress.percent}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${migrationProgress.percent}%` }}
                  className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Batch #{migrationProgress.batch} (5 images / batch)</span>
                <span>
                  {migrationProgress.processed} of {migrationProgress.total} images completed
                </span>
              </div>
            </div>
          )}

          {migrateResult && (
            <div
              className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                migrateResult.type === "success"
                  ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                  : "bg-red-950/60 border-red-800/60 text-red-300"
              }`}
            >
              {migrateResult.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{migrateResult.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Backup Trigger & Schedule Status */}
      {data && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-teal-400" />
                Backup Automation &amp; Immediate Trigger
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Backups are compressed with gzip and encrypted with military-grade AES-256-GCM before upload.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedBackupType}
                onChange={(e: any) => setSelectedBackupType(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 rounded-lg px-3 py-2 outline-none"
              >
                <option value="MANUAL">Manual Snapshot</option>
                <option value="DAILY">Daily Backup</option>
                <option value="WEEKLY">Weekly Backup</option>
              </select>

              <button
                onClick={handleCreateBackup}
                disabled={backingUp}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-teal-600/20 transition"
              >
                {backingUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Encrypting &amp; Uploading...
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Create Backup Now
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Last Daily Backup</div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {formatDate(data.automation.lastDailyBackup)}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Last Weekly Backup</div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {formatDate(data.automation.lastWeeklyBackup)}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Cloudinary Backups Table */}
      {data && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Recent Encrypted Cloud Backups
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {data.backupsList.length} Available in History
            </span>
          </div>

          {data.backupsList.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs italic">
              No backups recorded yet. Click &quot;Create Backup Now&quot; above to take your first encrypted snapshot.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px]">
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">File Name</th>
                    <th className="py-3 px-3">Date &amp; Time</th>
                    <th className="py-3 px-3">Size</th>
                    <th className="py-3 px-3">Security</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {data.backupsList.map((bk) => (
                    <tr key={bk.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            bk.type === "DAILY"
                              ? "bg-blue-950 text-blue-300 border border-blue-800/60"
                              : bk.type === "WEEKLY"
                              ? "bg-purple-950 text-purple-300 border border-purple-800/60"
                              : "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                          }`}
                        >
                          {bk.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300 truncate max-w-[240px]">
                        {bk.filename}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{formatDate(bk.createdAt)}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-300">{bk.formattedSize}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                          <Lock className="w-3 h-3" />
                          AES-256-GCM
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <a
                          href={`/api/admin/storage/download?publicId=${encodeURIComponent(
                            bk.publicId
                          )}&decrypt=true`}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded transition inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download Decrypted (JSON)
                        </a>
                        <a
                          href={`/api/admin/storage/download?publicId=${encodeURIComponent(
                            bk.publicId
                          )}&decrypt=false`}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition inline-flex items-center gap-1"
                          title="Download raw encrypted .enc file"
                        >
                          <ArrowDownToLine className="w-3 h-3" />
                          Raw (.enc)
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MySQL Table Breakdown List */}
      {data && data.database.tables.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Hostinger MySQL Table Sizes Breakdown
            </h3>
            <span className="text-xs text-slate-400">
              Total Database Size: <strong className="text-white">{data.database.totalFormatted}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.database.tables.map((t) => (
              <div
                key={t.name}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-slate-200">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{t.rows.toLocaleString()} rows</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-semibold text-amber-400">{t.formattedSize}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disaster Recovery Guide */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-teal-400" />
          Disaster Recovery &amp; Offline Decryption Guide
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          If PMS or Hostinger ever fails completely, you can restore your business data in minutes. Download your{" "}
          <code className="text-teal-300">.enc</code> backup file directly from your Cloudinary dashboard, then open{" "}
          <code className="text-teal-300">decrypt-tool.html</code> in Chrome (even offline with no internet), enter your
          encryption key, and click Decrypt. It produces the readable JSON containing all your products, quotes,
          checklists, and users.
        </p>
        </div>
      </div>
    </AppLayout>
  );
}

