# Deploy to Render (PR-02)

## Option A: Render Web Service (Docker)
1. Create a new **Web Service** on Render.
2. Choose **Docker** deployment and point to this repository.
3. Set environment variables:
   - `PORT` (Render provides `PORT` automatically; keep as-is)
   - `DATABASE_URL` (Render Postgres connection string)
   - `ALLOWED_ORIGINS` (comma-separated, e.g. `https://your-vercel-app.vercel.app`)
   - `OPENAI_API_KEY` (optional for PR-02; required later)
4. Deploy.

## Option B: Build/Start commands (without Docker)
- Build: `npm install && npm run build`
- Start: `npm run start`

## Smoke
- `GET /v1/health` must return `status: ok`
- `GET /v1/version` must return `name` and `version`
