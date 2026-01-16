export const SUPPORTED_LOCALES = ["uk", "ru", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

function normalizeCandidate(input?: string | null): string {
  return String(input ?? "").trim().toLowerCase();
}

export function normalizeLocale(input?: string | null, fallback?: string | null): Locale {
  const raw = normalizeCandidate(input);
  if (raw.startsWith("uk") || raw === "ua") return "uk";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("en")) return "en";

  const rawFallback = normalizeCandidate(fallback);
  if (rawFallback.startsWith("uk") || rawFallback === "ua") return "uk";
  if (rawFallback.startsWith("ru")) return "ru";
  if (rawFallback.startsWith("en")) return "en";

  return "uk";
}
