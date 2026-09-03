/**
 * Cookie names and options shared by the request config, proxy and
 * server actions. Values are non-sensitive preferences only (never PII).
 */
export const LOCALE_COOKIE = "clp_locale";
export const STUDY_COOKIE = "clp_study";

export const PREFERENCE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};
