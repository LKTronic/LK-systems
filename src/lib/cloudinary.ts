import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { Readable } from "stream";

function getCleanEnv(val?: string): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

// Configure Cloudinary from environment variables
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    getCleanEnv(process.env.CLOUDINARY_CLOUD_NAME) &&
      getCleanEnv(process.env.CLOUDINARY_API_KEY) &&
      getCleanEnv(process.env.CLOUDINARY_API_SECRET)
  );
}

export function getCloudinaryClient() {
  cloudinary.config({
    cloud_name: getCleanEnv(process.env.CLOUDINARY_CLOUD_NAME),
    api_key: getCleanEnv(process.env.CLOUDINARY_API_KEY),
    api_secret: getCleanEnv(process.env.CLOUDINARY_API_SECRET),
    secure: true,
  });
  return cloudinary;
}

export interface UploadQcVideoResult {
  url: string;
  publicId: string;
  bytes: number;
  duration?: number;
  format?: string;
  thumbnailUrl?: string;
}

export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB

/**
 * Uploads a QC test video to Cloudinary using chunked upload stream (supports up to 150MB)
 */
export async function uploadQcVideo(
  buffer: Buffer,
  originalFilename: string
): Promise<UploadQcVideoResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file."
    );
  }

  if (buffer.length > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(
      `File size exceeds 150MB limit (uploaded: ${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`
    );
  }

  const client = getCloudinaryClient();

  const safeName = originalFilename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 40);
  const publicId = `qc_${Date.now()}_${safeName}`;

  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "pms_qc_videos",
        public_id: publicId,
        chunk_size: 20 * 1024 * 1024, // 20MB chunks
        eager: [
          {
            format: "jpg",
            resource_type: "video",
            transformation: [{ width: 480, crop: "scale" }],
          },
        ],
        eager_async: true,
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          console.error("Cloudinary video upload error:", error);
          return reject(error || new Error("Failed to upload video to Cloudinary"));
        }

        // Generate thumbnail URL from Cloudinary video frame
        const thumbnailUrl = client.url(result.public_id, {
          resource_type: "video",
          format: "jpg",
          transformation: [{ width: 480, crop: "scale" }],
        });

        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          bytes: result.bytes || buffer.length,
          duration: result.duration ? Math.round(result.duration) : undefined,
          format: result.format,
          thumbnailUrl,
        });
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

/**
 * Deletes a QC video from Cloudinary by its public ID
 */
export async function deleteQcVideo(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured()) return false;
  if (!publicId) return false;

  try {
    const client = getCloudinaryClient();
    const result = await client.uploader.destroy(publicId, {
      resource_type: "video",
    });
    return result?.result === "ok" || result?.result === "not found";
  } catch (err) {
    console.error("Failed to delete video from Cloudinary:", err);
    return false;
  }
}

export interface CloudinaryStorageUsage {
  configured: boolean;
  plan: string;
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  usedPercent: number;
  usedFormatted: string;
  totalFormatted: string;
  remainingFormatted: string;
  bandwidthUsedBytes?: number;
  creditsUsed?: number;
  creditsLimit?: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1.0) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Fetches real-time storage & credits usage from Cloudinary Admin API
 */
export async function getCloudinaryStorageUsage(): Promise<CloudinaryStorageUsage> {
  if (!isCloudinaryConfigured()) {
    return {
      configured: false,
      plan: "Not Connected",
      usedBytes: 0,
      totalBytes: 25 * 1024 * 1024 * 1024, // 25 GB default
      remainingBytes: 25 * 1024 * 1024 * 1024,
      usedPercent: 0,
      usedFormatted: "0 MB",
      totalFormatted: "25 GB",
      remainingFormatted: "25 GB",
      error: "Cloudinary credentials not configured in .env",
    };
  }

  try {
    const client = getCloudinaryClient();
    const usage = await client.api.usage();

    const plan = usage.plan || "Free (25 Credits)";
    const totalCredits = Number(usage.credits?.limit) || 25;
    const usedCredits = Number(usage.credits?.usage) || 0;
    const totalBytes = totalCredits * 1024 * 1024 * 1024; // 1 credit = 1 GB

    const usedStorageBytes = Number(usage.storage?.usage) || 0;
    const bandwidthUsedBytes = Number(usage.bandwidth?.usage) || 0;

    // Total used bytes against quota
    const usedBytes = Math.min(totalBytes, Math.max(usedStorageBytes, usedCredits * 1024 * 1024 * 1024));
    const remainingBytes = Math.max(0, totalBytes - usedBytes);
    const usedPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 1000) / 10);

    return {
      configured: true,
      plan,
      usedBytes,
      totalBytes,
      remainingBytes,
      usedPercent,
      usedFormatted: formatBytes(usedBytes),
      totalFormatted: formatBytes(totalBytes),
      remainingFormatted: formatBytes(remainingBytes),
      bandwidthUsedBytes,
      creditsUsed: usedCredits,
      creditsLimit: totalCredits,
    };
  } catch (err: any) {
    console.warn("Could not fetch Cloudinary usage:", err?.message);
    return {
      configured: true,
      plan: "Cloudinary Free (25 Credits)",
      usedBytes: 0,
      totalBytes: 25 * 1024 * 1024 * 1024,
      remainingBytes: 25 * 1024 * 1024 * 1024,
      usedPercent: 0,
      usedFormatted: "0 MB",
      totalFormatted: "25 GB",
      remainingFormatted: "25 GB",
      error: err?.message,
    };
  }
}

