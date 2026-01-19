import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type PrismaHealth =
  | { ok: true }
  | { ok: false; code?: string; message: string };

export async function prismaHealthcheck(): Promise<PrismaHealth> {
  try {
    // A lightweight query to verify DB connectivity and schema readiness.
    await prisma.project.count();
    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      code: typeof e?.code === "string" ? e.code : undefined,
      message: e?.message ? String(e.message) : "Unknown prisma error",
    };
  }
}
