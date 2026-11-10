/**
 * One-off: the POST visit and its messages for the CLP study (2026-10-28,
 * D-136). Run once, after migration 0030, through the same services the Hub
 * uses, so every change carries its usual audit row attributed to --actor.
 *
 *   npx tsx --conditions=react-server scripts/seed-post-visit.ts --actor=<staff email> [--dry-run]
 *
 * What it does, each step skipped when already done:
 *
 * 1. S0 becomes an INDIVIDUAL, in-person session that DELIVERS the headset,
 *    where the physical consent is signed (D-139), and the initial visit (D-140).
 *    S1 moves to Zoom, and both stages follow their sessions (D-140).
 * 2. A "Post" programme stage and a `post` session template after S6: an
 *    INDIVIDUAL visit that PICKS UP the headset and collects the questionnaire
 *    in person (D-139).
 * 3. Message 23 (arranging the POST visit) moves from S6 to Post.
 * 4. Message 24 (three months later) moves to Post and now carries the personal
 *    results PDF and the AnumaXR download with its unlock code
 *    (`{{instrucciones}}`, filled when sending — the link and code are not on
 *    record yet). The questionnaire left it: it is collected at the visit (D-140).
 * 5. A control-group email for the same moment, for the control cohorts'
 *    plan. It has `{{enlace}}`/`{{instrucciones}}`, so until the links are
 *    written into it D-116 keeps it copy-only.
 *
 * Everything here is configuration and content, editable afterwards in
 * Configuración and Comunicaciones; nothing in code knows about "post".
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const M24_BODY = `¡Hola, {{nombre}}! Han pasado tres meses desde que terminamos el programa Clear Light, y nos acordamos mucho de este camino que hemos recorrido juntos.

Como te prometimos, aquí tienes:
• Tu informe personal con tus resultados del estudio (te lo enviamos en PDF junto a este mensaje).
• Acceso a las experiencias Solo de AnumaXR, para que puedas seguir practicando por tu cuenta. {{instrucciones}}

Con este mensaje termina tu participación en el estudio. Muchísimas gracias por tu confianza, tu tiempo y todo lo que has compartido. Ha sido un placer vivir esta experiencia contigo, y tu participación nos ayuda a que este programa pueda llegar a muchas más personas.

Un abrazo muy fuerte,
El equipo de Clear Light`;

const CONTROL_POST_BODY = `Hola, {{nombre}}:

Somos el equipo del estudio de investigación Clear Light. Tu participación en el estudio ha terminado y, como te prometimos, queremos agradecértela.

Si todavía no lo has hecho, aquí tienes el último cuestionario (no te llevará más de 20 minutos): {{enlace}}

• Tu informe personal: te lo enviamos en PDF, con tus resultados de bienestar emocional y salud mental a partir de los datos que hemos recogido durante el estudio.
• La experiencia de realidad virtual de Clear Light: puedes descargar AnumaXR y desbloquear las experiencias Solo. {{instrucciones}}

Muchas gracias por acompañarnos durante todo este tiempo. Tu papel ha sido fundamental para esta investigación.

Un saludo,
El equipo de Clear Light`;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const actorEmail = arg("actor");
  if (!actorEmail) throw new Error("Pass --actor=<email of the staff member this is recorded as>.");

  const { and, eq } = await import("drizzle-orm");
  const { getDb } = await import("@/db/client");
  const schema = await import("@/db/schema");
  const { validateTemplateBody } = await import("@/domain/communication");
  const sessions = await import("@/services/sessions");
  const stages = await import("@/services/program-stages");
  const comms = await import("@/services/communications");

  for (const [key, body, audience] of [
    ["m24", M24_BODY, "PARTICIPANT"],
    ["control-post", CONTROL_POST_BODY, "PARTICIPANT"],
  ] as const) {
    const problem = validateTemplateBody(body, audience);
    if (problem) throw new Error(`${key}: ${problem}`);
  }

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

  const templates = await db
    .select()
    .from(schema.sessionTemplates)
    .where(eq(schema.sessionTemplates.studyId, study.id));
  const byCode = new Map(templates.map((t) => [t.code, t]));

  // 1 · S0 delivers the headset at an individual visit.
  const s0 = byCode.get("s0");
  if (!s0) throw new Error("No s0 session in CLP.");
  if (
    s0.attendance !== "INDIVIDUAL" ||
    s0.deviceHandoff !== "DELIVERY" ||
    s0.modality !== "IN_PERSON" ||
    !s0.visitChecks.includes("PHYSICAL_CONSENT") ||
    !s0.visitChecks.includes("INITIAL_VISIT")
  ) {
    console.log("s0      → individual and in person, delivers the headset, physical consent");
    if (!dryRun) {
      await sessions.updateSessionTemplate({
        ...base,
        templateId: s0.id,
        attendance: "INDIVIDUAL",
        deviceHandoff: "DELIVERY",
        modality: "IN_PERSON",
        visitChecks: ["PHYSICAL_CONSENT", "INITIAL_VISIT"],
      });
    }
  } else console.log("s0      unchanged");

  // 1b · S0 is the in-person visit and S1 is held on Zoom, on the session and on
  // the stage the timeline reads (D-140).
  const s1 = byCode.get("s1");
  if (!s1) throw new Error("No s1 session in CLP.");
  if (s1.modality !== "ZOOM") {
    console.log("s1      → Zoom");
    if (!dryRun) await sessions.updateSessionTemplate({ ...base, templateId: s1.id, modality: "ZOOM" });
  } else console.log("s1      unchanged");

  const programStages = await db
    .select()
    .from(schema.programStages)
    .where(eq(schema.programStages.studyId, study.id));
  for (const [templateStageId, modality] of [
    [s0.stageId, "IN_PERSON"],
    [s1.stageId, "ZOOM"],
  ] as const) {
    const stage = programStages.find((st) => st.id === templateStageId);
    if (stage && stage.modality !== modality) {
      console.log(`stage   ${stage.code} → ${modality}`);
      if (!dryRun) await stages.updateProgramStage({ ...base, stageId: stage.id, modality });
    }
  }

  // 2 · The Post stage and session.
  let postId = byCode.get("post")?.id ?? null;
  if (!postId) {
    const [existingStage] = await db
      .select({ id: schema.programStages.id })
      .from(schema.programStages)
      .where(and(eq(schema.programStages.studyId, study.id), eq(schema.programStages.code, "post")))
      .limit(1);
    let stageId = existingStage?.id ?? null;
    if (!stageId) {
      console.log("stage   + Post");
      if (!dryRun) {
        stageId = await stages.createProgramStage({ ...base, code: "post", nameEs: "Post", modality: "IN_PERSON", position: 80 });
      }
    }
    console.log("session + post (individual, picks up the headset, questionnaire in person)");
    if (!dryRun) {
      postId = await sessions.createSessionTemplate({
        ...base,
        code: "post",
        nameEs: "POST · Visita final",
        modality: "IN_PERSON",
        stageId,
        position: 70,
        attendance: "INDIVIDUAL",
        deviceHandoff: "PICKUP",
        visitChecks: ["QUESTIONNAIRE"],
      });
    }
  } else console.log("post    exists");

  // 3–4 · Messages 23 and 24 move to Post; 24 gains the results and AnumaXR.
  const messages = await db
    .select()
    .from(schema.communicationTemplates)
    .where(eq(schema.communicationTemplates.studyId, study.id));
  const byKey = new Map(messages.map((m) => [m.key, m]));

  const m23 = byKey.get("m23-visita-post");
  if (m23 && postId && m23.sessionTemplateId !== postId) {
    console.log("m23     → Post");
    if (!dryRun) await comms.relinkTemplateSession({ ...base, templateId: m23.id, sessionTemplateId: postId });
  }
  const m24 = byKey.get("m24-tres-meses-programa");
  if (m24 && (m24.bodyEs !== M24_BODY || m24.sessionTemplateId !== postId)) {
    console.log(`m24     → Post, with results PDF and AnumaXR, no questionnaire${m24.bodyEn ? " (English text left as it was)" : ""}`);
    if (!dryRun) {
      await comms.updateTemplate({
        ...base,
        templateId: m24.id,
        nameEs: "24 · A los 3 meses: resultados y AnumaXR",
        bodyEs: M24_BODY,
        bodyEn: m24.bodyEn,
        sessionTemplateId: postId,
      });
    }
  }

  // 5 · The control group's equivalent, for its plan.
  if (!byKey.has("m25-post-control")) {
    console.log("m25     + control: results and AnumaXR (email)");
    if (!dryRun) {
      await comms.createTemplate({
        ...base,
        key: "m25-post-control",
        stage: "CLOSING",
        channel: "EMAIL",
        audience: "PARTICIPANT",
        nameEs: "Clear Light: tu informe y la experiencia de realidad virtual",
        bodyEs: CONTROL_POST_BODY,
      });
    }
  } else console.log("m25     exists");

  console.log(dryRun ? "\nDry run: nothing written." : "\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
