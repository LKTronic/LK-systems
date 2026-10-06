import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1, "Full name is required").transform((val) => val.trim()),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SUPERADMIN", "ADMIN", "STAFF", "SHOP"]).default("STAFF"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "Full name is required").transform((val) => val.trim()).optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .transform((val) => val.trim().toLowerCase())
    .optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["SUPERADMIN", "ADMIN", "STAFF", "SHOP"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
