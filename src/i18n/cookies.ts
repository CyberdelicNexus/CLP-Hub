/**
 * Cookie names and options shared by the request config, proxy and
 * server actions. Values are non-sensitive preferences only (never PII).
 */
export const LOCALE_COOKIE = "clp_locale";
/**
 * The public site's language (D-063). Separate from LOCALE_COOKIE so a visitor's
 * choice never changes a staff member's dashboard language, and Galician (which
 * the staff UI does not offer) never reaches the staff message loader.
 */
export const PUBLIC_LOCALE_COOKIE = "clp_public_locale";
export const STUDY_COOKIE = "clp_study";

export const PREFERENCE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};
