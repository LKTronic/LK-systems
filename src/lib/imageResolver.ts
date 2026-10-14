import fs from "fs";
import path from "path";

export interface ResolvableProduct {
  id?: number;
  sku?: string | null;
  modelAndName?: string | null;
  productName?: string | null;
  imagePath?: string | null;
}

const RESTORED_IMAGE_MAP = [
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00020" ||
      Boolean(p.modelAndName?.includes("D1027") || p.productName?.includes("D1027")),
    url: "/uploads/products/restored-lkreq00020-d1027.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00021" ||
      Boolean(p.modelAndName?.includes("TIP152") || p.productName?.includes("TIP152")),
    url: "/uploads/products/restored-lkreq00021-tip152.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00022" ||
      Boolean(p.modelAndName?.includes("CL57T") || p.productName?.includes("CL57T")),
    url: "/uploads/products/restored-lkreq00022-cl57t.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00023" ||
      Boolean(p.modelAndName?.includes("M456") || p.productName?.includes("M456")),
    url: "/uploads/products/restored-lkreq00023-hcpl-m456.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00024" ||
      Boolean(
        p.modelAndName?.includes("2SC3457") ||
          p.productName?.includes("2SC3457") ||
          p.modelAndName?.includes("C3457")
      ),
    url: "/uploads/products/restored-lkreq00024-2sc3457.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00025" ||
      Boolean(
        p.modelAndName?.includes("2SJ601") ||
          p.productName?.includes("2SJ601") ||
          p.modelAndName?.includes("J601")
      ),
    url: "/uploads/products/restored-lkreq00025-2sj601.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00026" ||
      Boolean(p.modelAndName?.includes("M51995") || p.productName?.includes("M51995")),
    url: "/uploads/products/restored-lkreq00026-m51995afp.png",
  },
  {
    match: (p: ResolvableProduct) =>
      p.sku === "LKREQ00027" ||
      Boolean(p.modelAndName?.includes("PS21255") || p.productName?.includes("PS21255")),
    url: "/uploads/products/restored-lkreq00027-ps21255-e.png",
  },
];

/**
 * Checks if the existing imagePath actually exists on disk.
 * If missing or if it matches a known component that was lost, returns the tracked restored image.
 */
export function resolveSafeProductImage<T extends ResolvableProduct>(product: T): string | null {
  for (const entry of RESTORED_IMAGE_MAP) {
    if (entry.match(product)) {
      if (!product.imagePath) {
        return entry.url;
      }
      // If imagePath is an upload, verify if it exists on disk
      if (product.imagePath.startsWith("/uploads/products/")) {
        try {
          const filename = path.basename(product.imagePath);
          const diskPath = path.join(process.cwd(), "public", "uploads", "products", filename);
          if (!fs.existsSync(diskPath)) {
            return entry.url;
          }
        } catch {
          return entry.url;
        }
      }
    }
  }

  return product.imagePath || null;
}
