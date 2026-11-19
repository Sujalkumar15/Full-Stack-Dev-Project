import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12).max(128);
export const displayNameSchema = z.string().trim().min(2).max(80);

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    name: displayNameSchema,
    password: passwordSchema,
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const userSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type PublicUser = z.infer<typeof userSchema>;
