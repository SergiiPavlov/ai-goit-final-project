import type { Request, Response } from "express";

export async function publicConfigController(req: Request, res: Response) {
  // PR-02: placeholder. PR-03 will read Project by :key and return config.
  return res.status(501).json({
    error: {
      code: "NOT_IMPLEMENTED",
      message: `Public config is not implemented yet for project key: ${req.params.key}`,
      requestId: req.requestId,
    },
  });
}
