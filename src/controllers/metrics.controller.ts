import type { Request, Response } from "express";
import { getMetricsSnapshot, type MetricsStore } from "../middlewares/metrics";

/**
 * PR-07: lightweight observability endpoint for demo/mentors.
 * NOTE: In-memory only (per process). Good enough for MVP and local/Render demo.
 */
export function metricsController(req: Request, res: Response) {
  const store = req.app.locals.metrics as MetricsStore | undefined;
  if (!store) {
    return res.status(503).json({
      error: {
        code: "METRICS_NOT_AVAILABLE",
        message: "Metrics store is not initialized",
        requestId: req.requestId,
      },
    });
  }

  return res.json(getMetricsSnapshot(store));
}
