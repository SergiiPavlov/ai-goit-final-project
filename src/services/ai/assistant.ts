import { z } from "zod";
import type { ProjectRecord } from "../projects.service";
import type { AppEnv } from "../../config/env";
import { openaiChatJson, openaiEmbeddings } from "./openai";
import { maxSafety, triageMessage, type SafetyLevel } from "./triage";
import { retrieveKnowledgeCitations, type KnowledgeCitation } from "../kb.service";
import {
  ASK_QUESTION_PROMPT,
  DISCLAIMER,
  ERROR_GENERIC,
  NO_PROVIDER,
  REPHRASE_PROMPT,
  SMOKE_TEST_RESPONSE,
} from "../../i18n";
import type { Locale } from "../../utils/locale";

const SourceCitationSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  snippet: z.string().min(1),
  url: z.string().url().nullable().optional(),
});

export const ApiChatResponseSchema = z.object({
  reply: z.string().min(1),
  warnings: z.array(z.string()).default([]),
  safetyLevel: z.enum(["normal", "caution", "urgent"]).default("normal"),
  sources: z.array(SourceCitationSchema).default([]),
});

export type ChatResponse = z.infer<typeof ApiChatResponseSchema>;

// Provider JSON payload (we keep it tolerant; server attaches citations).
const ProviderChatResponseSchema = z.object({
  reply: z.string().min(1),
  warnings: z.array(z.string()).optional().default([]),
  safetyLevel: z.enum(["normal", "caution", "urgent"]).optional().default("normal"),
  sources: z.any().optional(),
});

function tokenizeForRelevance(text: string) {
  const raw = (text || "")
    .replace(/ё/g, "е")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);

  // Domain/common stopwords (keep this small; it's a relevance *heuristic*, not NLP)
  const stop = new Set([
    "и",
    "в",
    "во",
    "на",
    "не",
    "что",
    "это",
    "как",
    "ли",
    "я",
    "мы",
    "вы",
    "он",
    "она",
    "они",
    "то",
    "а",
    "но",
    "или",
    "при",
    "можно",
    "нужно",
    // Pregnancy is almost always present; it's not discriminative for topic relevance
    "беременность",
    "беременности",
    "беременной",
    "беременна",
    "беремен",
    "pregnancy",
    "pregnant",
    // EN
    "the",
    "a",
    "an",
    "and",
    "or",
    "is",
    "are",
    "to",
    "in",
    "on",
    "for",
    "with",
    "can",
    "should",
  ]);

  return raw
    .filter((t) => t.length >= 4)
    .filter((t) => !stop.has(t));
}

function isGreetingOrShortAck(text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  const patterns = [
    /^hi\b/,
    /^hello\b/,
    /^hey\b/,
    /^привет\b/,
    /^здравствуй/,
    /^здравствуйте/,
    /^добрый\s+(день|вечер)/,
    /^вітаю/,
    /^добрий\s+(день|вечір)/,
    /^дякую/,
    /^спасибо/,
    /^thanks\b/,
    /^thank\s+you\b/,
    /^ok\b/,
    /^okay\b/,
    /^test\b/,
    /^тест\b/,
  ];
  return patterns.some((p) => p.test(t));
}

function isExplicitQuestion(text: string) {
  const t = text.trim();
  if (!t) return false;
  if (isGreetingOrShortAck(t)) return false;
  if (/[?？]/.test(t)) return true;
  const patterns = [
    /^(можно|нужно|стоит|как|что|почему|зачем|когда|сколько|какой|какая|какие)\b/i,
    /^(чи|можна|потрібно|варто|як|що|коли|скільки|який|яка|які)\b/i,
    /^(can|should|is|are|do|does|what|why|how|when|where)\b/i,
    /^could\s+i\b/i,
    /^is\s+it\b/i,
  ];
  return patterns.some((p) => p.test(t));
}

function looksIrrelevant(question: string, answer: string) {
  const q = question || "";
  const qTokens = tokenizeForRelevance(q);
  if (!isExplicitQuestion(q)) return false;
  if (!qTokens.length) return false;

  const a = (answer || "").replace(/ё/g, "е").toLowerCase();
  for (const t of qTokens) {
    // Substring match is ok for RU morphology, e.g. "курить" vs "курение"
    if (a.includes(t)) return false;
    if (t.length >= 5 && a.includes(t.slice(0, 3))) return false;
  }
  return true;
}

function hasLetters(s: string) {
  try {
    return /\p{L}/u.test(s);
  } catch {
    return /[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]/.test(s);
  }
}

function isSmokeTestMessage(message: string) {
  const t = message.trim().toLowerCase();
  if (!t) return false;
  const hasSmoke = t.includes("smoke");
  const hasTest = t.includes("test") || t.includes("тест");
  return hasSmoke && hasTest;
}

function detectLocaleFromText(text: string): "ru" | "uk" | "en" | "cyrillic" | "unknown" {
  const s = text || "";
  const latin = (s.match(/[A-Za-z]/g) ?? []).length;
  const cyrillic = (s.match(/[А-Яа-яЁёІіЇїЄєҐґ]/g) ?? []).length;
  const hasUk = /[ІіЇїЄєҐґ]/.test(s);
  const hasRu = /[ЫыЭэЁёЪъ]/.test(s);

  if (!latin && !cyrillic) return "unknown";
  if (latin && !cyrillic) return "en";
  if (cyrillic && !latin) {
    if (hasUk && !hasRu) return "uk";
    if (hasRu && !hasUk) return "ru";
    return "cyrillic";
  }

  if (latin > cyrillic * 1.2) return "en";
  if (cyrillic > latin * 1.2) {
    if (hasUk && !hasRu) return "uk";
    if (hasRu && !hasUk) return "ru";
    return "cyrillic";
  }

  return "unknown";
}

function isLocaleMismatch(locale: Locale, text: string) {
  const detected = detectLocaleFromText(text);
  if (detected === "unknown") return false;
  if (locale === "en") return detected !== "en";
  if (locale === "ru") return detected === "en" || detected === "uk";
  if (locale === "uk") return detected === "en" || detected === "ru";
  return false;
}

export const __testing = {
  isExplicitQuestion,
  looksIrrelevant,
  isSmokeTestMessage,
};

type ProviderChatResponse = z.infer<typeof ProviderChatResponseSchema>;

const ChatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type ChatHistoryItem = z.infer<typeof ChatHistoryItemSchema>;

function buildSystemPrompt(opts: {
  project: ProjectRecord;
  locale: Locale;
  context?: any;
  knowledgeExcerpts?: string;
  strictLanguage?: boolean;
}) {
  const { project, locale, context, knowledgeExcerpts, strictLanguage } = opts;

  const languageHint =
    locale === "en"
      ? "Respond strictly in English (locale: en)."
      : locale === "uk"
        ? "Відповідай строго українською (locale: uk)."
        : "Отвечай строго по-русски (locale: ru).";

  const languageStrict =
    strictLanguage &&
    (locale === "en"
      ? "Answer ONLY in English. Do not switch languages."
      : locale === "uk"
        ? "Відповідай лише українською мовою. Не перемикай мову."
        : "Отвечай только по-русски. Не переключай язык.");

  const formatHint = `Return ONLY valid JSON with this shape:
{ "reply": string, "warnings": string[], "safetyLevel": "normal"|"caution"|"urgent", "sources": [] }.
No markdown. No extra keys. Keep sources as an empty array (server attaches citations).`;

  const medicalSafety = `Constraints:
- This is informational only, not medical advice.
- Do NOT diagnose; do NOT prescribe medications/dosages.
- Encourage consulting a doctor for symptoms or uncertainty.
- If there are red-flag symptoms, set safetyLevel="urgent" and include a warning.`;

  const kbBlock = knowledgeExcerpts
    ? `Knowledge base excerpts (use these when relevant):
${knowledgeExcerpts}`
    : "Knowledge base excerpts: (none)";

  const contextBlock = context ? `User context (JSON, may be empty): ${JSON.stringify(context)}` : "";

  return [
    project.systemPrompt,
    languageHint,
    medicalSafety,
    kbBlock,
    `Always include this disclaimer at the end of reply (in the same language): "${DISCLAIMER[locale]}"`,
    contextBlock,
    formatHint,
    languageStrict,
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

function pickKbFallbackAnswer(opts: { excerpts: string; locale: Locale; question: string }) {
  const { excerpts, locale, question } = opts;
  const cleaned = (excerpts || "").trim();
  if (!cleaned) return "";

  // Remove leading [#N] header(s) and keep only the first excerpt body.
  const firstBlock = cleaned.split(/\n\n---\n\n/)[0] ?? cleaned;
  const lines = firstBlock.split("\n");
  const body = lines
    .filter((_, idx) => idx !== 0) // drop header line
    .join("\n")
    .trim();

  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Keep first 1–2 sentences (deterministic, no LLM dependency).
  const parts = text.split(/(?<=[.!?…])\s+/);
  const picked = parts.slice(0, 2).join(" ").trim();
  const short = (picked || parts[0] || text).slice(0, 520).trim();

  // Ensure the answer mentions at least one meaningful token from the question (topic anchoring).
  const qTokens = tokenizeForRelevance(question);
  const lower = short.toLowerCase();
  const anchored = qTokens.some((t) => lower.includes(t) || (t.length >= 5 && lower.includes(t.slice(0, 3))));

  if (anchored) return short;

  // If not anchored, prepend a tiny topic reminder (still deterministic).
  const prefix =
    locale === "en"
      ? "About your question: "
      : locale === "uk"
        ? "Щодо вашого питання: "
        : "По вашему вопросу: ";
  return (prefix + short).slice(0, 560).trim();
}

function normalizeCitations(citations: KnowledgeCitation[]) {
  // Deduplicate by (sourceId + snippet) to keep output stable.
  const seen = new Set<string>();
  const out: KnowledgeCitation[] = [];
  for (const c of citations) {
    const key = `${c.sourceId}:${c.snippet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export async function chatWithAssistant(opts: {
  env: AppEnv;
  project: ProjectRecord;
  message: string;
  locale: Locale;
  context?: any;
  history?: ChatHistoryItem[];
}): Promise<ChatResponse> {
  const { env, project, message, locale, context } = opts;
  const trimmedMessage = String(message || "").trim();
  const disclaimer = DISCLAIMER[locale];

  if (process.env.NODE_ENV !== "production" && isSmokeTestMessage(trimmedMessage)) {
    return {
      reply: ensureDisclaimer(SMOKE_TEST_RESPONSE[locale], disclaimer),
      warnings: [],
      safetyLevel: "normal",
      sources: [],
    };
  }

  if (!hasLetters(trimmedMessage)) {
    return {
      reply: ensureDisclaimer(ASK_QUESTION_PROMPT[locale], disclaimer),
      warnings: [],
      safetyLevel: "normal",
      sources: [],
    };
  }

  const triage = triageMessage(message, locale);

  // PR-02: RAG retrieval prefers vector search when OpenAI is configured.
  let queryEmbedding: number[] | undefined;
  if (env.OPENAI_API_KEY) {
    try {
      const vecs = await openaiEmbeddings({ env, input: [message] });
      queryEmbedding = vecs?.[0];
    } catch {
      // Retrieval will fall back to lexical matching.
      queryEmbedding = undefined;
    }
  }

  const { excerpts, citations, debug } = await retrieveKnowledgeCitations({
    projectId: project.id,
    query: message,
    queryEmbedding,
    limit: 4,
  });

  if (process.env.RAG_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          tag: "rag.debug",
          projectId: project.id,
          projectKey: project.publicKey,
          locale,
          query: message,
          mode: debug.mode,
          queryNormalized: debug.queryNormalized,
          sourcesFound: citations.length,
          chunksFound: debug.matchedChunks,
          totalChunks: debug.totalChunks,
          excerptsLength: excerpts.length,
          topCandidates: debug.candidates,
        },
        null,
        2
      )
    );
  }

  const systemWithKb = buildSystemPrompt({ project, locale, context, knowledgeExcerpts: excerpts });
  const systemNoKb =
    buildSystemPrompt({ project, locale, context, knowledgeExcerpts: "" }) +
    "\n\nIMPORTANT: Answer the user's last question directly. Do not switch topics. If the question asks about a specific item (e.g. smoking, coffee), you must explicitly mention it in the first sentence.";

  // Keep history small; the request schema already caps at 50.
  const history = (opts.history ?? []).slice(-20);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemWithKb },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  // If provider is not configured, fall back to a deterministic KB-based response (keeps demo stable for reviewers).
  if (!env.OPENAI_API_KEY) {
    const fallback = citations.length
      ? pickKbFallbackAnswer({ excerpts, locale, question: message })
      : NO_PROVIDER[locale];

    const reply = ensureDisclaimer(fallback, disclaimer);

    return {
      reply,
      warnings: triage.warnings,
      safetyLevel: triage.level,
      sources: normalizeCitations(citations).map((c) => ({
        sourceId: c.sourceId,
        title: c.title,
        snippet: c.snippet,
        url: c.url ?? null,
      })),
    };
  }

  const raw = await openaiChatJson({ env, messages });

  const parsed = ProviderChatResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Provider returned valid JSON but not our contract. Return a safe generic message.
    const reply = ensureDisclaimer(ERROR_GENERIC[locale], disclaimer);

    return {
      reply,
      warnings: triage.warnings,
      safetyLevel: triage.level,
      sources: normalizeCitations(citations).map((c) => ({
        sourceId: c.sourceId,
        title: c.title,
        snippet: c.snippet,
        url: c.url ?? null,
      })),
    };
  }

  let modelResp: ProviderChatResponse = parsed.data;

  if (isLocaleMismatch(locale, modelResp.reply)) {
    try {
      const strictSystem = buildSystemPrompt({
        project,
        locale,
        context,
        knowledgeExcerpts: excerpts,
        strictLanguage: true,
      });
      const retryMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: strictSystem },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ];
      const raw2 = await openaiChatJson({ env, messages: retryMessages });
      const parsed2 = ProviderChatResponseSchema.safeParse(raw2);
      if (parsed2.success && !isLocaleMismatch(locale, parsed2.data.reply)) {
        modelResp = parsed2.data;
      }
    } catch {
      // keep original response
    }
  }

  // PR-07: Guard against occasional off-topic model replies (especially with OpenAI-compatible local providers).
  // If the answer doesn't mention any meaningful token from the question, retry once with a stricter instruction.
  if (looksIrrelevant(message, modelResp.reply)) {
    try {
      // Retry WITHOUT KB excerpts and WITHOUT the previous off-topic answer.
      const retryMessages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: systemNoKb },
        { role: "user", content: message },
      ];

      const raw2 = await openaiChatJson({ env, messages: retryMessages });
      const parsed2 = ProviderChatResponseSchema.safeParse(raw2);
      if (parsed2.success && !looksIrrelevant(message, parsed2.data.reply)) {
        modelResp = parsed2.data;
      }
    } catch {
      // keep the first response
    }
  }

  // If even after retry the answer is still off-topic, fail safely.
  // Returning a wrong-topic answer is worse than asking the user to rephrase.
  if (looksIrrelevant(message, modelResp.reply)) {
    // Prefer KB-based deterministic answer if we have relevant excerpts.
    const kbFallback = citations.length ? pickKbFallbackAnswer({ excerpts, locale, question: message }) : "";

    const fallback = kbFallback ? kbFallback : REPHRASE_PROMPT[locale];

    modelResp = {
      reply: fallback,
      warnings: [],
      safetyLevel: "normal",
      sources: [],
    } as ProviderChatResponse;
  }

  // If provider answered "generic" (e.g., only "consult a doctor") while we do have KB citations,
  // override with a deterministic KB excerpt answer. This makes the demo stable even if the model drifts.
  if (citations.length && looksIrrelevant(message, modelResp.reply)) {
    const kb = pickKbFallbackAnswer({ excerpts, locale, question: message });
    if (kb) {
      modelResp = {
        ...modelResp,
        reply: kb,
      };
    }
  }

  const safetyLevel: SafetyLevel = maxSafety(modelResp.safetyLevel ?? "normal", triage.level);
  const warnings = Array.from(new Set([...(triage.warnings ?? []), ...((modelResp.warnings as any) ?? [])]));

  return {
    reply: ensureDisclaimer(modelResp.reply, disclaimer),
    warnings,
    safetyLevel,
    sources: normalizeCitations(citations).map((c) => ({
      sourceId: c.sourceId,
      title: c.title,
      snippet: c.snippet,
      url: c.url ?? null,
    })),
  };
}
