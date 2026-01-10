import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./errorHandler";

export function enforceProjectOrigin(opts: { nodeEnv: string }) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const origin = req.header("origin");
    if (!origin) return next(); // server-to-server / curl

    // Allow same-origin browser requests for built-in UI (e.g. /demo) even when
    // the project uses a strict allowlist. Without this, opening
    // http://localhost:4001/demo/ would fail with 403 unless localhost:4001 was
    // manually added to allowedOrigins.
    const forwardedProto = (req.header("x-forwarded-proto") || "").split(",")[0].trim();
    const proto = forwardedProto || req.protocol;
    const host = req.header("host");
    const selfOrigin = host ? `${proto}://${host}` : "";
    if (selfOrigin && origin === selfOrigin) return next();

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
