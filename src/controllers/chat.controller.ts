import type { Request, Response } from "express";
import { z } from "zod";
import iconv from "iconv-lite";
import type { AppEnv } from "../config/env";
import { chatWithAssistant } from "../services/ai/assistant";
import { normalizeLocale } from "../utils/locale";

const ChatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  locale: z.string().optional(),
  context: z.record(z.any()).optional(),
  history: z.array(ChatHistoryItemSchema).max(50).optional(),
});


function hasLetters(s: string) {
  try {
    return /\p{L}/u.test(s);
  } catch {
    // Fallback for runtimes without Unicode property escapes (should not happen on Node 18+).
    return /[A-Za-zА-Яа-яЁёІіЇїЄє]/.test(s);
  }
}

function looksGarbledMessage(s: string) {
  if (!s) return true;
  // If there are no letters at all, it's almost certainly an encoding issue (e.g., "?????").
  if (!hasLetters(s)) return true;
  // Heuristic: too many question marks compared to length.
  const q = (s.match(/\?/g) ?? []).length;
  return s.length >= 10 && q / s.length > 0.2;
}

function tryRecoverBodyFromRaw(raw: Buffer): any | null {
  // Attempt decodes commonly seen in Windows terminals when UTF-8 is not configured.
  const encodings: Array<BufferEncoding | string> = ["utf8", "win1251", "cp866"];
  for (const enc of encodings) {
    try {
      const text = iconv.decode(raw, enc as any);
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object") return obj;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function chatController(req: Request, res: Response) {
  const project = req.project;
  if (!project) {
    return res.status(401).json({
      error: {
        code: "PROJECT_KEY_REQUIRED",
        message: "Missing or invalid X-Project-Key",
        requestId: req.requestId,
      },
    });
  }

    // Workaround: On some Windows terminals, non-UTF8 input may reach us as "????".
  // If the parsed JSON looks garbled, try to recover from raw bytes.
  let body: any = req.body;
  const msg = typeof body?.message === "string" ? body.message : "";
  if (req.rawBody && typeof msg === "string" && looksGarbledMessage(msg)) {
    const recovered = tryRecoverBodyFromRaw(req.rawBody);
    if (recovered && typeof recovered.message === "string" && hasLetters(recovered.message)) {
      body = recovered;
    }
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        issues: parsed.error.issues,
        requestId: req.requestId,
      },
    });
  }

  const env = req.app.locals.env as AppEnv;

  const locale = normalizeLocale(parsed.data.locale, project.localeDefault);

  const result = await chatWithAssistant({
    env,
    project,
    message: parsed.data.message,
    locale,
    context: parsed.data.context,
    history: parsed.data.history,
  });

  return res.json(result);
}
