import { z } from "zod";

/**
 * Pure schema shared by tests and scripts (no `server-only` import).
 * Kept in sync with src/config/env.ts.
 */
export const appEnvSchema = z.enum(["development", "staging", "production"]);

export const scriptEnvSchema = z.object({
  APP_ENV: appEnvSchema.default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ALLOW_DEMO_DATA: z.string().optional(),
  SEED_STAFF_PASSWORD: z.string().min(8),
});

/** Seeding is only permitted with an explicit opt-in and never in production. */
export function isDemoDataAllowed(env: { APP_ENV: string; ALLOW_DEMO_DATA?: string }): boolean {
  return env.APP_ENV !== "production" && env.ALLOW_DEMO_DATA === "true";
}
