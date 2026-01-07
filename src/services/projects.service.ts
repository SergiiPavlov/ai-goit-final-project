import { prisma } from "../prisma";

export type ProjectRecord = {
  id: string;
  name: string;
  publicKey: string;
  allowedOrigins: string[];
  localeDefault: string;
  disclaimerTemplate: string;
  systemPrompt: string;
};

type CacheEntry<T> = { value: T; expiresAt: number };

const PROJECT_CACHE = new Map<string, CacheEntry<ProjectRecord | null>>();
const ORIGIN_CACHE = new Map<string, CacheEntry<boolean>>();

const PROJECT_TTL_MS = 30_000;
const ORIGIN_TTL_MS = 60_000;

function nowMs() {
  return Date.now();
}

export async function getProjectByKey(projectKey: string): Promise<ProjectRecord | null> {
  const key = projectKey.trim();
  if (!key) return null;

  const cached = PROJECT_CACHE.get(key);
  if (cached && cached.expiresAt > nowMs()) return cached.value;

  const project = await prisma.project.findUnique({
    where: { publicKey: key },
    select: {
      id: true,
      name: true,
      publicKey: true,
      allowedOrigins: true,
      localeDefault: true,
      disclaimerTemplate: true,
      systemPrompt: true,
    },
  });

  const value = project ? (project as ProjectRecord) : null;
  PROJECT_CACHE.set(key, { value, expiresAt: nowMs() + PROJECT_TTL_MS });
  return value;
}

export async function isOriginAllowedByAnyProject(origin: string): Promise<boolean> {
  const o = origin.trim();
  if (!o) return false;

  const cached = ORIGIN_CACHE.get(o);
  if (cached && cached.expiresAt > nowMs()) return cached.value;

  const found = await prisma.project.findFirst({
    where: {
      allowedOrigins: { has: o },
    },
    select: { id: true },
  });

  const allowed = Boolean(found);
  ORIGIN_CACHE.set(o, { value: allowed, expiresAt: nowMs() + ORIGIN_TTL_MS });
  return allowed;
}
