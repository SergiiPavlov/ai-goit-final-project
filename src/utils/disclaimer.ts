import { DISCLAIMER } from "../i18n";
import { isLocale, type Locale } from "./locale";

/**
 * Locale disclaimer with a safe fallback.
 */
export function getLocaleDisclaimer(locale?: string): string {
  if (isLocale(locale)) return DISCLAIMER[locale];
  return DISCLAIMER.ru;
}

/**
 * Resolve disclaimer text for a project.
 *
 * Precedence:
 * 1) project.disclaimerTemplate (tenant/legal text)
 * 2) locale disclaimer fallback
 *
 * Template behavior:
 * - If template contains "{{disclaimer}}" placeholder, it will be replaced.
 * - Otherwise disclaimer text is appended as a separate paragraph.
 */
export function resolveProjectDisclaimer(
  project: { disclaimerTemplate?: string | null },
  locale: Locale
): string {
  const fallback = getLocaleDisclaimer(locale);

  const tpl = (project.disclaimerTemplate ?? "").trim();
  if (!tpl) return fallback;

  // If someone saved the default disclaimer as "disclaimerTemplate", treat it as
  // *not* a custom template. Otherwise we'd end up duplicating the disclaimer or
  // mixing languages (e.g., RU template + EN fallback).
  const normalizedTpl = tpl.replace(/\s+/g, " ").trim();
  const builtin = Object.values(DISCLAIMER).some(
    (v) => v.replace(/\s+/g, " ").trim() === normalizedTpl
  );
  if (builtin) return fallback;

  if (tpl.includes("{{disclaimer}}")) {
    return tpl.replace(/\{\{\s*disclaimer\s*\}\}/g, fallback).trim();
  }

  return `${tpl}\n\n${fallback}`.trim();
}
