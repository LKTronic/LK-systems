import { z } from "zod";

export const productSchema = z.object({
  referenceNo: z.string().optional().nullable(),
  modelAndName: z
    .string()
    .min(1, "Model no and name is required")
    .transform((val) => val.trim()),
  productName: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : undefined)),
  sku: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim().toUpperCase() : undefined)),
  productDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format",
    }),
  categoryId: z.coerce.number().optional().nullable(),
  supplierId: z.coerce.number().optional().nullable(),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().optional().nullable().default(1),
  weight: z.coerce.number().optional().nullable(),
  referenceLink: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^https?:\/\//i.test(val),
      { message: "Reference link must begin with http:// or https://" }
    )
    .optional()
    .nullable(),
  additionalNote: z.string().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Price must be greater than or equal to 0").default(0),
  priceUSD: z.coerce.number().optional().nullable(),
  priceLKR: z.coerce.number().optional().nullable(),
  status: z
    .enum(["PENDING", "QUOTED", "PRICE_NOT_AVAILABLE", "NOT_REQUESTED", "ACTIVE", "EXPIRED"])
    .default("PENDING")
    .optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
