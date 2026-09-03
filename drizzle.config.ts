import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit is used for schema introspection / diff checks only.
 * Migrations are hand-written SQL in supabase/migrations and applied
 * with `npm run db:migrate` (scripts/migrate.ts) so they stay reviewable
 * and can also be pasted into the Supabase SQL editor.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle-introspection",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
