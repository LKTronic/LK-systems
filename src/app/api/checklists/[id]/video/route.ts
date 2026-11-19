import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadQcVideo,
  MAX_VIDEO_SIZE_BYTES,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
import {
  attachChecklistVideo,
  deleteChecklistVideo,
  getChecklists,
} from "@/lib/productChecklistServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Maximum duration timeout for large video uploads (5 minutes)
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/checklists/[id]/video
 * Upload video file (max 150MB) and attach to checklist
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          error:
            "Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file.",
        },
        { status: 503 }
      );
    }

    const resolvedParams = await Promise.resolve(context.params);
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: "Checklist ID is required" },
        { status: 400 }
      );
    }

    // Verify checklist exists first
    const checklists = await getChecklists();
    const existing = checklists.find((c) => c.id === id || c.checklistNo === id);
    if (!existing) {
      return NextResponse.json(
        { error: "Checklist record not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = (formData.get("video") || formData.get("file")) as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided in form data ('video' or 'file' field expected)" },
        { status: 400 }
      );
    }

    // Validate video MIME type
    const mimeType = file.type?.toLowerCase() || "";
    const isVideo =
      mimeType.startsWith("video/") ||
      file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i);
    if (!isVideo) {
      return NextResponse.json(
        { error: "File must be a valid video (e.g. MP4, WebM, MOV)" },
        { status: 400 }
      );
    }

    // Validate size (max 150 MB)
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

    // Upload to Cloudinary
    const uploadResult = await uploadQcVideo(buffer, file.name);

    // Attach to checklist in database
    const updatedChecklist = await attachChecklistVideo(id, {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      bytes: uploadResult.bytes,
      duration: uploadResult.duration,
      format: uploadResult.format,
      thumbnailUrl: uploadResult.thumbnailUrl,
      uploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "QC video uploaded successfully",
      video: uploadResult,
      videoInfo: uploadResult,
      checklist: updatedChecklist,
    });
  } catch (err: any) {
    console.error("POST /api/checklists/[id]/video error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload video" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklists/[id]/video
 * Delete only the video without deleting the checklist record
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json(
        { error: "Checklist ID is required" },
        { status: 400 }
      );
    }

    const result = await deleteChecklistVideo(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete video" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Video deleted successfully without affecting checklist data",
      checklist: result.checklist,
    });
  } catch (err: any) {
    console.error("DELETE /api/checklists/[id]/video error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete video" },
      { status: 500 }
    );
  }
}

