import { NextResponse, type NextRequest } from "next/server";
import { isPublicLocale } from "@/domain/locale";
import { HOME_RETURN, MEDITATE_PATH, MEDITATE_RETURN, PUBLIC_BASE_PATH } from "@/domain/navigation";
import { PREFERENCE_COOKIE_OPTIONS, PUBLIC_LOCALE_COOKIE } from "@/i18n/cookies";

/**
 * The public site's language switch (D-063). A plain link, so it works without
 * JavaScript and the page reloads whole (the landing's scroll engine mounts on
 * document load). It records the choice in a technical cookie, listed in the
 * cookie policy, and sends the visitor back to the page they were reading.
 *
 * It stores nothing else. The return path is checked against the public pages,
 * so the link cannot be used to redirect anywhere else.
 */
/** Study content pages (/estudio/{key} and /estudio/sesiones/{code}/{part}): plain slugs only (D-135). */
const STUDY_PAGE_PATH = /^\/estudio(\/[a-z][a-z0-9_-]{0,48}){1,3}$/;
const RETURN_PATHS = ["/", "/aviso-legal", "/privacidad", "/cookies", "/participar"] as const;

export async function GET(request: NextRequest, ctx: RouteContext<"/clearlight/idioma/[locale]">) {
  const { locale } = await ctx.params;
  if (!isPublicLocale(locale)) return new NextResponse(null, { status: 404 });

  // `desde` names a page of the Clear Light site; "/" is its landing page.
  const from = request.nextUrl.searchParams.get("desde");
  const page =
    (RETURN_PATHS as readonly (string | null)[]).includes(from) || (from !== null && STUDY_PAGE_PATH.test(from))
      ? from!
      : "/";
  const path =
    from === HOME_RETURN ? "/" : from === MEDITATE_RETURN ? MEDITATE_PATH : page === "/" ? PUBLIC_BASE_PATH : `${PUBLIC_BASE_PATH}${page}`;

  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.cookies.set(PUBLIC_LOCALE_COOKIE, locale, PREFERENCE_COOKIE_OPTIONS);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
