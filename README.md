# Leleka AI Assistant Service

Reusable AI assistant backend service (Node.js + Express + TypeScript + Prisma + PostgreSQL) designed to be embedded into other products (first target: Leleka).

Important: this service provides **informational-only** answers and must always be positioned as **not a substitute for a doctor**.

## Requirements
- Node.js 18+
- PostgreSQL

## Quick start

1) Install dependencies

```bash
npm i
```

2) Create `.env` from `.env.example` and set DB URLs

- `DATABASE_URL` — main DB for the service
- `SHADOW_DATABASE_URL` — a separate DB used by Prisma Migrate in dev (so the DB user does NOT need CREATEDB)

Note: `.env.example` contains placeholders (`USER:PASSWORD`). Do not commit real passwords into the repo. Real secrets live only in `.env` (which is gitignored) and in Render env vars.

3) Generate Prisma client + run migrations

```bash
npx prisma generate
npx prisma migrate dev
```

4) Seed default project

```bash
npm run prisma:seed
```

5) Run dev server

```bash
npm run dev
```

Health:

```bash
curl -s http://localhost:4001/v1/health
```

## Auth / Multi-tenant
All project-scoped endpoints require `X-Project-Key` (Project.publicKey).

Example:

```bash
curl -i -X POST http://localhost:4001/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: leleka-dev" \
  -d '{"message":"Можно ли кофе при беременности?","locale":"ru"}'
```

## PR5: Knowledge Base (text-only)
To make answers less “общими” and to fill `sources[]`, you can add internal knowledge documents (text) and the service will auto-chunk them.

### Add a KB source

```bash
curl -i -X POST http://localhost:4001/v1/kb/sources \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: leleka-dev" \
  -d '{"title":"Питание при беременности: рыба/суши","url":null,"text":"...ваш текст..."}'
```

### List KB sources

```bash
curl -s http://localhost:4001/v1/kb/sources \
  -H "X-Project-Key: leleka-dev"
```

### Delete KB source

```bash
curl -i -X DELETE http://localhost:4001/v1/kb/sources/<SOURCE_ID> \
  -H "X-Project-Key: leleka-dev"
```

## OpenAPI
Swagger spec is in `docs/openapi.yaml`.

## Notes
- If `OPENAI_API_KEY` is not set, the server returns a deterministic stub reply (for reviewer-friendly local runs).
- Seed (`npm run prisma:seed`) intentionally **overwrites** default project settings (systemPrompt + disclaimerTemplate), so environments stay consistent.
