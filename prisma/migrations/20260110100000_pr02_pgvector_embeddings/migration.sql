-- PR-02: pgvector + embeddings column for KnowledgeChunk
--
-- Notes:
-- - Render Postgres typically allows CREATE EXTENSION.
-- - Embedding dim defaults to 1536 for text-embedding-3-small.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Optional ANN index (safe even for small datasets; can be dropped later)
-- If your Postgres/pgvector version does not support ivfflat, comment this out.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_ivfflat_idx"
  ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 50);
