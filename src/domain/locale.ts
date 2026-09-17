/** UI locales for the team dashboard. Participant content is Spanish-first. */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Languages of the public site (landing and legal pages), D-063. Wider than the
 * staff UI: Galician is offered to visitors, not to the team dashboard. Spanish
 * stays the default, and the order is the order of the language switch.
 */
export const PUBLIC_LOCALES = ["es", "en", "gl"] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

/** Each language named in itself, as a language switch should. */
export const PUBLIC_LOCALE_NAMES: Record<PublicLocale, string> = {
  es: "Español",
  en: "English",
  gl: "Galego",
};

export function isPublicLocale(value: unknown): value is PublicLocale {
  return typeof value === "string" && (PUBLIC_LOCALES as readonly string[]).includes(value);
}

export function parsePublicLocale(value: unknown): PublicLocale {
  return isPublicLocale(value) ? value : DEFAULT_LOCALE;
}
