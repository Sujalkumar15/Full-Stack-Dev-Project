import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5174"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration", z.flattenError(result.error).fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = result.data;
