import type { Request, Response } from "express";
import { prismaHealthcheck } from "../prisma";

export async function healthController(_req: Request, res: Response) {
  const startedAt = (global as any).__APP_STARTED_AT__ as number | undefined;
  const now = Date.now();
  const uptimeSec = startedAt ? Math.floor((now - startedAt) / 1000) : undefined;

  // Verify DB connection.
  await prismaHealthcheck();

  res.json({
    status: "ok",
    uptimeSec,
    ts: new Date().toISOString(),
  });
}
