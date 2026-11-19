import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  FRONTEND_ORIGIN: z.string().url(),
  COOKIE_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
});

export type AppEnvironment = z.infer<typeof envSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): AppEnvironment {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${problems}`);
  }

  return result.data;
}
