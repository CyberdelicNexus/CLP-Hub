import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/config/env";
import * as schema from "./schema";

/**
 * Single server-side database handle, created lazily on first use so that
 * `next build` never needs DATABASE_URL. Connects with DATABASE_URL, which
 * must never reach the browser. `prepare: false` is required for the
 * Supabase transaction pooler.
 *
 * NOTE: the default Supabase `postgres` role bypasses RLS. RLS on every
 * table (with no policies) exists to deny the anon/authenticated API keys,
 * not to authorize this connection. Authorization is enforced in
 * src/auth/authorize.ts. A dedicated least-privilege DB role is a
 * documented hardening step before any real participant data.
 */
export type Db = PostgresJsDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the root handle or a transaction; service functions accept this. */
export type DbExecutor = Db | DbTransaction;

const globalForDb = globalThis as unknown as { __clpDb?: Db };

export function getDb(): Db {
  if (globalForDb.__clpDb) return globalForDb.__clpDb;
  const env = getEnv();
  const sql = postgres(env.DATABASE_URL, {
    prepare: false,
    max: env.APP_ENV === "development" ? 5 : 10,
    idle_timeout: 20,
  });
  const db = drizzle(sql, { schema });
  // Cache across hot reloads in development and across requests in production.
  globalForDb.__clpDb = db;
  return db;
}
