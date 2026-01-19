import type { Request, Response } from "express";
import { prismaHealthcheck } from "../prisma";

export async function healthController(_req: Request, res: Response) {
  const startedAt = (global as any).__APP_STARTED_AT__ as number | undefined;
  const now = Date.now();
  const uptimeSec = startedAt ? Math.floor((now - startedAt) / 1000) : undefined;

  // Verify DB connection + schema readiness.
  // IMPORTANT: Do not crash the process if the DB is not migrated yet.
  // Render uses this endpoint for health checks; we should respond deterministically.
  const db = await prismaHealthcheck();

  if (!db.ok) {
    // Typical first-deploy case: migrations have not been applied yet (P2021).
    // Return 200 so the service stays up and you can run `prisma migrate deploy` in Render Shell.
    return res.json({
      status: "degraded",
      dbReady: false,
      dbErrorCode: db.code,
      uptimeSec,
      ts: new Date().toISOString(),
    });
  }

  return res.json({
    status: "ok",
    dbReady: true,
    uptimeSec,
    ts: new Date().toISOString(),
  });
}
