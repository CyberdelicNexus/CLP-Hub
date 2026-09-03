import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/auth/supabase/proxy";
import { TEAM_BASE_PATH } from "@/domain/navigation";

const LOGIN_PATH = `${TEAM_BASE_PATH}/login`;

/**
 * Next.js 16 proxy (formerly middleware). Two jobs only:
 * 1. keep the Supabase auth cookie fresh;
 * 2. optimistic redirect for the team area (unauthenticated → login,
 *    authenticated visiting login → dashboard).
 * Real authorization happens in server code (src/auth).
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isTeamArea = pathname === TEAM_BASE_PATH || pathname.startsWith(`${TEAM_BASE_PATH}/`);
  const isLogin = pathname === LOGIN_PATH;

  if (isTeamArea && !isLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = TEAM_BASE_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
};
