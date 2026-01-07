import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./errorHandler";

type Bucket = { count: number; resetAt: number };

const BUCKETS = new Map<string, Bucket>();

function keyFor(req: Request): string {
  const projectKey = req.projectKey ?? "-";
  const ip = (req.ip || req.connection?.remoteAddress || "unknown") as string;
  return `${projectKey}:${ip}`;
}

export function rateLimit(opts: { windowSec: number; max: number }) {
  const windowMs = Math.max(1, opts.windowSec) * 1000;
  const max = Math.max(1, opts.max);

  return function (req: Request, _res: Response, next: NextFunction) {
    const k = keyFor(req);
    const now = Date.now();

    const bucket = BUCKETS.get(k);
    if (!bucket || bucket.resetAt <= now) {
      BUCKETS.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      return next(
        new HttpError(429, "RATE_LIMIT", `Too many requests (max ${max} per ${opts.windowSec}s)`)
      );
    }
    return next();
  };
}
