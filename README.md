# AI Assistant Service (Leleka) — PR-01: Spec & API Contract

This repository will host a reusable AI Assistant Service that can be integrated into multiple products.
First target integration: **Leleka**.

## Scope of PR-01
This PR only fixes the **public contract** (API surface + response format + safety constraints):
- OpenAPI spec: `docs/openapi.yaml`
- Safety policy (non-medical, triage / red flags): `docs/policy.md`
- Local smoke examples via `curl` (below)

Implementation (server, DB, RAG) starts from PR-02 onward.

## High-level decisions
- **API-first**: clients call this service via HTTP.
- **Multi-tenant**: every request must include `X-Project-Key` (public key of a project).
- **Security**:
  - CORS must be restricted to `Project.allowedOrigins`.
  - Rate limits per `projectKey + IP`.
- **Safety**: informational assistance only. No diagnosis, prescriptions, dosages. Red flags => escalate to doctor/ER.

## Endpoints
- `POST /v1/chat` — main chat endpoint
- `GET /v1/projects/{key}/public-config` — public widget/client config
- `GET /v1/health` — liveness
- `GET /v1/version` — build/version info

## Response contract (stable)
`POST /v1/chat` must return JSON:
```json
{
  "reply": "string",
  "warnings": ["string"],
  "safetyLevel": "normal|caution|urgent",
  "sources": [
    { "sourceId": "string", "title": "string", "snippet": "string", "url": "string" }
  ]
}
```
Notes:
- `sources` MAY be empty in non-RAG mode.
- `warnings` MUST include a disclaimer at least once per conversation (client may also show it).

## curl examples
> Replace:
> - `BASE` with your deployed URL
> - `X-Project-Key` with a real project key

```bash
BASE="http://localhost:8080"
PROJECT_KEY="pk_example"

curl -sS "$BASE/v1/health"
curl -sS "$BASE/v1/version"

curl -sS -X POST "$BASE/v1/chat" \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: $PROJECT_KEY" \
  -d '{
    "message": "Какие продукты обычно рекомендуют ограничивать при беременности?",
    "locale": "ru",
    "context": {"week": 12}
  }' | jq

curl -sS -X POST "$BASE/v1/chat" \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: $PROJECT_KEY" \
  -d '{
    "message": "У меня сильная боль и кровотечение",
    "locale": "ru"
  }' | jq
```

## Acceptance criteria (for mentors / reviewers)
- OpenAPI describes all endpoints and schemas used above.
- `POST /v1/chat` response is strict and stable.
- Safety rules are documented (red flags + escalation).
- No hidden coupling to Leleka-specific backend at this stage.

## Next PRs (planned)
- PR-02: server bootstrap (TS + framework + middleware + render-ready)
- PR-03: Projects + CORS allowlist + rate limit
- PR-04: LLM integration + output validation + triage
- PR-05+: RAG (kb sources, chunks, pgvector)
