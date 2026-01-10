import { Prisma } from "@prisma/client";
import { loadEnv } from "../config/env";
import { prisma } from "../prisma";
import { openaiEmbeddings } from "../services/ai/openai";

function toPgVectorLiteral(v: number[]): string {
  const nums = v.map((n) => {
    if (!Number.isFinite(n)) return "0";
    return Number(n).toFixed(6);
  });
  return `[${nums.join(",")}]`;
}

async function main() {
  const env = loadEnv();

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to backfill embeddings");
  }

  const batchSize = Math.max(1, Math.min(128, Number(process.env.EMBED_BATCH ?? 32)));
  let total = 0;

  // Backfill in small batches to avoid timeouts / rate limits.
  for (;;) {
    const rows = (await prisma.$queryRaw(
      Prisma.sql`
        SELECT "id", "content"
        FROM "KnowledgeChunk"
        WHERE "embedding" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
      `
    )) as Array<{ id: string; content: string }>;

    if (!rows.length) break;

    const vectors = await openaiEmbeddings({ env, input: rows.map((r) => r.content) });

    for (let i = 0; i < rows.length; i++) {
      const id = rows[i].id;
      const vec = toPgVectorLiteral(vectors[i]);

      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "KnowledgeChunk"
          SET "embedding" = ${vec}::vector
          WHERE "id" = ${id}
        `
      );

      total += 1;
      if (total % 50 === 0) {
        // eslint-disable-next-line no-console
        console.log(`[kb] backfilled embeddings: ${total}`);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[kb] done. total backfilled: ${total}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[kb] backfill failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
