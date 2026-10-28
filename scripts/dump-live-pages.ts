/**
 * Read-only: writes every live Spanish session page (title + body) to a JSON
 * file, so it can be translated. Run with:
 *   npx tsx --conditions=react-server scripts/dump-live-pages.ts <out.json>
 */
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Pass the output file.");
  const { and, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/db/client");
  const s = await import("@/db/schema");
  const rows = await getDb()
    .select({
      id: s.contents.id,
      key: s.contents.key,
      type: s.contents.type,
      versionId: s.contentVersions.id,
      versionNumber: s.contentVersions.versionNumber,
      title: s.contentVersions.title,
      body: s.contentVersions.body,
      coverImageUrl: s.contentVersions.coverImageUrl,
      coverImagePosition: s.contentVersions.coverImagePosition,
    })
    .from(s.contentVersions)
    .innerJoin(s.contents, eq(s.contents.id, s.contentVersions.contentId))
    .where(and(eq(s.contentVersions.locale, "es"), eq(s.contentVersions.status, "PUBLISHED")))
    .orderBy(s.contents.key);
  writeFileSync(out, JSON.stringify(rows, null, 1), "utf8");
  console.log(`${rows.length} live Spanish pages -> ${out}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
