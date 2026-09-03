/**
 * Applies supabase/migrations/*.sql in filename order, once each,
 * recording them in schema_migrations. Each file runs in its own transaction.
 *
 * Usage: npm run db:migrate   (requires DATABASE_URL in .env.local)
 */
import { config as loadEnv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { prepare: false, max: 1 });

  const dir = path.resolve(process.cwd(), "supabase/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  try {
    // Bootstrap: the first migration also creates schema_migrations (idempotent).
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const rows = await sql`select name from schema_migrations`;
    const applied = new Set(rows.map((r) => r.name as string));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip    ${file}`);
        continue;
      }
      const body = await readFile(path.join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      console.log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
