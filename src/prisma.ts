import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function prismaHealthcheck(): Promise<void> {
  // A lightweight query to verify DB connectivity.
  await prisma.project.count();
}
