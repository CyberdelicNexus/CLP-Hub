import { NextResponse, type NextRequest } from "next/server";
import { isPublicLocale } from "@/domain/locale";
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
const RETURN_PATHS = ["/", "/aviso-legal", "/privacidad", "/cookies"] as const;

export async function GET(request: NextRequest, ctx: RouteContext<"/idioma/[locale]">) {
  const { locale } = await ctx.params;
  if (!isPublicLocale(locale)) return new NextResponse(null, { status: 404 });

  const from = request.nextUrl.searchParams.get("desde");
  const path = (RETURN_PATHS as readonly (string | null)[]).includes(from) ? from! : "/";

  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.cookies.set(PUBLIC_LOCALE_COOKIE, locale, PREFERENCE_COOKIE_OPTIONS);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
