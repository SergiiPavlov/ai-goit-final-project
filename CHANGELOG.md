# Changelog

## 0.7.0 (PR8) — Locale enforcement, widget i18n, and voice language
- Normalized locale handling across API + public config, with safe fallbacks and localized disclaimers/prompts.
- Added strict language enforcement for LLM replies with retry on mismatch and safer smoke-test/empty-input handling.
- Localized widget UI (RU/UK/EN) with language selector, persisted choice, and locale-aware voice ASR/TTS.
- KB fallback excerpts now use bounded snippets instead of full source text.
- Added assistant self-check script for short greetings/smoke inputs.

## 0.6.0 (PR2) — pgvector RAG (embeddings + vector search)
- Added pgvector extension migration and KnowledgeChunk.embedding (vector(1536)).
- /v1/chat now prefers vector search for KB retrieval when OpenAI is configured (fallback to lexical matching).
- Added script: npm run kb:backfill-embeddings (fills embeddings for existing KB chunks).
- Added env: OPENAI_EMBEDDING_MODEL (default: text-embedding-3-small).

## 0.5.0 (PR5) — Text-only Knowledge Base (KB)
- Added text-only Knowledge Base tables (KnowledgeSource/KnowledgeChunk) in Prisma.
- Added project-scoped KB endpoints:
  - GET /v1/kb/sources
  - POST /v1/kb/sources
  - DELETE /v1/kb/sources/:id
- /v1/chat now pulls relevant KB excerpts and returns deterministic citations in sources[].
- Seed updated to always refresh default systemPrompt and disclaimerTemplate.
- OpenAPI updated.

## 0.4.0 (PR4) — Multi-tenant project keys + per-project CORS
- Added Project model and X-Project-Key auth.
- Added per-project allowedOrigins enforcement.
- Added /v1/projects/{key}/public-config endpoint.
- Added prisma seed to create default project.

## 0.3.0 (PR3) — Minimal API surface
- Added /v1/chat placeholder.
- Added health/version endpoints.
