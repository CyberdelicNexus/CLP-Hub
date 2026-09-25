import "server-only";
import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Parsed lazily so that `next build` does not require a fully populated
 * environment for static analysis. Every server module that needs config
 * calls `getEnv()` at request time.
 *
 * The service-role key is intentionally NOT part of this schema. It must
 * only ever be read by scripts under /scripts, never by application code.
 */
/** A key left blank in an env file (`KEY=`) means "not set", not "invalid". */
const blankIsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  /**
   * Shared secret for the scheduled-action processor (Phase 8).
   *
   * Optional, and that is deliberate: a developer running the app locally has
   * no cron, and requiring a secret they will never use would be one more
   * reason to copy a placeholder into .env. The endpoint refuses every request
   * when it is unset, so an unconfigured deployment is closed, not open.
   */
  CRON_SECRET: z.string().min(16).optional(),
  /**
   * Trello, read-only iframe embed (2026-09-18 request — simpler than the
   * API approach this replaced: the board must have public sharing enabled
   * for Trello to allow framing it at all). Optional: unset means "not
   * connected", not an error — see src/services/trello.ts.
   */
  TRELLO_BOARD_URL: z.string().url().optional(),
  /**
   * Outbound email through Resend (D-088): inquiry notifications to staff and
   * replies to the person who asked. Both optional: with no key, notifications
   * are skipped with a log line and a reply is refused (so an answer is never
   * lost as "sent"). MAIL_FROM must be an address on a domain verified at Resend,
   * e.g. `Clear Light <consultas@your-domain>`. APP_URL is the Hub's public
   * address, used only to link the inbox from a notification.
   */
  RESEND_API_KEY: blankIsUnset(z.string().min(1)),
  MAIL_FROM: blankIsUnset(z.string().min(3)),
  APP_URL: blankIsUnset(z.string().url()),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment. Check: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return getEnv().APP_ENV === "production";
}
