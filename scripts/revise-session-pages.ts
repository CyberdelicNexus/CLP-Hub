/**
 * One-time: apply Joana Vidal's 2026-11-03 review of the session pages (D-136)
 * to the LIVE pages, in Spanish and in Galician.
 *
 * It also puts the study's WhatsApp number in every page's contact box (D-137).
 *
 * Unlike scripts/seed-session-materials.ts, this does not publish ./pages.ts
 * over the live text. It swaps only the strings, the block and the contact
 * button link listed in ./session-materials/revision-2026-11-03.ts,
 * so edits made in the Hub since the pages were loaded stay as they are. The
 * Galician strings come from ./session-materials/galician.json.
 *
 * Everything is checked before anything is written: if an old string is not on
 * the live page (someone changed that sentence in the Hub), or a Galician line
 * is missing from the table, the run stops and names it. A page where every
 * swap is already in place is left alone, so re-running is safe.
 *
 * Run:
 *
 *   npx tsx --conditions=react-server scripts/revise-session-pages.ts --actor=<staff email> [--dry-run]
 *
 * Goes through the same services as the Hub (new draft from the live version,
 * save, publish; audit rows attributed to --actor). Cover images are kept.
 */
import { config as loadEnv } from "dotenv";
import { galicianTranslator, loadGalicianTable } from "./session-materials/galician";

loadEnv({ path: ".env.local" });
loadEnv();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const actorEmail = arg("actor");
  if (!actorEmail) throw new Error("Pass --actor=<email of the staff member this is recorded as>.");

  const { and, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/db/client");
  const s = await import("@/db/schema");
  const { bodySchema } = await import("@/domain/content");
  const content = await import("@/services/content");
  const { SESSION_PAGES } = await import("./session-materials/pages");
  const { REVISION_PAIRS, BLOCK_SWAPS, CONTACT_PAIRS, FIELD_SWAPS } = await import("./session-materials/revision-2026-11-03");
  const { revisePage } = await import("./session-materials/revise");

  const gl = galicianTranslator(loadGalicianTable());

  const db = getDb();
  const [study] = await db.select({ id: s.studies.id }).from(s.studies).where(eq(s.studies.code, "CLP")).limit(1);
  if (!study) throw new Error("CLP study not found.");
  const [actor] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, actorEmail)).limit(1);
  if (!actor) throw new Error(`No staff user with email ${actorEmail}.`);
  const base = { studyId: study.id, actorId: actor.id };

  const keys = SESSION_PAGES.map((p) => `${p.sessionCode}-${p.part}`);
  const plans: { label: string; versionId: string; title: string; body: unknown; cover: string | null; pos: number }[] = [];
  const problems: string[] = [];

  // 1 · Work out every new version before writing anything.
  for (const key of keys) {
    const page = SESSION_PAGES.find((p) => `${p.sessionCode}-${p.part}` === key);
    if (!page) throw new Error(`${key}: not in pages.ts`);
    const esPairs = [...(REVISION_PAIRS[key] ?? []), ...CONTACT_PAIRS];
    const esBlocks = BLOCK_SWAPS.filter((b) => b.key === key).map((b) => {
      const replacement = page.body.find(
        (x) => "title" in x && x.title === b.title && x.type !== b.type,
      );
      if (!replacement) throw new Error(`${key}: no replacement block titled "${b.title}" in pages.ts`);
      return { ...b, replacement: bodySchema.parse([replacement])[0] };
    });

    for (const locale of ["es", "gl"] as const) {
      const [live] = await db
        .select({
          id: s.contentVersions.id,
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
            eq(s.contents.key, key),
            eq(s.contentVersions.locale, locale),
            eq(s.contentVersions.status, "PUBLISHED"),
          ),
        )
        .limit(1);
      const label = `${key} (${locale})`;
      if (!live) {
        if (locale === "es") problems.push(`${label}: nothing published`);
        else console.log(`page    ${label}: no live Galician version, skipped`);
        continue;
      }

      const pairs: [string, string][] =
        locale === "es" ? esPairs : esPairs.map(([a, b]) => [gl.tr(a), gl.tr(b)]);
      const blocks = esBlocks.map((b) => {
        const title = locale === "es" ? b.title : gl.tr(b.title);
        return {
          label: `${b.type} "${title}"`,
          match: (x: Record<string, unknown>) => x.type === b.type && x.title === title,
          replacement: locale === "es" ? b.replacement : gl.walk(b.replacement),
        };
      });

      const liveBody = bodySchema.parse(live.body);
      const outcome = revisePage(liveBody, pairs, blocks, FIELD_SWAPS);
      for (const miss of outcome.notFound) problems.push(`${label}: not on the live page: ${miss}`);
      if (outcome.applied === 0) {
        console.log(`page    ${label}: already revised`);
        continue;
      }
      const parsed = bodySchema.safeParse(outcome.body);
      if (!parsed.success) {
        problems.push(`${label}: revised body is invalid\n${parsed.error.message}`);
        continue;
      }
      console.log(
        `page    ${label}: ${outcome.applied} change(s)${outcome.alreadyDone ? `, ${outcome.alreadyDone} already done` : ""}`,
      );
      plans.push({
        label,
        versionId: live.id,
        title: live.title,
        body: parsed.data,
        cover: live.coverImageUrl,
        pos: live.coverImagePosition,
      });
    }
  }

  if (gl.missing.size) {
    problems.push(`No Galician in galician.json for:\n- ${[...gl.missing].join("\n- ")}`);
  }
  if (problems.length) {
    throw new Error(`Nothing written. Fix these first:\n${problems.join("\n")}`);
  }
  if (dryRun) {
    console.log(`\nDry run: ${plans.length} page version(s) would be published; nothing written.`);
    return;
  }

  // 2 · Write: new draft from the live version, save, publish.
  for (const p of plans) {
    const draftId = await content.createDraftFrom({ ...base, versionId: p.versionId });
    await content.saveVersion({
      ...base,
      versionId: draftId,
      title: p.title,
      body: p.body,
      coverImageUrl: p.cover,
      coverImagePosition: p.pos,
    });
    await content.publishVersion({ ...base, versionId: draftId });
    console.log(`publish ${p.label}`);
  }
  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
