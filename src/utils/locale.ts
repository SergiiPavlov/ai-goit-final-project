export type Locale = "ru" | "uk" | "en";

export const DEFAULT_LOCALE: Locale = "ru";

export const SUPPORTED_LOCALES: readonly Locale[] = ["ru", "uk", "en"] as const;

export function normalizeLocale(value?: string | null): Locale {
  const v = String(value || "").toLowerCase().trim();
  if (v === "ua") return "uk";
  if (v === "uk" || v === "ru" || v === "en") return v as Locale;
  return DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "uk" || value === "en";
}
