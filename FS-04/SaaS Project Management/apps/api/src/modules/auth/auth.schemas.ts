import { z } from "zod";

const emailSchema = z.string().trim().max(254).email("Enter a valid email address").transform((value) => value.toLowerCase());
const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(72, "Password must contain at most 72 characters")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must contain at most 72 UTF-8 bytes");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must contain at least 2 characters").max(80),
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z.string().trim().min(2, "Workspace name must contain at least 2 characters").max(100),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
