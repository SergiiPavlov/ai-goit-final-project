import type { Request, Response } from "express";
import { normalizeLocale } from "../utils/locale";
import { resolveProjectDisclaimer } from "../utils/disclaimer";

export async function publicConfigController(req: Request, res: Response) {
  const project = req.project;
  // Project existence is enforced by middleware; keep a defensive guard.
  if (!project) {
    return res.status(404).json({
      error: {
        code: "PROJECT_NOT_FOUND",
        message: `Project not found for key: ${req.params.key}`,
        requestId: req.requestId,
      },
    });
  }

  // PR-03: public config used by widget/client to render UI and know limits.
  const locale = normalizeLocale(req.query.locale?.toString(), project.localeDefault);

  return res.json({
    projectKey: project.publicKey,
    localeDefault: normalizeLocale(project.localeDefault),
    disclaimer: resolveProjectDisclaimer(project, locale),
    locale,
    limits: {
      maxMessageChars: 8000,
      maxHistoryItems: 50,
    },
  });
}
