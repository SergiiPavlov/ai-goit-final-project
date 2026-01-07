import type { Request, Response } from "express";
import { z } from "zod";
import {
  createKnowledgeSource,
  deleteKnowledgeSource,
  listKnowledgeSources,
} from "../services/kb.service";

const CreateSourceSchema = z.object({
  title: z.string().min(1).max(160),
  url: z.string().url().optional(),
  text: z.string().min(1).max(200_000),
});

export async function listKbSourcesController(req: Request, res: Response) {
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

  const items = await listKnowledgeSources(project.id);
  return res.json({ items });
}

export async function createKbSourceController(req: Request, res: Response) {
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

  const parsed = CreateSourceSchema.safeParse(req.body);
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

  try {
    const created = await createKnowledgeSource({
      projectId: project.id,
      title: parsed.data.title,
      url: parsed.data.url,
      text: parsed.data.text,
    });

    return res.status(201).json({ source: created });
  } catch (e: any) {
    const code = String(e?.message ?? "KB_CREATE_FAILED");
    return res.status(400).json({
      error: {
        code,
        message: code === "KB_TEXT_EMPTY" ? "Text is empty" : "Could not create knowledge source",
        requestId: req.requestId,
      },
    });
  }
}

export async function deleteKbSourceController(req: Request, res: Response) {
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

  const sourceId = String((req.params as any).id ?? "").trim();
  if (!sourceId) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Missing :id path parameter",
        requestId: req.requestId,
      },
    });
  }

  await deleteKnowledgeSource({ projectId: project.id, sourceId });
  return res.status(204).send();
}
