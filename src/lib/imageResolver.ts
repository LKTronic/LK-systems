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
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00001") || text.includes("INA226");
    },
    url: "/uploads/products/1790846365161-8123776387fdc33884ec8768.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00002") || text.includes("HACKSAW");
    },
    url: "/uploads/products/excel-1790846826123-4d8e4caa8977.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00003") || (text.includes("NEEDLE") && text.includes("PLIER"));
    },
    url: "/uploads/products/excel-1790846826128-e86e7c57300c.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00004") || (text.includes("THIN MOUTH") && text.includes("PLIER"));
    },
    url: "/uploads/products/excel-1790846826129-25c06052b4ff.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00020") || text.includes("D1027") || text.includes("2SD1027");
    },
    url: "/uploads/products/restored-lkreq00020-d1027.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00021") || text.includes("TIP152");
    },
    url: "/uploads/products/restored-lkreq00021-tip152.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00022") || text.includes("CL57T");
    },
    url: "/uploads/products/restored-lkreq00022-cl57t.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00023") || text.includes("M456") || text.includes("HCPL");
    },
    url: "/uploads/products/restored-lkreq00023-hcpl-m456.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00024") || text.includes("2SC3457") || text.includes("C3457");
    },
    url: "/uploads/products/restored-lkreq00024-2sc3457.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00025") || text.includes("2SJ601") || text.includes("J601");
    },
    url: "/uploads/products/restored-lkreq00025-2sj601.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00026") || text.includes("M51995");
    },
    url: "/uploads/products/restored-lkreq00026-m51995afp.png",
  },
  {
    match: (p: ResolvableProduct) => {
      const text = `${p.sku || ""} ${p.modelAndName || ""} ${p.productName || ""}`.toUpperCase();
      return text.includes("LKREQ00027") || text.includes("PS21255");
    },
    url: "/uploads/products/restored-lkreq00027-ps21255-e.png",
  },
];

/**
 * Checks if a product matches a known restored component or has a broken image.
 * Unconditionally returns the tracked restored image asset.
 */
export function resolveSafeProductImage<T extends ResolvableProduct>(product: T): string | null {
  // If product has no image (e.g., user removed/deleted the image), respect explicit deletion
  if (!product.imagePath || product.imagePath.trim() === "" || product.imagePath === "null") {
    return null;
  }

  for (const entry of RESTORED_IMAGE_MAP) {
    if (entry.match(product)) {
      return entry.url;
    }
  }

  return product.imagePath || null;
}
