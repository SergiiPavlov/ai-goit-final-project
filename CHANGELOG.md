# Changelog

## [0.4.0] - 2026-01-07
- PR-04: Реализован `/v1/chat` (OpenAI JSON-mode) с safety-триажем, пер-проектным системным промптом и обязательным дисклеймером.
- Добавлены env-параметры OpenAI (MODEL/BASE_URL/TIMEOUT/TEMPERATURE).

## [0.3.0] - 2026-01-07
- PR-03: Multi-tenant enforcement (X-Project-Key), public project config endpoint, origin allowlist checks, simple rate limit, Prisma shadow DB support, seed script.

## [0.2.0] - 2026-01-07
- PR-02: Bootstrap Express+TS service, env validation, middleware, health/version endpoints, Prisma wiring.

## [0.1.0] - 2026-01-07
- PR-01: OpenAPI contract + safety policy.
