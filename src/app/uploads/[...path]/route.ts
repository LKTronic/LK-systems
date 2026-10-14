import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getImageFromDatabase } from "@/lib/imageStorage";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    const filename = pathSegments[pathSegments.length - 1];

    if (!filename) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    const diskPath = path.join(uploadDir, path.basename(filename));

    // 1. If file already exists on disk, serve it immediately
    if (fs.existsSync(diskPath)) {
      const buffer = fs.readFileSync(diskPath);
      const ext = path.extname(filename).toLowerCase();
      let mimeType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".webp") mimeType = "image/webp";
      else if (ext === ".svg") mimeType = "image/svg+xml";

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // 2. Check persistent MySQL database backup (survives all git pulls and site updates)
    const backup = await getImageFromDatabase(filename);
    if (backup && backup.buffer) {
      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(diskPath, backup.buffer);
      } catch (writeErr) {
        console.warn("Could not cache restored image to disk:", writeErr);
      }

      return new NextResponse(new Uint8Array(backup.buffer), {
        headers: {
          "Content-Type": backup.mimeType || "image/png",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // 3. Check if matching product in database has a restored asset or known mapping
    const cleanBase = path.basename(filename);
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { imagePath: { contains: cleanBase } },
          { supplierImage: { contains: cleanBase } },
        ],
      },
      select: { id: true, sku: true, productName: true, modelAndName: true },
    });

    if (product) {
      const text = `${product.sku || ""} ${product.productName || ""} ${product.modelAndName || ""}`.toUpperCase();

      const lookupMap: Record<string, string> = {
        D1027: "restored-lkreq00020-d1027.png",
        TIP152: "restored-lkreq00021-tip152.png",
        CL57T: "restored-lkreq00022-cl57t.png",
        M456: "restored-lkreq00023-hcpl-m456.png",
        "2SC3457": "restored-lkreq00024-2sc3457.png",
        C3457: "restored-lkreq00024-2sc3457.png",
        "2SJ601": "restored-lkreq00025-2sj601.png",
        J601: "restored-lkreq00025-2sj601.png",
        M51995: "restored-lkreq00026-m51995afp.png",
        PS21255: "restored-lkreq00027-ps21255-e.png",
      };

      for (const [key, assetName] of Object.entries(lookupMap)) {
        if (text.includes(key)) {
          const assetDiskPath = path.join(uploadDir, assetName);
          if (fs.existsSync(assetDiskPath)) {
            const buf = fs.readFileSync(assetDiskPath);
            try {
              fs.writeFileSync(diskPath, buf);
            } catch {}
            return new NextResponse(new Uint8Array(buf), {
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              },
            });
          }
        }
      }
    }

    // 4. Return clean, high-contrast SVG component placeholder (Never 404, never broken image box)
    const label = (product?.sku || product?.modelAndName || filename.replace(/[-_.]/g, " ")).substring(0, 16);
    const sub = (product?.productName || "ELECTRONICS COMPONENT").substring(0, 24);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)" />
  <rect x="25" y="25" width="350" height="350" rx="20" fill="#1e293b" stroke="#334155" stroke-width="2" />
  <circle cx="200" cy="160" r="50" fill="#3b82f6" fill-opacity="0.12" stroke="#60a5fa" stroke-width="2" stroke-dasharray="4 4" />
  <path d="M180 160 L220 160 M200 140 L200 180" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
  <text x="200" y="255" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="bold" fill="#f8fafc" text-anchor="middle">${label}</text>
  <text x="200" y="285" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#94a3b8" text-anchor="middle">${sub}</text>
</svg>`;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Dynamic image fallback error:", err);
    return new NextResponse("Not Found", { status: 404 });
  }
}
