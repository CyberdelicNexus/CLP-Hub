/**
 * A realistic, lived-in DEMO study for presenting the Hub (2026-11-09 request).
 * SYNTHETIC DATA ONLY: every person is invented, every email is @example.com
 * (reserved, undeliverable) and every phone is +34 600 0xx xxx.
 *
 *   npx tsx --conditions=react-server scripts/seed-demo-scenario.ts
 *
 * (`react-server` lets the app's `server-only` services load outside Next.)
 *
 * What it builds, with dates relative to the day it runs:
 *   - a finished spring pilot cohort (PIL-01): sessions held, everyone completed
 *   - an autumn intervention cohort mid-programme (OTO-01) with its paired
 *     control group (OTO-01-C): sessions held and upcoming, headsets out
 *   - a winter cohort still filling (INV-01) and its control (INV-01-C)
 *   - a recruitment funnel: new applications, some in review, screenings
 *     booked this week, eligible people waiting for allocation, one parked for
 *     review, two not eligible, one no-show
 *   - headsets in every state, one overdue, one incident; open tasks for the
 *     real team members who hold a DEMO role; public questions in Consultas
 *
 * HOW: through the app's own services, so every row has the same invariants
 * and audit trail as if staff had done it in the UI (CLAUDE.md rule 5). The
 * actions are attributed to the DEMO placeholder accounts (demo.<role>@
 * example.com, display names Cathy/Jose/Joana/David), never to a real person.
 * Tasks are ASSIGNED to the real team members so they show under "Mis tareas".
 *
 * WHAT IT NEVER TOUCHES: any other study (the real CLP study shares this
 * database), recruitment settings, users, roles, automation rules.
 *
 * Arms are recorded as outcomes from an imaginary external allocation, like
 * every allocation in this system; nothing here or in the app allocates.
 *
 * Idempotent: a person (by email) or cohort (by code) that exists is reused,
 * and steps already taken are skipped, so a re-run after a failure continues.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  // Imported after the env is loaded: these modules read it.
  const { scriptEnvSchema, isDemoDataAllowed } = await import("@/config/env-schema");
  const env = scriptEnvSchema.parse(process.env);
  if (!isDemoDataAllowed(env)) {
    throw new Error("Refusing: set ALLOW_DEMO_DATA=true and ensure APP_ENV is not production.");
  }

  const { and, desc, eq, inArray, isNull } = await import("drizzle-orm");
  const { getDb } = await import("@/db/client");
  const s = await import("@/db/schema");
  const { normalizeEmail } = await import("@/domain/recruitment");
  const { parseStudyLocal } = await import("@/lib/study-time");
  const rec = await import("@/services/recruitment");
  const ops = await import("@/services/participant-ops");
  const coh = await import("@/services/cohorts");
  const stages = await import("@/services/program-stages");
  const ses = await import("@/services/sessions");
  const log = await import("@/services/logistics");
  const auto = await import("@/services/automation");
  const inq = await import("@/services/inquiries");

  const db = getDb();

  // --- Context ---------------------------------------------------------------

  const [study] = await db.select().from(s.studies).where(eq(s.studies.code, "DEMO")).limit(1);
  if (!study) throw new Error("No DEMO study. Run npm run db:seed first.");
  const studyId = study.id;
  const tz = study.timezone;

  const placeholder = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(inArray(s.users.email, ["demo.admin@example.com", "demo.study-manager@example.com", "demo.facilitator@example.com", "demo.logistics@example.com"]));
  const actor = (email: string) => {
    const u = placeholder.find((p) => p.email === email);
    if (!u) throw new Error(`Placeholder account ${email} missing. Run npm run db:seed once.`);
    return u.id;
  };
  const MANAGER = actor("demo.study-manager@example.com"); // "Jose"
  const FACILITATOR = actor("demo.facilitator@example.com"); // "Joana"
  const LOGISTICS = actor("demo.logistics@example.com"); // "David"

  // Real team members with a live DEMO role: assignees for tasks, never actors.
  const team = await db
    .selectDistinct({ id: s.users.id, name: s.users.displayName })
    .from(s.userRoles)
    .innerJoin(s.users, eq(s.users.id, s.userRoles.userId))
    .where(and(eq(s.userRoles.studyId, studyId), isNull(s.userRoles.revokedAt), eq(s.users.active, true)));
  const assignee = (i: number) => (team.length ? team[i % team.length].id : null);

  const arms = await db.select().from(s.studyArms).where(eq(s.studyArms.studyId, studyId));
  const armId = (code: string) => {
    const a = arms.find((x) => x.code === code);
    if (!a) throw new Error(`Arm ${code} missing in DEMO`);
    return a.id;
  };
  const INTV = armId("INTV");
  const CNTRL = armId("CNTRL");

  const templates = await db
    .select()
    .from(s.sessionTemplates)
    .where(and(eq(s.sessionTemplates.studyId, studyId), eq(s.sessionTemplates.active, true)))
    .orderBy(s.sessionTemplates.position);
  const stageRows = await db.select().from(s.programStages).where(eq(s.programStages.studyId, studyId));
  const reasons = await db.select().from(s.eligibilityReasons).where(eq(s.eligibilityReasons.studyId, studyId));
  const reasonId = (code: string) => reasons.find((r) => r.code === code)?.id ?? null;

  // --- Time helpers (study timezone) -----------------------------------------

  const today = new Date();
  /** `days` from today at hh:mm in the study's timezone. */
  const at = (days: number, hh = 18, mm = 0): Date => {
    const d = new Date(today.getTime() + days * 86_400_000);
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    return parseStudyLocal(`${local}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, tz) as Date;
  };
  const isoDate = (days: number) => at(days, 12).toISOString().slice(0, 10);

  const step = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      // Already-done steps on a re-run are expected; anything else is reported.
      if (/already|Conflict|InvalidTransition/i.test(msg)) console.log(`  skip  ${label} (${msg})`);
      else throw new Error(`${label}: ${msg}`);
    }
  };

  // --- People ----------------------------------------------------------------

  let phoneSeq = 100;
  async function person(first: string, last: string, appliedDaysAgo: number) {
    const email = `demo.${normalizeEmail(`${first}.${last}`).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z.]/g, "")}@example.com`;
    const existing = await db
      .select({ id: s.participantContacts.participantId })
      .from(s.participantContacts)
      .where(and(eq(s.participantContacts.studyId, studyId), eq(s.participantContacts.emailNormalized, normalizeEmail(email))))
      .limit(1);
    if (!existing[0]) {
      await rec.submitInterest({
        studyId,
        locale: "es",
        firstName: first,
        lastName: last,
        fullName: `${first} ${last}`,
        email,
        phone: `+34 600 0${String(phoneSeq).slice(-2)} ${String(phoneSeq * 7).padStart(3, "0").slice(-3)}`,
      });
    }
    phoneSeq++;
    const [c] = await db
      .select({ id: s.participantContacts.participantId })
      .from(s.participantContacts)
      .where(and(eq(s.participantContacts.studyId, studyId), eq(s.participantContacts.emailNormalized, normalizeEmail(email))))
      .limit(1);
    const [app] = await db
      .select({ id: s.applications.id, status: s.applications.status })
      .from(s.applications)
      .where(eq(s.applications.participantId, c.id))
      .orderBy(desc(s.applications.submittedAt))
      .limit(1);
    if (!existing[0] && app) {
      // When they applied, so the funnel isn't all "today". A timestamp only:
      // not a research- or permission-relevant change, so not audited.
      await db.update(s.applications).set({ submittedAt: at(-appliedDaysAgo, 11) }).where(eq(s.applications.id, app.id));
    }
    return { participantId: c.id, applicationId: app?.id ?? null, name: `${first} ${last}` };
  }

  type P = Awaited<ReturnType<typeof person>>;

  async function participantState(p: P) {
    const [row] = await db
      .select({ elig: s.participants.eligibilityStatus, enr: s.participants.enrollmentStatus })
      .from(s.participants)
      .where(eq(s.participants.id, p.participantId));
    const [app] = p.applicationId
      ? await db.select({ status: s.applications.status }).from(s.applications).where(eq(s.applications.id, p.applicationId))
      : [];
    return { ...row, app: app?.status ?? null };
  }

  async function moveApplication(p: P, to: "IN_REVIEW" | "ACCEPTED_FOR_SCREENING" | "NOT_PURSUED") {
    if (!p.applicationId) return;
    const st = await participantState(p);
    if (st.app === to) return;
    if (to === "ACCEPTED_FOR_SCREENING" && st.app === "SUBMITTED") {
      await step(`${p.name} in review`, () =>
        rec.setApplicationStatus({ studyId, applicationId: p.applicationId!, actorId: MANAGER, status: "IN_REVIEW" }),
      );
    }
    await step(`${p.name} → ${to}`, () =>
      rec.setApplicationStatus({ studyId, applicationId: p.applicationId!, actorId: MANAGER, status: to }),
    );
  }

  /** Screening booked (and, with a result, held) `daysAgo` days ago. */
  async function screen(
    p: P,
    when: Date,
    result?: "ELIGIBLE" | "INELIGIBLE" | "REVIEW_REQUIRED",
    reason?: string,
    note?: string,
  ) {
    await moveApplication(p, "ACCEPTED_FOR_SCREENING");
    const st = await participantState(p);
    if (st.elig !== "PENDING") return; // already determined on an earlier run
    const [open] = await db
      .select({ id: s.screenings.id })
      .from(s.screenings)
      .where(and(eq(s.screenings.participantId, p.participantId), eq(s.screenings.status, "SCHEDULED")))
      .limit(1);
    const screeningId =
      open?.id ?? (await ops.scheduleScreening({ studyId, participantId: p.participantId, actorId: MANAGER, scheduledAt: when }));
    if (result) {
      await step(`${p.name} screening ${result}`, () =>
        ops.completeScreening({
          studyId,
          screeningId,
          actorId: MANAGER,
          result,
          completedAt: new Date(when.getTime() + 45 * 60_000),
          reasonId: reason ? reasonId(reason) : null,
          reasonNote: note ?? null,
        }),
      );
    }
    return screeningId;
  }

  let allocationSeq = 1;
  async function allocate(p: P, arm: string, when: Date) {
    const st = await participantState(p);
    const ref = `DEMO-ALEA-${String(allocationSeq++).padStart(4, "0")}`;
    if (st.enr === "RANDOMIZED" || st.enr === "COHORT_ASSIGNED" || st.enr === "COMPLETED" || st.enr === "WITHDRAWN") return;
    await step(`${p.name} allocated`, () =>
      coh.recordRandomization({ studyId, participantId: p.participantId, actorId: MANAGER, armId: arm, allocatedAt: when, externalRecordId: ref }),
    );
  }

  async function cohort(params: {
    code: string;
    name: string;
    arm: string;
    start: number;
    end: number;
    min: number;
    max: number;
    pairedWith?: string | null;
  }): Promise<string> {
    const [found] = await db
      .select({ id: s.cohorts.id })
      .from(s.cohorts)
      .where(and(eq(s.cohorts.studyId, studyId), eq(s.cohorts.code, params.code)))
      .limit(1);
    if (found) return found.id;
    return coh.createCohort({
      studyId,
      actorId: MANAGER,
      code: params.code,
      name: params.name,
      plannedStartDate: isoDate(params.start),
      plannedEndDate: isoDate(params.end),
      armId: params.arm,
      minSize: params.min,
      maxSize: params.max,
      pairedCohortId: params.pairedWith ?? null,
    });
  }

  async function advanceTo(cohortId: string, target: string) {
    const order = ["PLANNING", "RECRUITING", "PREPARATION", "ACTIVE", "INTEGRATION", "FOLLOW_UP", "COMPLETED"] as const;
    const [c] = await db.select({ status: s.cohorts.status }).from(s.cohorts).where(eq(s.cohorts.id, cohortId));
    for (let i = order.indexOf(c.status) + 1; i <= order.indexOf(target as (typeof order)[number]); i++) {
      await step(`cohort → ${order[i]}`, () =>
        coh.advanceCohortStatus({ studyId, cohortId, actorId: MANAGER, status: order[i] }),
      );
    }
  }

  async function place(cohortId: string, members: P[], arm: string, allocatedDaysAgo: number) {
    for (const p of members) {
      await screen(p, at(-allocatedDaysAgo - 7, 17), "ELIGIBLE");
      await allocate(p, arm, at(-allocatedDaysAgo, 10));
      await step(`${p.name} placed`, () => coh.assignToCohort({ studyId, cohortId, participantId: p.participantId, actorId: MANAGER }));
    }
  }

  async function setStage(cohortId: string, stageName: string) {
    const st = stageRows.find((x) => x.nameEs === stageName);
    if (st) await stages.setCohortStage({ studyId, cohortId, actorId: FACILITATOR, stageId: st.id });
  }

  /** One session per template, on the given day offsets. Returns session ids. */
  async function sessions(cohortId: string, dayOffsets: number[], location: string): Promise<string[]> {
    const existing = await db
      .select({ id: s.cohortSessions.id, templateId: s.cohortSessions.templateId })
      .from(s.cohortSessions)
      .where(eq(s.cohortSessions.cohortId, cohortId));
    const ids: string[] = [];
    for (let i = 0; i < dayOffsets.length && i < templates.length; i++) {
      const tpl = templates[i];
      const done = existing.find((e) => e.templateId === tpl.id);
      if (done) {
        ids.push(done.id);
        continue;
      }
      ids.push(
        await ses.scheduleSession({
          studyId,
          cohortId,
          actorId: FACILITATOR,
          name: tpl.nameEs,
          modality: tpl.modality,
          scheduledStart: at(dayOffsets[i], tpl.modality === "ZOOM" ? 19 : 18, 30),
          durationMinutes: tpl.modality === "VR" ? 120 : 90,
          location: tpl.modality === "ZOOM" ? "Zoom (enlace en el mensaje)" : location,
          templateId: tpl.id,
        }),
      );
    }
    return ids;
  }

  async function hold(sessionId: string, members: P[], exceptions: Record<string, "ABSENT" | "LATE" | "EXCUSED" | "TECHNICAL_FAILURE"> = {}) {
    for (const p of members) {
      await step(`attendance ${p.name}`, () =>
        ses.recordAttendance({ studyId, sessionId, participantId: p.participantId, actorId: FACILITATOR, status: exceptions[p.name] ?? "ATTENDED" }),
      );
    }
    await step("session held", () => ses.setSessionStatus({ studyId, sessionId, actorId: FACILITATOR, status: "HELD" }));
  }

  // --- 1. Spring pilot: finished --------------------------------------------

  console.log("PIL-01  spring pilot (completed)");
  const pilot = [
    await person("Marta", "Ibáñez", 230),
    await person("Sergio", "Lozano", 228),
    await person("Nuria", "Castells", 226),
    await person("Álvaro", "Peña", 225),
    await person("Inés", "Robles", 224),
    await person("Tomás", "Vidal", 222),
  ];
  const PIL = await cohort({ code: "PIL-01", name: "Cohorte piloto · primavera", arm: INTV, start: -200, end: -140, min: 5, max: 8 });
  await place(PIL, pilot, INTV, 205);
  await advanceTo(PIL, "ACTIVE");
  const pilSessions = await sessions(PIL, [-200, -193, -186, -179, -172, -165, -151], "Centro de estudios (demo), Madrid");
  for (const [i, id] of pilSessions.entries()) {
    await hold(id, pilot, i === 3 ? { "Inés Robles": "EXCUSED" } : i === 4 ? { "Sergio Lozano": "LATE" } : {});
  }
  await setStage(PIL, "Integración grupal");
  await advanceTo(PIL, "COMPLETED");
  for (const p of pilot) {
    const st = await participantState(p);
    if (st.enr === "COHORT_ASSIGNED") {
      await step(`${p.name} completed`, () =>
        ops.setEnrollmentStatus({ studyId, participantId: p.participantId, actorId: MANAGER, status: "COMPLETED" }),
      );
    }
  }

  // --- 2. Autumn intervention + paired control: mid-programme --------------

  console.log("OTO-01  autumn intervention (active) + OTO-01-C control");
  const autumn = [
    await person("Lucía", "Herrera", 60),
    await person("Pablo", "Moreno", 58),
    await person("Carmen", "Soler", 57),
    await person("Diego", "Navarro", 55),
    await person("Elena", "Ruiz", 54),
    await person("Javier", "Ortega", 52),
    await person("Rocío", "Campos", 50),
    await person("Andrés", "Gil", 49),
  ];
  const autumnControl = [
    await person("Beatriz", "Romero", 59),
    await person("Hugo", "Medina", 58),
    await person("Paula", "Vega", 56),
    await person("Raúl", "Domínguez", 55),
    await person("Sara", "Iglesias", 53),
    await person("Iván", "Cortés", 51),
    await person("Laura", "Méndez", 50),
    await person("Óscar", "Prieto", 48),
  ];
  const OTO = await cohort({ code: "OTO-01", name: "Cohorte otoño · Madrid", arm: INTV, start: -27, end: 36, min: 6, max: 10 });
  const OTOC = await cohort({ code: "OTO-01-C", name: "Grupo control · otoño", arm: CNTRL, start: -27, end: 36, min: 6, max: 10, pairedWith: OTO });
  await place(OTO, autumn, INTV, 35);
  await place(OTOC, autumnControl, CNTRL, 35);
  await advanceTo(OTO, "ACTIVE");
  await advanceTo(OTOC, "ACTIVE");
  // S0 four weeks ago, S1 three, S2 last week; S3 in a week; the rest after.
  const otoSessions = await sessions(OTO, [-27, -20, -6, 8, 15, 22, 36], "Centro de estudios (demo), Madrid");
  await hold(otoSessions[0], autumn, { "Andrés Gil": "EXCUSED" });
  await hold(otoSessions[1], autumn, { "Rocío Campos": "LATE" });
  await hold(otoSessions[2], autumn, { "Diego Navarro": "TECHNICAL_FAILURE" });
  await setStage(OTO, "Cuerpos de luz");
  // One control participant withdrew (no reason is stored: it's not ours to keep).
  const laura = autumnControl[6];
  if ((await participantState(laura)).enr === "COHORT_ASSIGNED") {
    await ops.setEnrollmentStatus({ studyId, participantId: laura.participantId, actorId: MANAGER, status: "WITHDRAWN" });
  }

  // --- 3. Winter: still filling ---------------------------------------------

  console.log("INV-01  winter (recruiting) + INV-01-C control");
  const winter = [
    await person("Clara", "Fuentes", 20),
    await person("Mario", "Blanco", 18),
    await person("Alba", "Serrano", 16),
    await person("Rubén", "Molina", 15),
    await person("Irene", "Pascual", 13),
  ];
  const winterControl = [
    await person("Daniel", "Rubio", 19),
    await person("Noelia", "Marín", 17),
    await person("Gonzalo", "Sanz", 14),
    await person("Celia", "Ferrer", 12),
  ];
  const INV = await cohort({ code: "INV-01", name: "Cohorte invierno · Madrid", arm: INTV, start: 63, end: 126, min: 6, max: 10 });
  const INVC = await cohort({ code: "INV-01-C", name: "Grupo control · invierno", arm: CNTRL, start: 63, end: 126, min: 6, max: 10, pairedWith: INV });
  await place(INV, winter, INTV, 6);
  await place(INVC, winterControl, CNTRL, 6);
  await advanceTo(INV, "RECRUITING");
  await sessions(INV, [63, 70], "Centro de estudios (demo), Madrid");

  // --- 4. The recruitment funnel --------------------------------------------

  console.log("funnel  applications, screenings, determinations");
  const waiting = [await person("Adrián", "Calvo", 11), await person("Silvia", "Garrido", 10)];
  for (const p of waiting) await screen(p, at(-4, 17), "ELIGIBLE");

  const review = await person("Marcos", "León", 9);
  await screen(review, at(-3, 18), "REVIEW_REQUIRED", "FALTA_INFORMACION", "Pendiente de confirmar disponibilidad en enero.");

  const notEligible = [await person("Teresa", "Arias", 14), await person("Jorge", "Esteban", 13)];
  await screen(notEligible[0], at(-8, 17), "INELIGIBLE", "NO_CUMPLE_CRITERIOS");
  await screen(notEligible[1], at(-7, 18), "INELIGIBLE", "DISPONIBILIDAD");

  const upcoming = [
    [await person("Patricia", "Lorenzo", 6), 2, 17],
    [await person("Fernando", "Rey", 5), 3, 18],
    [await person("Lorena", "Santos", 4), 5, 11],
  ] as const;
  for (const [p, days, hh] of upcoming) await screen(p, at(days, hh));

  const noShow = await person("Víctor", "Crespo", 8);
  const noShowScreening = await screen(noShow, at(-2, 18));
  if (noShowScreening) {
    await step("no-show", () => ops.closeScreening({ studyId, screeningId: noShowScreening, actorId: MANAGER, status: "NO_SHOW" }));
  }

  for (const [first, last, d] of [["Natalia", "Vargas", 4], ["Alberto", "Cano", 3], ["Miriam", "Bravo", 3]] as const) {
    await moveApplication(await person(first, last, d), "IN_REVIEW");
  }
  for (const [first, last, d] of [["Esteban", "Flores", 12], ["Rosa", "Carrasco", 10]] as const) {
    await moveApplication(await person(first, last, d), "NOT_PURSUED");
  }
  for (const [first, last, d] of [["Sofía", "Delgado", 2], ["Manuel", "Pastor", 1], ["Eva", "Gallego", 1], ["Ricardo", "Nieto", 0], ["Aitana", "Mora", 0]] as const) {
    await person(first, last, d); // just applied
  }

  // --- 5. Headsets -----------------------------------------------------------

  console.log("logistics  headsets");
  const deviceCodes = Array.from({ length: 9 }, (_, i) => `VR-DEMO-${String(i + 4).padStart(2, "0")}`);
  const deviceIds = new Map<string, string>();
  for (const code of deviceCodes) {
    const [d] = await db.select({ id: s.devices.id }).from(s.devices).where(and(eq(s.devices.studyId, studyId), eq(s.devices.code, code))).limit(1);
    deviceIds.set(code, d?.id ?? (await log.createDevice({ studyId, actorId: LOGISTICS, code, model: "Meta Quest 3 (demo)", serial: `DEMO-SN-${code.slice(-2)}` })));
  }
  async function handOut(code: string, p: P, expectedReturnDays: number, final: "ACTIVE" | "RETURN_REQUESTED" | "RETURNED") {
    const deviceId = deviceIds.get(code)!;
    const [open] = await db
      .select({ id: s.deviceAssignments.id })
      .from(s.deviceAssignments)
      .where(and(eq(s.deviceAssignments.deviceId, deviceId), isNull(s.deviceAssignments.closedAt)))
      .limit(1);
    const [any] = await db.select({ id: s.deviceAssignments.id }).from(s.deviceAssignments).where(eq(s.deviceAssignments.deviceId, deviceId)).limit(1);
    if (any && !open) return; // done on an earlier run
    const assignmentId =
      open?.id ??
      (await log.assignDevice({ studyId, deviceId, participantId: p.participantId, actorId: LOGISTICS, expectedReturnAt: at(expectedReturnDays, 0, 0) }));
    await step(`${code} preparing`, () => log.setDeviceStatus({ studyId, deviceId, actorId: LOGISTICS, status: "PREPARING" }));
    await step(`${code} handed over`, () => log.recordAssignmentMilestone({ studyId, assignmentId, actorId: LOGISTICS, milestone: "HANDED_OVER", deviceStatus: "DELIVERED" }));
    await step(`${code} in use`, () => log.recordAssignmentMilestone({ studyId, assignmentId, actorId: LOGISTICS, milestone: "RECEIVED", deviceStatus: "ACTIVE" }));
    if (final === "ACTIVE") return assignmentId;
    await step(`${code} return requested`, () => log.setDeviceStatus({ studyId, deviceId, actorId: LOGISTICS, status: "RETURN_REQUESTED" }));
    if (final === "RETURN_REQUESTED") return assignmentId;
    await step(`${code} returned`, () => log.recordAssignmentMilestone({ studyId, assignmentId, actorId: LOGISTICS, milestone: "RETURNED", deviceStatus: "RETURNED" }));
    await step(`${code} closed`, () => log.closeAssignment({ studyId, assignmentId, actorId: LOGISTICS }));
    await step(`${code} cleaning`, () => log.setDeviceStatus({ studyId, deviceId, actorId: LOGISTICS, status: "CLEANING" }));
    await step(`${code} available`, () => log.setDeviceStatus({ studyId, deviceId, actorId: LOGISTICS, status: "AVAILABLE" }));
    return assignmentId;
  }
  // Pilot: two came back, one is still out long after the programme ended.
  await handOut("VR-DEMO-04", pilot[0], -140, "RETURNED");
  await handOut("VR-DEMO-05", pilot[1], -140, "RETURNED");
  await handOut("VR-DEMO-06", pilot[5], -140, "RETURN_REQUESTED");
  // Autumn: in use until the programme ends.
  const autumnDevices = ["VR-DEMO-07", "VR-DEMO-08", "VR-DEMO-09", "VR-DEMO-10", "VR-DEMO-11", "VR-DEMO-12"];
  const assignments = new Map<string, string | undefined>();
  for (const [i, code] of autumnDevices.entries()) assignments.set(code, await handOut(code, autumn[i], 38, "ACTIVE"));
  // Diego's headset dropped the connection in S2 (his attendance says so too).
  const [incident] = await db.select({ id: s.deviceIncidents.id }).from(s.deviceIncidents).where(eq(s.deviceIncidents.deviceId, deviceIds.get("VR-DEMO-10")!)).limit(1);
  if (!incident) {
    await log.reportIncident({
      studyId,
      deviceId: deviceIds.get("VR-DEMO-10")!,
      assignmentId: assignments.get("VR-DEMO-10") ?? null,
      actorId: LOGISTICS,
      kind: "CONNECTIVITY",
      description: "Se desconecta de la wifi durante la sesión. Probar con el router de la sala.",
    });
  }
  await auto.raiseAlert({
    studyId,
    kind: "DEVICE_RETURN_OVERDUE",
    subject: { kind: "DEVICE", id: deviceIds.get("VR-DEMO-06")! },
    detail: "VR-DEMO-06 sigue fuera desde la cohorte piloto.",
  });

  // --- 6. Team work: tasks, notes, questions --------------------------------

  console.log("team  tasks, notes, inquiries");
  const openTasks = await db.select({ title: s.tasks.titleEs }).from(s.tasks).where(eq(s.tasks.studyId, studyId));
  const has = (t: string) => openTasks.some((x) => x.title === t);
  const tasks: { title: string; days: number; priority: "LOW" | "NORMAL" | "HIGH"; cohortId?: string; participant?: P }[] = [
    { title: "Confirmar la sala para S3 · Vida (OTO-01)", days: 5, priority: "HIGH", cohortId: OTO },
    { title: "Recoger el visor VR-DEMO-06 de la cohorte piloto", days: -3, priority: "HIGH", participant: pilot[5] },
    { title: "Probar el visor de Diego con el router de la sala", days: 2, priority: "NORMAL", participant: autumn[3] },
    { title: "Llamar a Marcos para aclarar su disponibilidad", days: 1, priority: "NORMAL", participant: review },
    { title: "Preparar seis visores para la cohorte de invierno", days: 45, priority: "LOW", cohortId: INV },
    { title: "Enviar el enlace de la evaluación a Patricia", days: 1, priority: "NORMAL", participant: upcoming[0][0] },
  ];
  for (const [i, t] of tasks.entries()) {
    if (has(t.title)) continue;
    await auto.createTask({
      studyId,
      actorId: MANAGER,
      titleEs: t.title,
      priority: t.priority,
      dueAt: at(t.days, 23, 59),
      assignedTo: assignee(i),
      participantId: t.participant?.participantId ?? null,
      cohortId: t.cohortId ?? null,
    });
  }

  const notes = await db.select({ body: s.cohortNotes.body }).from(s.cohortNotes).where(inArray(s.cohortNotes.cohortId, [OTO, INV]));
  const notesToAdd = [
    { cohortId: OTO, color: "MINT" as const, body: "Sala reservada los lunes hasta diciembre. Llevar alargadores para los visores." },
    { cohortId: OTO, color: "LILAC" as const, body: "Rocío llega desde Alcalá: confirmar que el horario de S3 le sigue cuadrando." },
    { cohortId: INV, color: "PEACH" as const, body: "Falta una persona para el mínimo. Revisar elegibles en espera de asignación." },
  ];
  for (const n of notesToAdd) {
    if (!notes.some((x) => x.body === n.body)) await coh.createCohortNote({ studyId, actorId: FACILITATOR, ...n });
  }

  const questions = [
    { name: "Carlos (demo)", email: "demo.consulta1@example.com", message: "¿Hace falta experiencia previa con realidad virtual para participar?" },
    { name: "Ana (demo)", email: "demo.consulta2@example.com", message: "¿Las sesiones presenciales son siempre en Madrid o hay otras ciudades?" },
    { name: "Luis (demo)", email: "demo.consulta3@example.com", message: "Me inscribí la semana pasada y no he recibido nada. ¿Es normal?" },
  ];
  const existingQ = await db.select({ email: s.inquiries.email }).from(s.inquiries).where(eq(s.inquiries.studyId, studyId));
  for (const q of questions) {
    if (!existingQ.some((x) => x.email === q.email)) await inq.submitInquiry({ studyId, locale: "es", input: q });
  }

  // Let the app's own checks raise whatever alerts this state deserves.
  const swept = await auto.runSweeps({ studyId });
  console.log(`sweeps  raised ${swept.raised}`, swept.kinds);
  console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
