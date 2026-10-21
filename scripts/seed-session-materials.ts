/**
 * One-time: load the real CLP study's session pages and participant messages
 * (2026-10-20 request), from the team's two documents:
 *
 * - "Materiales de preparación e integración · Borrador consolidado v3" →
 *   fourteen published pages, S0–S6 × preparación/integración
 *   (./session-materials/pages.ts).
 * - "Mensajes a participantes" → 24 communication templates
 *   (./session-materials/messages.ts).
 *
 * It also renames the S1–S6 session codes to s1…s6 (S0 was already renamed to
 * s0 from the Hub), so every page lives at /clearlight/estudio/sesiones/sN/…,
 * the addresses the documents and the messages use.
 *
 * Run:
 *
 *   npx tsx --conditions=react-server scripts/seed-session-materials.ts --actor=<staff email> [--dry-run]
 *
 * `--conditions=react-server` lets the script call the same services the Hub
 * uses (they import "server-only"), so validation and audit rows are exactly
 * what a person saving the same text in the Hub would produce, attributed to
 * --actor.
 *
 * Re-running is safe: a page whose published text already matches is left
 * alone, and a template is only updated if its name or body differ. But it
 * WILL publish this file's text over edits made in the Hub since — after the
 * first run, edit in the Hub, not here.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const CODE_RENAMES: Record<string, string> = {
  orientacion: "s1",
  "cuerpos-de-luz": "s2",
  vida: "s3",
  "mas-alla-del-cuerpo": "s4",
  ofrenda: "s5",
  "integracion-grupal": "s6",
};

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
  const schema = await import("@/db/schema");
  const { bodySchema } = await import("@/domain/content");
  const { validateTemplateBody } = await import("@/domain/communication");
  const content = await import("@/services/content");
  const sessions = await import("@/services/sessions");
  const comms = await import("@/services/communications");
  const { SESSION_PAGES } = await import("./session-materials/pages");
  const { MESSAGE_TEMPLATES } = await import("./session-materials/messages");

  // 1 · Validate everything before writing anything.
  const pages = SESSION_PAGES.map((p) => {
    const parsed = bodySchema.safeParse(p.body);
    if (!parsed.success) {
      throw new Error(`${p.sessionCode}/${p.part}: invalid body\n${parsed.error.message}`);
    }
    return { ...p, body: parsed.data };
  });
  for (const m of MESSAGE_TEMPLATES) {
    const problem = validateTemplateBody(m.bodyEs, m.audience);
    if (problem) throw new Error(`${m.key}: ${problem}`);
  }
  console.log(`valid   ${pages.length} pages, ${MESSAGE_TEMPLATES.length} message templates`);

  const db = getDb();
  const [study] = await db
    .select({ id: schema.studies.id })
    .from(schema.studies)
    .where(eq(schema.studies.code, "CLP"))
    .limit(1);
  if (!study) throw new Error("CLP study not found.");
  const [actor] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, actorEmail))
    .limit(1);
  if (!actor) throw new Error(`No staff user with email ${actorEmail}.`);
  const base = { studyId: study.id, actorId: actor.id };

  // 2 · Session codes.
  const templates = await db
    .select({ id: schema.sessionTemplates.id, code: schema.sessionTemplates.code })
    .from(schema.sessionTemplates)
    .where(eq(schema.sessionTemplates.studyId, study.id));
  for (const t of templates) {
    const next = CODE_RENAMES[t.code];
    if (!next) continue;
    console.log(`code    ${t.code} → ${next}`);
    if (!dryRun) await sessions.renameSessionTemplateCode({ ...base, templateId: t.id, code: next });
    t.code = next;
  }
  const sessionIdByCode = new Map(templates.map((t) => [t.code, t.id]));

  // 3 · Pages.
  for (const p of pages) {
    const sessionTemplateId = sessionIdByCode.get(p.sessionCode);
    if (!sessionTemplateId) throw new Error(`No session ${p.sessionCode} in CLP.`);
    const key = `${p.sessionCode}-${p.part}`;
    const type = p.part === "preparacion" ? "SESSION_PREPARATION" : "SESSION_INTEGRATION";

    const [existing] = await db
      .select({ id: schema.contents.id })
      .from(schema.contents)
      .where(and(eq(schema.contents.studyId, study.id), eq(schema.contents.key, key)))
      .limit(1);

    let draftId: string;
    let cover: { url: string | null; position: number } = { url: null, position: 50 };
    if (existing) {
      const [live] = await db
        .select()
        .from(schema.contentVersions)
        .where(
          and(
            eq(schema.contentVersions.contentId, existing.id),
            eq(schema.contentVersions.locale, "es"),
            eq(schema.contentVersions.status, "PUBLISHED"),
          ),
        )
        .limit(1);
      // jsonb reorders object keys, so compare both sides as the schema emits them.
      const liveBody = live ? bodySchema.safeParse(live.body) : null;
      if (
        live &&
        live.title === p.title &&
        liveBody?.success &&
        JSON.stringify(liveBody.data) === JSON.stringify(p.body)
      ) {
        console.log(`page    ${key}: unchanged`);
        continue;
      }
      if (live) cover = { url: live.coverImageUrl, position: live.coverImagePosition };
      console.log(`page    ${key}: new version${live ? ` (replaces v${live.versionNumber})` : ""}`);
      if (dryRun) continue;
      if (!live) throw new Error(`${key} exists with nothing published — finish it in the Hub.`);
      draftId = await content.createDraftFrom({ ...base, versionId: live.id });
    } else {
      console.log(`page    ${key}: created`);
      if (dryRun) continue;
      const contentId = await content.createContent({
        ...base,
        type,
        key,
        sessionTemplateId,
        title: p.title,
        locale: "es",
      });
      const [first] = await db
        .select({ id: schema.contentVersions.id })
        .from(schema.contentVersions)
        .where(eq(schema.contentVersions.contentId, contentId))
        .limit(1);
      draftId = first.id;
    }

    await content.saveVersion({
      ...base,
      versionId: draftId,
      title: p.title,
      body: p.body,
      coverImageUrl: cover.url,
      coverImagePosition: cover.position,
    });
    await content.publishVersion({ ...base, versionId: draftId });
  }

  // 4 · Message templates.
  for (const m of MESSAGE_TEMPLATES) {
    const sessionTemplateId = m.sessionCode ? sessionIdByCode.get(m.sessionCode) : null;
    if (m.sessionCode && !sessionTemplateId) throw new Error(`No session ${m.sessionCode} in CLP.`);

    const [existing] = await db
      .select()
      .from(schema.communicationTemplates)
      .where(
        and(
          eq(schema.communicationTemplates.studyId, study.id),
          eq(schema.communicationTemplates.key, m.key),
        ),
      )
      .limit(1);

    if (!existing) {
      console.log(`message ${m.key}: created`);
      if (!dryRun) {
        await comms.createTemplate({
          ...base,
          key: m.key,
          stage: m.stage,
          channel: m.channel,
          audience: m.audience,
          sessionTemplateId,
          nameEs: m.nameEs,
          bodyEs: m.bodyEs,
        });
      }
    } else if (existing.nameEs !== m.nameEs || existing.bodyEs !== m.bodyEs.trim()) {
      console.log(`message ${m.key}: updated`);
      if (!dryRun) {
        await comms.updateTemplate({
          ...base,
          templateId: existing.id,
          nameEs: m.nameEs,
          bodyEs: m.bodyEs,
          sessionTemplateId,
        });
      }
    } else {
      console.log(`message ${m.key}: unchanged`);
    }
  }

  console.log(dryRun ? "\nDry run: nothing written." : "\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
