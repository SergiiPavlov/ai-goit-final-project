# Changelog

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
