import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/config/public-env";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers.
 * Used ONLY for staff authentication. Data access goes through src/db.
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
