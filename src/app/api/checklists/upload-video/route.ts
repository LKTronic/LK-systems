import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadQcVideo,
  deleteQcVideo,
  MAX_VIDEO_SIZE_BYTES,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
import { attachChecklistVideo } from "@/lib/productChecklistServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes for 150MB upload

/**
 * POST /api/checklists/upload-video
 * Uploads a QC test video to Cloudinary (up to 150MB).
 * If checklistId is optionally provided, attaches it directly to that checklist.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          error:
            "Cloudinary credentials missing in .env. Please check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("video")) as File | null;
    const checklistId = formData.get("checklistId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Validate type
    const mimeType = file.type?.toLowerCase() || "";
    const isVideo =
      mimeType.startsWith("video/") ||
      file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i);
    if (!isVideo) {
      return NextResponse.json(
        { error: "File must be a valid video format (MP4, WebM, MOV, etc.)" },
        { status: 400 }
      );
    }

    // Validate size (max 150MB)
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `Video size exceeds maximum allowed limit of 150MB (uploaded: ${sizeMb}MB).`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream upload to Cloudinary in 20MB chunks
    const uploadResult = await uploadQcVideo(buffer, file.name);

    // If an existing checklist ID is attached, update database as well
    let updatedChecklist = null;
    if (checklistId) {
      try {
        updatedChecklist = await attachChecklistVideo(checklistId, {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          bytes: uploadResult.bytes,
          duration: uploadResult.duration,
          format: uploadResult.format,
          thumbnailUrl: uploadResult.thumbnailUrl,
          uploadedAt: new Date().toISOString(),
        });
      } catch (attachErr) {
        console.warn("Could not attach video to checklist ID:", attachErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Video uploaded successfully to Cloudinary",
      videoInfo: uploadResult,
      checklist: updatedChecklist,
    });
  } catch (err: any) {
    console.error("POST /api/checklists/upload-video error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload video to Cloudinary" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklists/upload-video?publicId=xxx
 * Deletes a video directly from Cloudinary by its publicId
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const publicId = searchParams.get("publicId");

    if (!publicId) {
      return NextResponse.json(
        { error: "publicId parameter is required" },
        { status: 400 }
      );
    }

    const success = await deleteQcVideo(publicId);
    return NextResponse.json({
      success,
      message: "Video successfully deleted from Cloudinary",
    });
  } catch (err: any) {
    console.error("DELETE /api/checklists/upload-video error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete video from Cloudinary" },
      { status: 500 }
    );
  }
}

