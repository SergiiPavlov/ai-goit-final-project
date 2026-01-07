import { z } from "zod";
import * as dotenv from "dotenv";

// Load .env (safe to call multiple times)
dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),

  // Comma-separated list. If empty/undefined in PR-02 -> permissive CORS (for local dev).
  ALLOWED_ORIGINS: z.string().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Not used in PR-02 yet, but reserved
  OPENAI_API_KEY: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  return parsed.data;
}

export function parseAllowedOrigins(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
