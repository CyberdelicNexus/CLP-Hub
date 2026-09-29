/**
 * One-time: configure the real CLP study's programme (2026-09-28 request).
 *
 * The founder confirmed the real trial runs the same seven-stage S0–S6
 * programme already modelled for DEMO (D-067, D-068) — same stage names,
 * same session sequence and timing. This writes those same rows for the
 * CLP study (created by scripts/provision-staff.ts), which is the missing
 * piece D-089 diagnosed: only DEMO ever had programme rows, because only
 * seed.ts ever wrote them.
 *
 * Run once:
 *
 *   npx tsx scripts/seed-program.ts
 *
 * Idempotent (onConflictDoUpdate on each row's unique code) — safe to re-run
 * if a name or timing changes, but there is no reason to keep re-running it
 * once the programme is right. Going forward, adjust it from the Hub itself
 * (Configuración → Programa, `study.settings.manage`) rather than editing
 * this script — that screen is what D-089 built specifically so this file
 * would not need to be the only way to change the programme.
 *
 * Not synthetic seed data (rule 9 is about scripts/seed.ts's DEMO content):
 * these are the real trial's stage and session names, for the real CLP study.
 */
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { recordAuditEvent } from "@/audit/record";
import { scriptEnvSchema } from "@/config/env-schema";
import * as schema from "@/db/schema";

loadEnv({ path: ".env.local" });
loadEnv();

/** Identical structure to scripts/seed.ts's DEMO_PROGRAM_STAGES (D-067/D-068). */
const PROGRAM_STAGES = [
  { code: "preparacion", nameEs: "Preparación", nameEn: "Preparation", position: 10, modality: "ZOOM" as const },
  { code: "orientacion", nameEs: "Orientación", nameEn: "Orientation", position: 20, modality: "IN_PERSON" as const },
  { code: "cuerpos-de-luz", nameEs: "Cuerpos de luz", nameEn: "Bodies of light", position: 30, modality: "VR" as const },
  { code: "vida", nameEs: "Vida", nameEn: "Life", position: 40, modality: "VR" as const },
  { code: "mas-alla-del-cuerpo", nameEs: "Más allá del cuerpo", nameEn: "Beyond the body", position: 50, modality: "VR" as const },
  { code: "ofrenda", nameEs: "Ofrenda", nameEn: "Offering", position: 60, modality: "VR" as const },
  { code: "integracion-grupal", nameEs: "Integración grupal", nameEn: "Group integration", position: 70, modality: "ZOOM" as const },
] as const;

/**
 * One session per stage, same S0–S6 sequence and day offsets as DEMO
 * (scripts/seed.ts's DEMO_SESSION_TEMPLATES) — but with the study's own
 * codes, not the demo_-prefixed ones, since these are not demo rows.
 */
const SESSION_TEMPLATES = [
  { code: "preparacion", stageCode: "preparacion", nameEs: "S0 · Preparación", nameEn: "S0 · Preparation", position: 5, modality: "ZOOM" as const, durationMinutes: 60, dayOffset: -7 },
  { code: "orientacion", stageCode: "orientacion", nameEs: "S1 · Orientación", nameEn: "S1 · Orientation", position: 10, modality: "IN_PERSON" as const, durationMinutes: 90, dayOffset: 0 },
  { code: "cuerpos-de-luz", stageCode: "cuerpos-de-luz", nameEs: "S2 · Cuerpos de luz", nameEn: "S2 · Bodies of light", position: 20, modality: "VR" as const, durationMinutes: 60, dayOffset: 7 },
  { code: "vida", stageCode: "vida", nameEs: "S3 · Vida", nameEn: "S3 · Life", position: 30, modality: "VR" as const, durationMinutes: 60, dayOffset: 14 },
  { code: "mas-alla-del-cuerpo", stageCode: "mas-alla-del-cuerpo", nameEs: "S4 · Más allá del cuerpo", nameEn: "S4 · Beyond the body", position: 40, modality: "VR" as const, durationMinutes: 60, dayOffset: 21 },
  { code: "ofrenda", stageCode: "ofrenda", nameEs: "S5 · Ofrenda", nameEn: "S5 · Offering", position: 50, modality: "VR" as const, durationMinutes: 60, dayOffset: 28 },
  { code: "integracion-grupal", stageCode: "integracion-grupal", nameEs: "S6 · Integración grupal", nameEn: "S6 · Group integration", position: 60, modality: "ZOOM" as const, durationMinutes: 45, dayOffset: 35 },
] as const;

async function main() {
  const env = scriptEnvSchema.parse(process.env);
  const sqlClient = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const [study] = await db
      .select({ id: schema.studies.id, code: schema.studies.code })
      .from(schema.studies)
      .where(eq(schema.studies.code, "CLP"))
      .limit(1);
    if (!study) throw new Error('CLP study not found — run `npx tsx scripts/provision-staff.ts` first.');

    for (const stage of PROGRAM_STAGES) {
      const [existing] = await db
        .select({ id: schema.programStages.id })
        .from(schema.programStages)
        .where(and(eq(schema.programStages.studyId, study.id), eq(schema.programStages.code, stage.code)));
      const wasNew = !existing;

      const [row] = await db
        .insert(schema.programStages)
        .values({ ...stage, studyId: study.id })
        .onConflictDoUpdate({
          target: [schema.programStages.studyId, schema.programStages.code],
          set: { nameEs: stage.nameEs, nameEn: stage.nameEn, position: stage.position, modality: stage.modality, active: true },
        })
        .returning();

      if (wasNew) {
        await db.transaction(async (tx) => {
          await recordAuditEvent(tx, {
            studyId: study.id,
            actor: { type: "SYSTEM" },
            action: "program_stage.created",
            entityType: "program_stage",
            entityId: row.id,
            after: { code: stage.code, nameEs: stage.nameEs, modality: stage.modality },
            metadata: { source: "seed-program" },
          });
        });
      }
    }
    console.log(`stages  ${PROGRAM_STAGES.length} programme stages`);

    const stageRows = await db
      .select({ id: schema.programStages.id, code: schema.programStages.code })
      .from(schema.programStages)
      .where(eq(schema.programStages.studyId, study.id));
    const stageIdByCode = new Map(stageRows.map((s) => [s.code, s.id]));

    for (const tpl of SESSION_TEMPLATES) {
      const stageId = stageIdByCode.get(tpl.stageCode) ?? null;

      const [existing] = await db
        .select({ id: schema.sessionTemplates.id })
        .from(schema.sessionTemplates)
        .where(and(eq(schema.sessionTemplates.studyId, study.id), eq(schema.sessionTemplates.code, tpl.code)));
      const wasNew = !existing;

      const [row] = await db
        .insert(schema.sessionTemplates)
        .values({
          code: tpl.code,
          nameEs: tpl.nameEs,
          nameEn: tpl.nameEn,
          position: tpl.position,
          modality: tpl.modality,
          durationMinutes: tpl.durationMinutes,
          dayOffset: tpl.dayOffset,
          stageId,
          studyId: study.id,
        })
        .onConflictDoUpdate({
          target: [schema.sessionTemplates.studyId, schema.sessionTemplates.code],
          set: {
            nameEs: tpl.nameEs,
            nameEn: tpl.nameEn,
            position: tpl.position,
            modality: tpl.modality,
            durationMinutes: tpl.durationMinutes,
            dayOffset: tpl.dayOffset,
            stageId,
            active: true,
          },
        })
        .returning();

      if (wasNew) {
        await db.transaction(async (tx) => {
          await recordAuditEvent(tx, {
            studyId: study.id,
            actor: { type: "SYSTEM" },
            action: "session_template.created",
            entityType: "session_template",
            entityId: row.id,
            after: { code: tpl.code, nameEs: tpl.nameEs, modality: tpl.modality, dayOffset: tpl.dayOffset },
            metadata: { source: "seed-program" },
          });
        });
      }
    }
    console.log(`program ${SESSION_TEMPLATES.length} session templates`);
    console.log(`\nDone. Every cohort in ${study.code} now shares this programme.`);
  } finally {
    await sqlClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
