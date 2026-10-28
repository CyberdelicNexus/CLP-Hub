/**
 * One-time: add the Galician version of the fourteen session pages (S0-S6 x
 * preparacion/integracion), D-135, and publish it.
 *
 * The translation is a Spanish -> Galician table (./session-materials/galician.json),
 * written by Claude and not yet reviewed by a native speaker. The script reads
 * each page's LIVE Spanish text from the database, swaps every string for its
 * Galician one and leaves everything else (structure, links, formatting, cover
 * image) as it is. A string with no entry stops the run before anything is
 * written, which is also what happens if the Spanish was edited in the Hub since
 * the table was made. Session names (Cuerpos de Luz, Vida...), book and
 * resource titles and addresses stay in Spanish on purpose.
 *
 * Run:
 *
 *   npx tsx --conditions=react-server scripts/seed-galician-pages.ts --actor=<staff email> [--dry-run]
 *
 * Goes through the same services as the Hub (validation, audit rows, attributed
 * to --actor). A page that already has any Galician version is left alone, so
 * re-running never overwrites later edits.
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const TEXT_KEYS = new Set(["title", "md", "caption", "alt", "description", "label", "contactLabel"]);
const PAGE_KEY = /^s[0-6]-(preparacion|integracion)$/;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const actorEmail = arg("actor");
  if (!actorEmail) throw new Error("Pass --actor=<email of the staff member this is recorded as>.");

  const table: Record<string, string> = JSON.parse(
    readFileSync(join(process.cwd(), "scripts/session-materials/galician.json"), "utf8"),
  );
  const missing = new Set<string>();

  /** Swaps one string, keeping its leading and trailing spaces. */
  const tr = (s: string): string => {
    const core = s.trim();
    if (!core) return s;
    const gl = table[core];
    if (gl === undefined) {
      missing.add(core);
      return s;
    }
    return s.slice(0, s.indexOf(core)) + gl + s.slice(s.indexOf(core) + core.length);
  };
  const walk = (n: unknown, key?: string): unknown => {
    if (Array.isArray(n)) return n.map((v) => (typeof v === "string" && key === "items" ? tr(v) : walk(v, key)));
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(o).map(([k, v]) => [
          k,
          typeof v === "string" && ((k === "text" && o.type === "text") || TEXT_KEYS.has(k)) ? tr(v) : walk(v, k),
        ]),
      );
    }
    return n;
  };

  const { and, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/db/client");
  const s = await import("@/db/schema");
  const { bodySchema } = await import("@/domain/content");
  const content = await import("@/services/content");

  const db = getDb();
  const [study] = await db.select({ id: s.studies.id }).from(s.studies).where(eq(s.studies.code, "CLP")).limit(1);
  if (!study) throw new Error("CLP study not found.");
  const [actor] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, actorEmail)).limit(1);
  if (!actor) throw new Error(`No staff user with email ${actorEmail}.`);
  const base = { studyId: study.id, actorId: actor.id };

  const live = (
    await db
      .select({
        contentId: s.contents.id,
        key: s.contents.key,
        title: s.contentVersions.title,
        body: s.contentVersions.body,
        coverImageUrl: s.contentVersions.coverImageUrl,
        coverImagePosition: s.contentVersions.coverImagePosition,
      })
      .from(s.contentVersions)
      .innerJoin(s.contents, eq(s.contents.id, s.contentVersions.contentId))
      .where(
        and(
          eq(s.contents.studyId, study.id),
          eq(s.contentVersions.locale, "es"),
          eq(s.contentVersions.status, "PUBLISHED"),
        ),
      )
      .orderBy(s.contents.key)
  ).filter((r) => PAGE_KEY.test(r.key));

  // 1 · Translate and validate everything before writing anything.
  const pages = live.map((r) => {
    const title = tr(r.title);
    const parsed = bodySchema.safeParse(walk(r.body));
    if (!parsed.success) throw new Error(`${r.key}: invalid Galician body\n${parsed.error.message}`);
    return { ...r, title, body: parsed.data };
  });
  if (missing.size) {
    throw new Error(
      `No Galician for ${missing.size} string(s); the Spanish may have changed since the table was made:\n- ${[...missing].join("\n- ")}`,
    );
  }
  console.log(`ready   ${pages.length} pages`);

  // 2 · Write.
  for (const p of pages) {
    const [existing] = await db
      .select({ id: s.contentVersions.id })
      .from(s.contentVersions)
      .where(and(eq(s.contentVersions.contentId, p.contentId), eq(s.contentVersions.locale, "gl")))
      .limit(1);
    if (existing) {
      console.log(`page    ${p.key}: already has a Galician version, left alone`);
      continue;
    }
    console.log(`page    ${p.key}: Galician published`);
    if (dryRun) continue;
    const draftId = await content.createTranslationDraft({ ...base, contentId: p.contentId, locale: "gl" });
    await content.saveVersion({
      ...base,
      versionId: draftId,
      title: p.title,
      body: p.body,
      coverImageUrl: p.coverImageUrl,
      coverImagePosition: p.coverImagePosition,
    });
    await content.publishVersion({ ...base, versionId: draftId });
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
