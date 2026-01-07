# Leleka AI Assistant Service

This repository hosts a reusable AI Assistant backend (API-first) intended to be integrated into multiple projects (first: **Leleka**).

## PR-02 scope (Bootstrap server)
- Node.js + TypeScript
- Express app with middleware: `helmet`, `cors`, `morgan`, `requestId`, centralized error handler
- Env validation via `zod`
- Prisma wired (PostgreSQL) + generated client
- Live endpoints:
  - `GET /v1/health`
  - `GET /v1/version`
- Placeholder endpoints (not implemented yet):
  - `POST /v1/chat`
  - `GET /v1/projects/:key/public-config`

## Requirements
- Node >= 18.17
- PostgreSQL (for Prisma client / migrations)

## Setup
```bash
npm i
cp .env.example .env
npm run prisma:generate
npm run dev
```

## Smoke (local)
```bash
curl -s http://localhost:4001/v1/health
curl -s http://localhost:4001/v1/version
```

## Notes
- OpenAPI contract: `docs/openapi.yaml`
- Safety/triage policy: `docs/policy.md`
