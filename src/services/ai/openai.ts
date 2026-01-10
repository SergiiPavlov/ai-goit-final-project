import type { AppEnv } from "../../config/env";
import { HttpError } from "../../middlewares/errorHandler";

/**
 * Minimal OpenAI client via fetch (CommonJS-friendly).
 * Uses Chat Completions API with JSON mode to force valid JSON output.
 */
export async function openaiChatJson(opts: {
  env: AppEnv;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxCompletionTokens?: number;
}): Promise<any> {
  const { env, messages } = opts;

  if (!env.OPENAI_API_KEY) {
    throw new HttpError(501, "AI_PROVIDER_NOT_CONFIGURED", "OPENAI_API_KEY is not configured");
  }

  const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${base}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: env.OPENAI_TEMPERATURE,
        // JSON mode: guarantees valid JSON (schema adherence is validated in-app).
        response_format: { type: "json_object" },
        max_completion_tokens: opts.maxCompletionTokens ?? 650,
        messages,
      }),
      signal: controller.signal,
    });

    const text = await resp.text();
    if (!resp.ok) {
      // Avoid leaking upstream details; keep it actionable.
      throw new HttpError(502, "AI_PROVIDER_ERROR", `OpenAI request failed (${resp.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new HttpError(502, "AI_PROVIDER_ERROR", "OpenAI returned non-JSON response");
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new HttpError(502, "AI_PROVIDER_ERROR", "OpenAI response missing message content");
    }

    try {
      return JSON.parse(content);
    } catch {
      // JSON mode should prevent this, but keep a guard.
      throw new HttpError(502, "AI_PROVIDER_ERROR", "OpenAI message content is not valid JSON");
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new HttpError(504, "AI_PROVIDER_TIMEOUT", "OpenAI request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Embeddings helper (RAG).
 * Uses the Embeddings API and returns float vectors.
 */
export async function openaiEmbeddings(opts: {
  env: AppEnv;
  input: string[];
}): Promise<number[][]> {
  const { env, input } = opts;

  if (!env.OPENAI_API_KEY) {
    throw new HttpError(501, "AI_PROVIDER_NOT_CONFIGURED", "OPENAI_API_KEY is not configured");
  }

  const clean = input.map((s) => (s ?? "").toString().trim()).filter(Boolean);
  if (!clean.length) {
    throw new HttpError(400, "EMBEDDINGS_INPUT_EMPTY", "Embeddings input is empty");
  }

  const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${base}/embeddings`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OPENAI_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: clean,
        encoding_format: "float",
      }),
      signal: controller.signal,
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new HttpError(502, "AI_PROVIDER_ERROR", `OpenAI embeddings request failed (${resp.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new HttpError(502, "AI_PROVIDER_ERROR", "OpenAI embeddings returned non-JSON response");
    }

    const arr = data?.data;
    if (!Array.isArray(arr) || !arr.length) {
      throw new HttpError(502, "AI_PROVIDER_ERROR", "OpenAI embeddings response missing data[]");
    }

    const vectors = arr.map((d: any) => d?.embedding).filter((v: any) => Array.isArray(v));
    if (vectors.length !== arr.length) {
      throw new HttpError(502, "AI_PROVIDER_ERROR", "OpenAI embeddings response missing embedding vectors");
    }

    return vectors as number[][];
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new HttpError(504, "AI_PROVIDER_TIMEOUT", "OpenAI embeddings request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
