import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export type KnowledgeSourceRecord = {
  id: string;
  projectId: string;
  title: string;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
  chunksCount: number;
};

export type KnowledgeCitation = {
  sourceId: string;
  title: string;
  snippet: string;
  url: string | null;
};

type ChunkWithSource = {
  id: string;
  content: string;
  sourceId: string;
  source: { id: string; title: string; url: string | null };
};

function normalizeText(s?: string) {
  // Defensive: ingestion scripts should never crash on empty/undefined inputs.
  const safe = (s ?? "").toString();
  return safe.replace(/\s+/g, " ").trim();
}

function chunkText(text: string, opts?: { maxLen?: number; overlap?: number }) {
  const maxLen = Math.max(200, opts?.maxLen ?? 1200);
  const overlap = Math.max(0, Math.min(maxLen - 50, opts?.overlap ?? 120));

  const cleaned = normalizeText(text);
  if (!cleaned) return [] as string[];

  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(cleaned.length, i + maxLen);
    const chunk = cleaned.slice(i, end).trim();
    if (chunk) out.push(chunk);
    if (end >= cleaned.length) break;
    i = Math.max(0, end - overlap);
  }
  return out;
}

function tokenizeQuery(q: string) {
  // Normalize quotes and "ё" to improve stable matching across UI inputs.
  const raw = q
    .replace(/[«»“”„]/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);

  const stop = new Set([
    // RU/UK
    "и",
    "в",
    "во",
    "на",
    "не",
    "что",
    "это",
    "как",
    "ли",
    "я",
    "мы",
    "вы",
    "он",
    "она",
    "они",
    "то",
    "а",
    "но",
    "или",
    "при",
    "можно",
    "нужно",
    "нормально",
    // EN
    "the",
    "a",
    "an",
    "and",
    "or",
    "is",
    "are",
    "to",
    "in",
    "on",
    "for",
    "with",
    "can",
    "should",
    // Pregnancy-related generic words (too frequent in KB; they drown out the real intent terms like "кофе/пиво/курить").
    "беременность",
    "беременности",
    "беременная",
    "беременной",
    "беременную",
    "беременным",
    "беременных",
    "вагітність",
    "вагітності",
    "вагітна",
    "вагітної",
    "вагітну",
    "вагітним",
    "вагітних",
    "триместр",
    "неделя",
    "недели",
    "недель",
    "срок",
    "сроке",
    "сроки",
  ]);

  return raw.filter((t) => t.length >= 3 && !stop.has(t));
}

function scoreChunk(content: string, tokens: string[]) {
  if (!tokens.length) return { score: 0, matchedTokens: 0 };
  const c = content.toLowerCase();
  let score = 0;
  let matchedTokens = 0;

  for (const t of tokens) {
    // Count occurrences (cheap heuristic). We also track how many distinct tokens matched at least once.
    let idx = 0;
    let matchedThisToken = false;
    while (true) {
      idx = c.indexOf(t, idx);
      if (idx === -1) break;
      score += 1;
      matchedThisToken = true;
      idx += t.length;
      // Avoid pathological loops.
      if (score > 200) break;
    }
    if (matchedThisToken) matchedTokens += 1;
  }

  return { score, matchedTokens };
}

function buildSnippet(content: string, query: string) {
  const max = 240;
  const c = normalizeText(content);
  if (c.length <= max) return c;

  const qTokens = tokenizeQuery(query);
  const lower = c.toLowerCase();
  let bestPos = -1;
  for (const t of qTokens) {
    const p = lower.indexOf(t);
    if (p !== -1) {
      bestPos = p;
      break;
    }
  }

  const start = bestPos === -1 ? 0 : Math.max(0, bestPos - 40);
  const slice = c.slice(start, start + max);
  return (start > 0 ? "…" : "") + slice.trim() + (start + max < c.length ? "…" : "");
}

function toPgVectorLiteral(v: number[]) {
  // pgvector accepts a text literal: '[0.1,0.2,...]'
  // Keep a reasonable precision; embeddings are float32-like.
  const nums = v.map((n) => {
    if (!Number.isFinite(n)) return "0";
    return Number(n).toFixed(6);
  });
  return `[${nums.join(",")}]`;
}

export async function listKnowledgeSources(projectId: string): Promise<KnowledgeSourceRecord[]> {
  const sources = await prisma.knowledgeSource.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      projectId: true,
      title: true,
      url: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { chunks: true } },
    },
  });

  return sources.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    title: s.title,
    url: s.url,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    chunksCount: s._count.chunks,
  }));
}

export async function createKnowledgeSource(opts: {
  projectId: string;
  title: string;
  url?: string | null;
  text: string;
}): Promise<KnowledgeSourceRecord> {
  const { projectId, title, url, text } = opts;

  const chunks = chunkText(text);
  if (!chunks.length) {
    throw new Error("KB_TEXT_EMPTY");
  }

  const created = await prisma.$transaction(async (tx) => {
    const source = await tx.knowledgeSource.create({
      data: {
        projectId,
        title: title.trim(),
        url: url ? url.trim() : null,
        text,
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        url: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.knowledgeChunk.createMany({
      data: chunks.map((content, idx) => ({
        projectId,
        sourceId: source.id,
        ord: idx,
        content,
      })),
    });

    const count = chunks.length;

    return {
      id: source.id,
      projectId: source.projectId,
      title: source.title,
      url: source.url,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      chunksCount: count,
    };
  });

  return created;
}

export async function deleteKnowledgeSource(opts: {
  projectId: string;
  sourceId: string;
}): Promise<void> {
  const { projectId, sourceId } = opts;

  const found = await prisma.knowledgeSource.findFirst({
    where: { id: sourceId, projectId },
    select: { id: true },
  });
  if (!found) return;

  await prisma.knowledgeSource.delete({
    where: { id: sourceId },
  });
}

export async function retrieveKnowledgeCitations(opts: {
  projectId: string;
  query: string;
  queryEmbedding?: number[];
  limit?: number;
}): Promise<{ excerpts: string; citations: KnowledgeCitation[] }> {
  const { projectId, query } = opts;
  const limit = Math.max(1, Math.min(8, opts.limit ?? 4));

  // PR-02: vector search path (requires pgvector extension and embeddings backfilled)
  if (opts.queryEmbedding && opts.queryEmbedding.length) {
    try {
      const vec = toPgVectorLiteral(opts.queryEmbedding);
      const maxDistanceRaw = Number(process.env.KB_VECTOR_MAX_DISTANCE ?? "0.45");
      const maxDistance = Number.isFinite(maxDistanceRaw)
        ? Math.max(0.1, Math.min(1, maxDistanceRaw))
        : 0.45;
      const rows = (await prisma.$queryRaw(
        Prisma.sql`
          SELECT
            c."content" as "content",
            s."id" as "sourceId",
            s."title" as "title",
            s."url" as "url",
            (c."embedding" <=> ${vec}::vector) as "distance"
          FROM "KnowledgeChunk" c
          JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
          WHERE c."projectId" = ${projectId}
            AND c."embedding" IS NOT NULL
          ORDER BY "distance" ASC
          LIMIT ${limit}
        `
      )) as Array<{
        content: string;
        sourceId: string;
        title: string;
        url: string | null;
        distance: number;
      }>;

      if (rows?.length) {
        // If the best match is still too far, don't attach irrelevant sources.
        if (!Number.isFinite(rows[0].distance) || rows[0].distance > maxDistance) {
          throw new Error("Vector distance above threshold");
        }
        const citations: KnowledgeCitation[] = rows.map((r) => ({
          sourceId: r.sourceId,
          title: r.title,
          url: r.url,
          snippet: buildSnippet(r.content, query),
        }));

        const excerpts = rows
          .map((r, idx) => {
            const head = `[#${idx + 1}] ${r.title}${r.url ? ` (${r.url})` : ""}`;
            return `${head}\n${r.content}`;
          })
          .join("\n\n---\n\n");

        return { excerpts, citations };
      }
    } catch {
      // Fall through to lexical retrieval.
    }
  }

  const tokens = tokenizeQuery(query);
  if (!tokens.length) {
    return { excerpts: "", citations: [] };
  }

  // For a small educational project: load up to N chunks and score in memory.
  // (Later can be replaced with embeddings + vector search.)
  const all = await prisma.knowledgeChunk.findMany({
    where: { projectId },
    take: 600,
    select: {
      id: true,
      content: true,
      sourceId: true,
      source: { select: { id: true, title: true, url: true } },
    },
  });

  if (!all.length) {
    return { excerpts: "", citations: [] };
  }

  const scored = all
    .map((c) => {
      const byContent = scoreChunk(c.content, tokens);
      const byTitle = scoreChunk(c.source.title, tokens);
      return {
        c,
        score: byContent.score + byTitle.score,
        matchedTokens: byContent.matchedTokens + byTitle.matchedTokens,
      };
    })
    // guard: do not return "default" sources when there is no real lexical overlap
    .filter((x) => x.matchedTokens > 0 && x.score >= 2)
    .sort((a, b) => b.score - a.score);

  const picked: ChunkWithSource[] = [];
  const seenSource = new Set<string>();
  for (const s of scored) {
    if (picked.length >= limit) break;
    // Prefer variety of sources first
    if (seenSource.has(s.c.sourceId) && picked.length < Math.min(2, limit)) {
      continue;
    }
    picked.push(s.c);
    seenSource.add(s.c.sourceId);
  }

  // If still empty (e.g., filtering removed all), try top scored chunks.
  if (!picked.length && scored.length) {
    picked.push(...scored.slice(0, limit).map((x) => x.c));
  }

  const citations: KnowledgeCitation[] = picked.map((p) => ({
    sourceId: p.source.id,
    title: p.source.title,
    url: p.source.url,
    snippet: buildSnippet(p.content, query),
  }));

  const excerpts = picked
    .map((p, idx) => {
      const head = `[#${idx + 1}] ${p.source.title}${p.source.url ? ` (${p.source.url})` : ""}`;
      return `${head}\n${p.content}`;
    })
    .join("\n\n---\n\n");

  return { excerpts, citations };
}
