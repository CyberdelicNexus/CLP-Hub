import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/config/public-env";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers.
 * Used for staff authentication, and — as of the content-images bucket,
 * 2026-09-29 — cookie-authenticated Storage uploads
 * (contenido/actions.ts's `uploadContentImageAction`). Everything else that
 * is "data access" still goes through src/db; Storage has no Drizzle
 * equivalent, so it is the one exception.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies cannot be set there.
          // The proxy refreshes the session on the next request instead.
        }
      },
    },
  });
}
