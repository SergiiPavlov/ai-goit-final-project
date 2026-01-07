import { z } from "zod";
import type { ProjectRecord } from "../projects.service";
import type { AppEnv } from "../../config/env";
import { openaiChatJson } from "./openai";
import { maxSafety, triageMessage, type SafetyLevel } from "./triage";

const SourceCitationSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().url().optional(),
});

export const ChatResponseSchema = z.object({
  reply: z.string().min(1),
  warnings: z.array(z.string()).default([]),
  safetyLevel: z.enum(["normal", "caution", "urgent"]).default("normal"),
  sources: z.array(SourceCitationSchema).default([]),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

const ChatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type ChatHistoryItem = z.infer<typeof ChatHistoryItemSchema>;

function buildSystemPrompt(opts: { project: ProjectRecord; locale: string; context?: any }) {
  const { project, locale, context } = opts;

  const languageHint =
    locale === "en"
      ? "Respond in English."
      : locale === "uk"
        ? "Відповідай українською."
        : "Отвечай по-русски.";

  const formatHint = `Return ONLY valid JSON with this shape:
{ "reply": string, "warnings": string[], "safetyLevel": "normal"|"caution"|"urgent", "sources": { "title"?: string, "url"?: string }[] }.
No markdown. No extra keys.`;

  const medicalSafety = `Constraints:
- This is informational only, not medical advice.
- Do NOT diagnose; do NOT prescribe medications/dosages.
- Encourage consulting a doctor for symptoms or uncertainty.
- If there are red-flag symptoms, set safetyLevel="urgent" and include a warning.`;

  const contextBlock = context ? `User context (JSON, may be empty): ${JSON.stringify(context)}` : "";

  return [
    project.systemPrompt,
    languageHint,
    medicalSafety,
    `Always include this disclaimer at the end of reply (in the same language): "${project.disclaimerTemplate}"`,
    contextBlock,
    formatHint,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function ensureDisclaimer(reply: string, disclaimer: string) {
  const r = reply.trim();
  const d = disclaimer.trim();
  if (!d) return r;
  if (r.toLowerCase().includes(d.toLowerCase())) return r;
  return `${r}\n\n${d}`;
}

export async function chatWithAssistant(opts: {
  env: AppEnv;
  project: ProjectRecord;
  message: string;
  locale: "ru" | "uk" | "en";
  context?: any;
  history?: ChatHistoryItem[];
}): Promise<ChatResponse> {
  const { env, project, message, locale, context } = opts;

  const triage = triageMessage(message, locale);

  const system = buildSystemPrompt({ project, locale, context });

  // Keep history small; the request schema already caps at 50.
  const history = (opts.history ?? []).slice(-20);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  // If provider is not configured, fall back to a deterministic response (keeps demo stable for reviewers).
  if (!env.OPENAI_API_KEY) {
    const reply = ensureDisclaimer(
      locale === "en"
        ? "AI provider is not configured on this server. Add OPENAI_API_KEY to enable live responses."
        : locale === "uk"
          ? "AI-провайдер не налаштований на цьому сервері. Додайте OPENAI_API_KEY, щоб увімкнути відповіді."
          : "AI‑провайдер не настроен на этом сервере. Добавьте OPENAI_API_KEY, чтобы включить ответы.",
      project.disclaimerTemplate
    );

    return {
      reply,
      warnings: triage.warnings,
      safetyLevel: triage.level,
      sources: [],
    };
  }

  const raw = await openaiChatJson({ env, messages });

  const parsed = ChatResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Provider returned valid JSON but not our contract. Return a safe generic message.
    const reply = ensureDisclaimer(
      locale === "en"
        ? "Sorry, I couldn't produce a structured answer. Please rephrase your question."
        : locale === "uk"
          ? "Вибачте, не вдалося сформувати структуровану відповідь. Спробуйте перефразувати запит."
          : "Извините, не удалось сформировать структурированный ответ. Попробуйте переформулировать вопрос.",
      project.disclaimerTemplate
    );

    return {
      reply,
      warnings: triage.warnings,
      safetyLevel: triage.level,
      sources: [],
    };
  }

  const modelResp = parsed.data;

  const safetyLevel: SafetyLevel = maxSafety(modelResp.safetyLevel, triage.level);
  const warnings = Array.from(new Set([...(triage.warnings ?? []), ...(modelResp.warnings ?? [])]));

  return {
    reply: ensureDisclaimer(modelResp.reply, project.disclaimerTemplate),
    warnings,
    safetyLevel,
    sources: modelResp.sources ?? [],
  };
}
