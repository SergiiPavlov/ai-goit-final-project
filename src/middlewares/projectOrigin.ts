import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./errorHandler";

export function enforceProjectOrigin(opts: { nodeEnv: string }) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const origin = req.header("origin");
    if (!origin) return next(); // server-to-server / curl

    const project = req.project;
    if (!project) return next(); // not a project-scoped endpoint

    const allowlist = project.allowedOrigins ?? [];
    if (allowlist.length === 0) {
      if (opts.nodeEnv === "development") return next();
      return next(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"));
    }

    if (allowlist.includes(origin)) return next();
    return next(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"));
  };
}
