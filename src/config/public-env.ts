/**
 * Browser-safe configuration. Next.js inlines NEXT_PUBLIC_* at build time,
 * so these must be referenced literally (not via a computed key).
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;
