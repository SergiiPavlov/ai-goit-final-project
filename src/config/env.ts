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

  // Optional but recommended for local development. See Prisma shadow DB docs.
  SHADOW_DATABASE_URL: z.string().optional(),

  // PR-03: lightweight in-memory rate limit (per projectKey + IP).
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  // LLM provider (PR-04)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  // Embeddings for RAG (PR-02)
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
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
