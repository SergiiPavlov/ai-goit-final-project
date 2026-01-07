# PR-02: Minimal Dockerfile for Render (no lockfile required)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma generate requires DATABASE_URL to be present, but doesn't need a live DB for generation.
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/ai_assistant?schema=public
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
EXPOSE 4001
CMD ["npm", "run", "start"]
