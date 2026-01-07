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

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
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
  const raw = q
    .toLowerCase()
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
  ]);

  return raw.filter((t) => t.length >= 3 && !stop.has(t));
}

function scoreChunk(content: string, tokens: string[]) {
  if (!tokens.length) return 0;
  const c = content.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    // count occurrences (cheap heuristic)
    let idx = 0;
    while (true) {
      idx = c.indexOf(t, idx);
      if (idx === -1) break;
      score += 1;
      idx += t.length;
      // avoid pathological loops
      if (score > 200) break;
    }
  }
  return score;
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
  limit?: number;
}): Promise<{ excerpts: string; citations: KnowledgeCitation[] }> {
  const { projectId, query } = opts;
  const limit = Math.max(1, Math.min(8, opts.limit ?? 4));

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
    .map((c) => ({ c, score: scoreChunk(c.content, tokens) }))
    .filter((x) => x.score > 0)
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
