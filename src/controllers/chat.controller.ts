import type { Request, Response } from "express";
import { z } from "zod";
import type { AppEnv } from "../config/env";
import { chatWithAssistant } from "../services/ai/assistant";

const ChatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  locale: z.enum(["ru", "uk", "en"]).optional(),
  context: z.record(z.any()).optional(),
  history: z.array(ChatHistoryItemSchema).max(50).optional(),
});

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

  const parsed = ChatRequestSchema.safeParse(req.body);
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

  const locale = parsed.data.locale ?? (project.localeDefault as any) ?? "ru";

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
