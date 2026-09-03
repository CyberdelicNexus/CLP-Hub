import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { parseLocale } from "@/domain/locale";
import { LOCALE_COOKIE } from "./cookies";

/**
 * Locale resolution for UI strings (next-intl, no URL prefix).
 * The cookie is the rendering source of truth; it is synced from the
 * staff profile's preferred_locale at login and whenever it changes.
 * Public participant pages default to Spanish.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = parseLocale(store.get(LOCALE_COOKIE)?.value);
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
