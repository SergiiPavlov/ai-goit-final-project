import type { Request, Response } from "express";
import { z } from "zod";

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  locale: z.string().optional(),
  context: z.record(z.any()).optional(),
  history: z.array(z.any()).optional(),
});

export async function chatController(req: Request, res: Response) {
  // PR-02: placeholder implementation.
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

  return res.status(501).json({
    reply: "Not implemented yet (PR-02). Implemented in PR-04/PR-05.",
    warnings: ["This is a placeholder endpoint."],
    safetyLevel: "unknown",
    sources: [],
  });
}
