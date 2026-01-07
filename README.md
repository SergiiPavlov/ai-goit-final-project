# Leleka AI Assistant Service

Переиспользуемый backend‑сервис «ИИ‑ассистент» (API‑first), который можно подключать к разным проектам. Первый потребитель — **Лелека**.

## PR‑03 scope (Multi‑tenant + Shadow DB)
- Multi‑tenant: все «боевые» ассистент‑эндпоинты работают в контексте проекта.
  - `POST /v1/chat` требует заголовок `X-Project-Key`.
  - `GET /v1/projects/{key}/public-config` возвращает публичный конфиг проекта.
- CORS:
  - пре‑флайт обрабатывается корректно;
  - дополнительно на project‑эндпоинтах проверяется `Origin` по `Project.allowedOrigins` (в `development` пустой allowlist допускается).
- Rate limit: простая in‑memory защита (projectKey + IP), настраивается env‑переменными.
- Prisma Shadow Database: добавлен `SHADOW_DATABASE_URL` (нужно для `prisma migrate dev` без прав `CREATEDB`).

> `POST /v1/chat` реализован (PR‑04): интеграция с OpenAI Chat Completions в режиме JSON.
> Если `OPENAI_API_KEY` не задан, эндпоинт вернёт детерминированный ответ (для стабильного демо у проверяющих).

## Требования
- Node.js >= 18.17
- PostgreSQL (локально или облачный)

## Локальный запуск (Windows, PostgreSQL установлен)
### 1) Создать БД + пользователя
Открой psql под `postgres` (или другим суперпользователем):

```bash
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 5432 -U postgres -d postgres
```

Внутри psql:

```sql
CREATE DATABASE leleka_ai;
CREATE USER leleka_ai_user WITH PASSWORD 'StrongPassword123!';
ALTER DATABASE leleka_ai OWNER TO leleka_ai_user;

-- Shadow DB для Prisma
CREATE DATABASE leleka_ai_shadow OWNER leleka_ai_user;
```

### 2) Настроить env

```bash
cp .env.example .env
```

Заполни `.env` (пример):

```env
DATABASE_URL=postgresql://leleka_ai_user:StrongPassword123!@localhost:5432/leleka_ai
SHADOW_DATABASE_URL=postgresql://leleka_ai_user:StrongPassword123!@localhost:5432/leleka_ai_shadow

# Рекомендуется (prod): ограничить CORS на домены фронта
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

Важно:
- Пароли в `.env.example` оставляем как плейсхолдеры. Реальные значения держим только в `.env` (он не коммитится).

### 3) Миграции и сид

```bash
npm i
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

Сид создаст проект по умолчанию с ключом `leleka-dev` и allowlist `http://localhost:3000,http://localhost:5173`.

### 4) Запуск API

```bash
npm run dev
```

## Smoke (local)

```bash
curl -i http://localhost:4001/v1/health
curl -i http://localhost:4001/v1/version

# public config
curl -i http://localhost:4001/v1/projects/leleka-dev/public-config

# chat (заглушка, но ключ проверяется)
curl -i -X POST http://localhost:4001/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: leleka-dev" \
  -d '{"message":"Привет"}'
```

## Документация
- OpenAPI: `docs/openapi.yaml`
- Safety policy (черновик): `docs/policy.md`
