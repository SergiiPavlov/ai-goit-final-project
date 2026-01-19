export type Locale = "ru" | "uk" | "en";

export const DEFAULT_LOCALE: Locale = "ru";

export const SUPPORTED_LOCALES: readonly Locale[] = ["ru", "uk", "en"] as const;

export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "uk" || value === "en";
}

function normalizeOne(value?: string | null): Locale | null {
  const v = String(value || "").toLowerCase().trim();
  if (v === "ua") return "uk";
  if (isLocale(v)) return v;
  return null;
}

export function normalizeLocale(value?: string | null, fallback?: string | null): Locale {
  return normalizeOne(value) ?? normalizeOne(fallback) ?? DEFAULT_LOCALE;
}
