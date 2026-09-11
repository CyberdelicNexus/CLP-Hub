/**
 * Development seed. SYNTHETIC DATA ONLY.
 *
 * Creates one DEMO study, one obviously fake staff account per role, an
 * operational application form configuration, and a few obviously fake
 * applications.
 * Refuses to run unless ALLOW_DEMO_DATA=true and APP_ENV is not production.
 * Idempotent: safe to re-run.
 *
 * Usage: npm run db:seed   (requires .env.local with SUPABASE_SERVICE_ROLE_KEY)
 */
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull, sql } from "drizzle-orm";
import postgres from "postgres";
import { recordAuditEvent } from "@/audit/record";
import { isDemoDataAllowed, scriptEnvSchema } from "@/config/env-schema";
import * as schema from "@/db/schema";
import { formatParticipantCode, normalizeEmail } from "@/domain/recruitment";
import type { ContentBody } from "@/domain/content";
import { STAFF_ROLES, type StaffRole } from "@/domain/roles";
import type { EligibilityReasonCategory } from "@/domain/eligibility-reason";
import type { IntakeTarget } from "@/domain/intake";
import type { EligibilityStatus } from "@/domain/participant-state";

loadEnv({ path: ".env.local" });
loadEnv();

const DEMO_STUDY = {
  code: "DEMO",
  title: "Estudio de demostración (DATOS SINTÉTICOS)",
  timezone: "Europe/Madrid",
  // Where /participar hands people off to screen and consent (D-031). Obviously
  // fake, and example.com is reserved by RFC 2606 so it can never resolve.
  screeningUrl: "https://example.com/demo-screening-sintetico",
} as const;

const DEMO_STAFF: ReadonlyArray<{ email: string; displayName: string; role: StaffRole }> = STAFF_ROLES.map(
  (role) => ({
    email: `demo.${role.toLowerCase().replace("_", "-")}@example.com`,
    displayName: `Demo ${role.replace("_", " ")} (SINTÉTICO)`,
    role,
  }),
);

/**
 * Application form configuration for the DEMO study.
 *
 * OPERATIONAL ONLY (D-014). Nothing here asks about health, symptoms,
 * diagnoses, medication or psychometrics — that is Category C data which must
 * not enter this application (docs/research-data-boundaries.md).
 */
const DEMO_QUESTIONS: ReadonlyArray<typeof schema.applicationQuestions.$inferInsert> = [
  {
    key: "full_name",
    position: 10,
    type: "SHORT_TEXT",
    required: true,
    labelEs: "Nombre y apellidos",
    labelEn: "Full name",
    studyId: "",
  },
  {
    key: "email",
    position: 20,
    type: "EMAIL",
    required: true,
    labelEs: "Correo electrónico",
    labelEn: "Email",
    helpEs: "Lo usaremos únicamente para ponernos en contacto contigo sobre el estudio.",
    helpEn: "We will only use this to contact you about the study.",
    studyId: "",
  },
  {
    key: "phone",
    position: 30,
    type: "PHONE",
    required: false,
    labelEs: "Teléfono (opcional)",
    labelEn: "Phone (optional)",
    studyId: "",
  },
  {
    key: "city",
    position: 40,
    type: "SHORT_TEXT",
    required: false,
    labelEs: "Ciudad",
    labelEn: "City",
    studyId: "",
  },
  {
    key: "availability",
    position: 50,
    type: "MULTI_SELECT",
    required: true,
    options: [
      { value: "mornings", label_es: "Mañanas", label_en: "Mornings" },
      { value: "afternoons", label_es: "Tardes", label_en: "Afternoons" },
      { value: "evenings", label_es: "Noches", label_en: "Evenings" },
      { value: "weekends", label_es: "Fines de semana", label_en: "Weekends" },
    ],
    labelEs: "¿Qué franjas te vienen mejor?",
    labelEn: "Which time slots suit you best?",
    studyId: "",
  },
  {
    key: "referral_source",
    position: 60,
    type: "SELECT",
    required: false,
    options: [
      { value: "web", label_es: "Búsqueda en internet", label_en: "Internet search" },
      { value: "social", label_es: "Redes sociales", label_en: "Social media" },
      { value: "friend", label_es: "Alguien me lo contó", label_en: "Word of mouth" },
      { value: "professional", label_es: "Un profesional me lo recomendó", label_en: "A professional suggested it" },
      { value: "other", label_es: "Otro", label_en: "Other" },
    ],
    labelEs: "¿Cómo conociste el estudio?",
    labelEn: "How did you hear about the study?",
    studyId: "",
  },
  {
    key: "notes",
    position: 70,
    type: "LONG_TEXT",
    required: false,
    labelEs: "¿Hay algo que debamos tener en cuenta para contactarte?",
    labelEn: "Anything we should keep in mind when contacting you?",
    helpEs:
      "Por favor, no incluyas información médica o de salud aquí. Si el estudio la necesita, se recogerá más adelante por los cauces adecuados.",
    helpEn:
      "Please do not include medical or health information here. If the study needs it, it will be collected later through the appropriate channels.",
    studyId: "",
  },
  {
    key: "contact_consent",
    position: 80,
    type: "BOOLEAN",
    required: true,
    labelEs: "Acepto que el equipo del estudio se ponga en contacto conmigo.",
    labelEn: "I agree to be contacted by the study team.",
    studyId: "",
  },
];

/**
 * Synthetic study arms. Labels only — this repository contains no code that
 * allocates anyone to an arm (D-018).
 */
const DEMO_ARMS = [
  {
    code: "DEMO-A",
    nameEs: "Rama A (SINTÉTICA)",
    nameEn: "Arm A (SYNTHETIC)",
    position: 10,
    // Configuration, not a rule in code: this arm's participants also sign in
    // person at the initial visit (D-032). The app never decides this.
    requiresPhysicalConsent: true,
  },
  {
    code: "DEMO-B",
    nameEs: "Rama B (SINTÉTICA)",
    nameEn: "Arm B (SYNTHETIC)",
    position: 20,
    requiresPhysicalConsent: false,
  },
] as const;

/**
 * Synthetic authorizations the in-person consent may grant (Phase 4b).
 *
 * Rows, not columns. "Entrevista" and "documental" are one trial's plan; as
 * boolean columns they would be in every study's schema (non-negotiable 6).
 */
const DEMO_CONSENT_SCOPES = [
  {
    code: "ENTREVISTA",
    labelEs: "Autoriza una entrevista grabada (SINTÉTICO)",
    labelEn: "Authorizes a recorded interview (SYNTHETIC)",
    position: 10,
  },
  {
    code: "DOCUMENTAL",
    labelEs: "Autoriza aparecer en el documental (SINTÉTICO)",
    labelEn: "Authorizes appearing in the documentary (SYNTHETIC)",
    position: 20,
  },
] as const;

const DEMO_COHORT = {
  code: "DEMO-C1",
  name: "Cohorte de demostración (SINTÉTICA)",
  capacity: 12,
} as const;

/**
 * Synthetic programme definition. Session names are configuration rows — this
 * is exactly where a real trial's session names would live, never in code
 * (non-negotiable 6). `armId` is left null: these apply to every arm.
 */
const DEMO_SESSION_TEMPLATES = [
  {
    code: "demo_intro",
    nameEs: "Sesión 1 · Introducción (SINTÉTICA)",
    nameEn: "Session 1 · Introduction (SYNTHETIC)",
    position: 10,
    modality: "IN_PERSON" as const,
    durationMinutes: 90,
    dayOffset: 0,
  },
  {
    code: "demo_vr",
    nameEs: "Sesión 2 · Práctica en RV (SINTÉTICA)",
    nameEn: "Session 2 · VR practice (SYNTHETIC)",
    position: 20,
    modality: "VR" as const,
    durationMinutes: 60,
    dayOffset: 7,
  },
  {
    code: "demo_followup",
    nameEs: "Sesión 3 · Seguimiento (SINTÉTICA)",
    nameEn: "Session 3 · Follow-up (SYNTHETIC)",
    position: 30,
    modality: "ZOOM" as const,
    durationMinutes: 45,
    dayOffset: 21,
  },
] as const;

/**
 * Synthetic study content, published in Spanish so /estudio has real pages.
 * Exercises most block types. Deliberately contains no clinical instruction —
 * it is operational guidance of the kind the real pages will carry.
 */
const DEMO_CONTENT: ReadonlyArray<{
  type: "VR_GUIDE" | "FAQ" | "SESSION_PREPARATION";
  key: string;
  sessionCode: string | null;
  title: string;
  body: ContentBody;
}> = [
  {
    type: "VR_GUIDE",
    key: "preparacion-vr",
    sessionCode: null,
    title: "Preparar tu equipo de realidad virtual (DEMO)",
    body: [
      {
        type: "TEXT",
        md: "Esta guía **sintética** explica cómo dejar el equipo listo antes de una sesión. Si algo no funciona, no pasa nada: puedes escribirnos y lo resolvemos juntos.",
      },
      {
        type: "CHECKLIST",
        title: "Antes de empezar",
        items: [
          "Carga el visor por completo",
          "Busca un espacio despejado de unos dos metros",
          "Ten el móvil cerca por si necesitas escribirnos",
        ],
      },
      { type: "TECHNICAL_STEP", step: 1, title: "Enciende el visor", md: "Mantén pulsado el botón lateral hasta que aparezca el logotipo." },
      { type: "TECHNICAL_STEP", step: 2, title: "Conecta a tu wifi", md: "Elige tu red en la lista y escribe la contraseña con el mando." },
      {
        type: "CALLOUT",
        tone: "WARNING",
        title: "Si te mareas",
        md: "Párate. Quítate el visor y siéntate un momento. No es un fallo tuyo y no afecta a tu participación.",
      },
      {
        type: "SUPPORT_BOX",
        title: "¿Necesitas ayuda?",
        md: "El equipo del estudio puede acompañarte por teléfono mientras lo configuras.",
        contactLabel: "Escribir al equipo",
        contactUrl: "mailto:demo.equipo@example.com",
      },
    ],
  },
  {
    type: "FAQ",
    key: "ayuda",
    sessionCode: null,
    title: "Preguntas frecuentes (DEMO)",
    body: [
      { type: "TEXT", md: "Respuestas sintéticas a las dudas más habituales. Puedes escribirnos siempre que quieras." },
      { type: "TEXT", md: "**¿Puedo dejarlo cuando quiera?**\n\nSí. Participar es voluntario y puedes retirarte en cualquier momento sin dar explicaciones." },
      { type: "TEXT", md: "**¿Quién ve mis datos?**\n\nSolo el equipo del estudio, y cada persona ve únicamente lo que necesita para su trabajo." },
      { type: "BUTTON", label: "Volver al inicio", url: "/" },
    ],
  },
  {
    type: "SESSION_PREPARATION",
    key: "demo-intro-preparacion",
    sessionCode: "demo_intro",
    title: "Cómo prepararte para la primera sesión (DEMO)",
    body: [
      { type: "TEXT", md: "Contenido sintético de demostración. La sesión dura unos 90 minutos." },
      {
        type: "CONTEMPLATION",
        md: "Antes de venir, tómate un momento para pensar qué te gustaría llevarte de esta experiencia.",
      },
      {
        type: "CHECKLIST",
        title: "Trae contigo",
        items: ["Ropa cómoda", "Una botella de agua", "Tus preguntas, si tienes alguna"],
      },
      {
        type: "CALLOUT",
        tone: "INFO",
        md: "Si vas a llegar tarde, avísanos: la sesión empieza a la hora prevista pero podemos ayudarte a incorporarte.",
      },
    ],
  },
];

/**
 * Synthetic exclusion / review reasons (Phase 4a).
 *
 * This is exactly where a real trial's reason wording belongs — a configuration
 * row, never a value in code (non-negotiable 6). Note what each one does NOT
 * say: "no cumple un criterio de inclusión" states that a criterion was not met
 * and never which, so no Category C fact enters the database
 * (docs/research-data-boundaries.md).
 */
const DEMO_REASONS: ReadonlyArray<{
  code: string;
  category: EligibilityReasonCategory;
  labelEs: string;
  labelEn: string;
  appliesTo: EligibilityStatus[];
  position: number;
}> = [
  {
    code: "NO_CUMPLE_CRITERIOS",
    category: "DID_NOT_MEET_CRITERIA",
    labelEs: "No cumple un criterio de inclusión (SINTÉTICO)",
    labelEn: "Does not meet an inclusion criterion (SYNTHETIC)",
    appliesTo: ["INELIGIBLE"],
    position: 10,
  },
  {
    code: "DECLINA_PARTICIPAR",
    category: "DECLINED",
    labelEs: "Prefiere no participar (SINTÉTICO)",
    labelEn: "Prefers not to take part (SYNTHETIC)",
    appliesTo: ["INELIGIBLE"],
    position: 20,
  },
  {
    code: "SIN_CONTACTO",
    category: "UNREACHABLE",
    labelEs: "No se ha podido contactar (SINTÉTICO)",
    labelEn: "Could not be reached (SYNTHETIC)",
    appliesTo: ["INELIGIBLE", "REVIEW_REQUIRED"],
    position: 30,
  },
  {
    code: "DISPONIBILIDAD",
    category: "LOGISTICS",
    labelEs: "Disponibilidad incompatible con el calendario (SINTÉTICO)",
    labelEn: "Availability does not fit the schedule (SYNTHETIC)",
    appliesTo: ["INELIGIBLE", "WAITLIST"],
    position: 40,
  },
  {
    code: "FALTA_INFORMACION",
    category: "OTHER",
    labelEs: "Falta información para decidir (SINTÉTICO)",
    labelEn: "Missing information to decide (SYNTHETIC)",
    appliesTo: ["REVIEW_REQUIRED"],
    position: 50,
  },
  {
    code: "SIN_PLAZA",
    category: "STUDY_CAPACITY",
    labelEs: "Sin plaza en la cohorte actual (SINTÉTICO)",
    labelEn: "No place in the current cohort (SYNTHETIC)",
    appliesTo: ["WAITLIST"],
    position: 60,
  },
];

/**
 * Synthetic Qualtrics field mappings, ALL DISABLED.
 *
 * They exist so the shape of a future read-only integration is visible and
 * testable against anonymized data. Only ANONYMOUS_ID and OPERATIONAL classes
 * appear, because a check constraint refuses anything else outright — an
 * IDENTIFIABLE mapping cannot be inserted here even deliberately.
 */
const DEMO_QUALTRICS_MAPPINGS: ReadonlyArray<{
  sourceField: string;
  sourceClass: "ANONYMOUS_ID" | "OPERATIONAL";
  target: IntakeTarget;
  notes: string;
}> = [
  {
    sourceField: "ResponseId",
    sourceClass: "ANONYMOUS_ID",
    target: "participant.externalRef",
    notes: "Referencia anónima de la respuesta (SINTÉTICO). Desactivado.",
  },
  {
    sourceField: "consentAccepted",
    sourceClass: "OPERATIONAL",
    target: "consent.digitalStatus",
    notes: "Solo el estado del consentimiento, nunca su contenido (SINTÉTICO). Desactivado.",
  },
  {
    sourceField: "finishedAt",
    sourceClass: "OPERATIONAL",
    target: "screening.completedAt",
    notes: "Marca temporal de finalización (SINTÉTICO). Desactivado.",
  },
];

/**
 * People who entered through the Qualtrics route (D-031).
 *
 * NOTE WHAT IS MISSING: no name, no email, no phone. That is the whole point —
 * these records are operable without being identifiable, and the identifiable
 * half stays in Qualtrics. They also give the flow diagram real exclusions to
 * count.
 */
const DEMO_QUALTRICS_INTAKE: ReadonlyArray<{
  externalRef: string;
  result: "ELIGIBLE" | "INELIGIBLE" | "REVIEW_REQUIRED" | "WAITLIST";
  reasonCode: string | null;
  reasonNote: string | null;
}> = [
  { externalRef: "R_demo0000000001", result: "ELIGIBLE", reasonCode: null, reasonNote: null },
  {
    externalRef: "R_demo0000000002",
    result: "INELIGIBLE",
    reasonCode: "NO_CUMPLE_CRITERIOS",
    reasonNote: null,
  },
  {
    externalRef: "R_demo0000000003",
    result: "INELIGIBLE",
    reasonCode: "DISPONIBILIDAD",
    reasonNote: "Solo puede en agosto (nota sintética).",
  },
  {
    externalRef: "R_demo0000000004",
    result: "REVIEW_REQUIRED",
    reasonCode: "FALTA_INFORMACION",
    reasonNote: "Pendiente de confirmar la franja horaria (nota sintética).",
  },
  {
    externalRef: "R_demo0000000005",
    result: "WAITLIST",
    reasonCode: "SIN_PLAZA",
    reasonNote: null,
  },
];

/** Obviously fake applicants. Names and addresses are clearly synthetic. */
const DEMO_APPLICANTS = [
  {
    fullName: "Persona Sintética Uno (DEMO)",
    email: "demo.aplicante1@example.com",
    phone: "+34 600 000 001",
    city: "Ciudad Ficticia",
    availability: ["mornings", "weekends"],
    referral: "web",
    notes: "Registro sintético de demostración.",
    status: "SUBMITTED" as const,
    ops: null,
  },
  {
    fullName: "Persona Sintética Dos (DEMO)",
    email: "demo.aplicante2@example.com",
    phone: "+34 600 000 002",
    city: "Villa Ejemplo",
    availability: ["afternoons"],
    referral: "friend",
    notes: "Registro sintético de demostración.",
    status: "IN_REVIEW" as const,
    ops: null,
  },
  {
    fullName: "Persona Sintética Tres (DEMO)",
    email: "demo.aplicante3@example.com",
    phone: null,
    city: "Pueblo Prueba",
    availability: ["evenings", "weekends"],
    referral: "social",
    notes: null,
    status: "ACCEPTED_FOR_SCREENING" as const,
    // A screening booked but not yet held.
    ops: { screening: "SCHEDULED" as const, result: null, consent: null },
  },
  {
    fullName: "Persona Sintética Cuatro (DEMO)",
    email: "demo.aplicante4@example.com",
    phone: "+34 600 000 004",
    city: "Aldea Simulada",
    availability: ["mornings"],
    referral: "professional",
    notes: null,
    status: "ACCEPTED_FOR_SCREENING" as const,
    // Screened and consented, so the enrolled path has an example too.
    // The external references are obviously fake and carry no clinical content.
    ops: { screening: "COMPLETED" as const, result: "ELIGIBLE" as const, consent: "CONSENTED" as const },
  },
];

async function main() {
  const env = scriptEnvSchema.parse(process.env);
  if (!isDemoDataAllowed(env)) {
    throw new Error("Refusing to seed: set ALLOW_DEMO_DATA=true and ensure APP_ENV is not production.");
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sqlClient = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    // Study. Recruitment is opened so /participar renders its hand-off to the
    // (synthetic) Qualtrics screening rather than the closed state.
    const [study] = await db
      .insert(schema.studies)
      .values({ ...DEMO_STUDY, status: "ACTIVE", recruitmentOpen: true })
      .onConflictDoUpdate({
        target: schema.studies.code,
        set: {
          title: DEMO_STUDY.title,
          recruitmentOpen: true,
          status: "ACTIVE",
          screeningUrl: DEMO_STUDY.screeningUrl,
          // Explicitly off. There is no live mode, and the seed must not be the
          // thing that arms an integration.
          qualtricsMode: "DISABLED",
        },
      })
      .returning();
    console.log(`study   ${study.code} (${study.id})`);

    // Staff
    const staffIds = new Map<StaffRole, string>();
    for (const staff of DEMO_STAFF) {
      const authUserId = await ensureAuthUser(admin, staff.email, env.SEED_STAFF_PASSWORD);
      staffIds.set(staff.role, authUserId);

      await db
        .insert(schema.users)
        .values({ id: authUserId, email: staff.email, displayName: staff.displayName, preferredLocale: "es" })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: { displayName: staff.displayName, active: true },
        });

      const existing = await db
        .select({ id: schema.userRoles.id })
        .from(schema.userRoles)
        .where(
          and(
            eq(schema.userRoles.userId, authUserId),
            eq(schema.userRoles.studyId, study.id),
            eq(schema.userRoles.role, staff.role),
            isNull(schema.userRoles.revokedAt),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.transaction(async (tx) => {
          const [grant] = await tx
            .insert(schema.userRoles)
            .values({ userId: authUserId, studyId: study.id, role: staff.role })
            .returning();
          await recordAuditEvent(tx, {
            studyId: study.id,
            actor: { type: "SYSTEM" },
            action: "user_role.granted",
            entityType: "user_role",
            entityId: grant.id,
            after: { userId: authUserId, role: staff.role },
            metadata: { source: "seed", demo: true },
          });
        });
      }
      console.log(`staff   ${staff.role.padEnd(14)} ${staff.email}`);
    }

    // Study arms and one cohort (Phase 3a). Arms are configuration; nothing in
    // this repository ever allocates anyone to one.
    for (const arm of DEMO_ARMS) {
      await db
        .insert(schema.studyArms)
        .values({ ...arm, studyId: study.id })
        .onConflictDoUpdate({
          target: [schema.studyArms.studyId, schema.studyArms.code],
          set: {
            nameEs: arm.nameEs,
            nameEn: arm.nameEn,
            position: arm.position,
            active: true,
            requiresPhysicalConsent: arm.requiresPhysicalConsent,
          },
        });
    }
    console.log(`arms    ${DEMO_ARMS.length} synthetic arms`);

    // Consent scopes (Phase 4b). Configuration, PHYSICAL only.
    for (const sc of DEMO_CONSENT_SCOPES) {
      await db
        .insert(schema.consentScopes)
        .values({ ...sc, studyId: study.id, consentType: "PHYSICAL" })
        .onConflictDoUpdate({
          target: [schema.consentScopes.studyId, schema.consentScopes.code],
          set: { labelEs: sc.labelEs, labelEn: sc.labelEn, position: sc.position, active: true },
        });
    }
    console.log(`scopes  ${DEMO_CONSENT_SCOPES.length} consent authorizations`);

    const [cohort] = await db
      .insert(schema.cohorts)
      .values({
        studyId: study.id,
        code: DEMO_COHORT.code,
        name: DEMO_COHORT.name,
        status: "RECRUITING",
        capacity: DEMO_COHORT.capacity,
      })
      .onConflictDoUpdate({
        target: [schema.cohorts.studyId, schema.cohorts.code],
        set: { name: DEMO_COHORT.name },
      })
      .returning();
    console.log(`cohort  ${cohort.code} (${cohort.status})`);

    // The facilitator staffs this cohort, which is also what narrows their
    // visibility: without cohorts.read.all they see only cohorts listed here.
    const facilitatorId = staffIds.get("FACILITATOR");
    if (facilitatorId) {
      const [alreadyStaffed] = await db
        .select({ id: schema.cohortStaff.id })
        .from(schema.cohortStaff)
        .where(
          and(
            eq(schema.cohortStaff.cohortId, cohort.id),
            eq(schema.cohortStaff.userId, facilitatorId),
            isNull(schema.cohortStaff.revokedAt),
          ),
        )
        .limit(1);
      if (!alreadyStaffed) {
        await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(schema.cohortStaff)
            .values({ cohortId: cohort.id, userId: facilitatorId })
            .returning();
          await recordAuditEvent(tx, {
            studyId: study.id,
            actor: { type: "SYSTEM" },
            action: "cohort_staff.assigned",
            entityType: "cohort_staff",
            entityId: row.id,
            after: { cohortCode: cohort.code, userId: facilitatorId },
            metadata: { source: "seed", demo: true, grantsCohortVisibility: true },
          });
        });
        console.log(`staff   FACILITATOR -> cohort ${cohort.code}`);
      }
    }

    // Programme definition (Phase 3b). Session names live here, not in code.
    for (const tpl of DEMO_SESSION_TEMPLATES) {
      await db
        .insert(schema.sessionTemplates)
        .values({ ...tpl, studyId: study.id })
        .onConflictDoUpdate({
          target: [schema.sessionTemplates.studyId, schema.sessionTemplates.code],
          set: {
            nameEs: tpl.nameEs,
            nameEn: tpl.nameEn,
            position: tpl.position,
            modality: tpl.modality,
            durationMinutes: tpl.durationMinutes,
            dayOffset: tpl.dayOffset,
            active: true,
          },
        });
    }
    console.log(`program ${DEMO_SESSION_TEMPLATES.length} session templates`);

    // Study content (Phase 5). Published Spanish pages so /estudio works.
    // Content lives in the database, never in the message files (D-009).
    const templateRows = await db
      .select({ id: schema.sessionTemplates.id, code: schema.sessionTemplates.code })
      .from(schema.sessionTemplates)
      .where(eq(schema.sessionTemplates.studyId, study.id));
    const templateId = new Map(templateRows.map((r) => [r.code, r.id]));

    for (const item of DEMO_CONTENT) {
      const sessionTemplateId = item.sessionCode ? (templateId.get(item.sessionCode) ?? null) : null;
      if (item.sessionCode && !sessionTemplateId) continue;

      const [content] = await db
        .insert(schema.contents)
        .values({ studyId: study.id, type: item.type, key: item.key, sessionTemplateId })
        .onConflictDoUpdate({
          target: [schema.contents.studyId, schema.contents.key],
          set: { type: item.type },
        })
        .returning({ id: schema.contents.id });

      const [existingVersion] = await db
        .select({ id: schema.contentVersions.id })
        .from(schema.contentVersions)
        .where(eq(schema.contentVersions.contentId, content.id))
        .limit(1);
      if (existingVersion) continue;

      await db.transaction(async (tx) => {
        const [version] = await tx
          .insert(schema.contentVersions)
          .values({
            contentId: content.id,
            locale: "es",
            versionNumber: 1,
            title: item.title,
            body: item.body,
            status: "PUBLISHED",
            publishedAt: new Date(),
          })
          .returning({ id: schema.contentVersions.id });

        await recordAuditEvent(tx, {
          studyId: study.id,
          actor: { type: "SYSTEM" },
          action: "content_version.published",
          entityType: "content_version",
          entityId: version.id,
          after: { status: "PUBLISHED", versionNumber: 1, key: item.key },
          metadata: { source: "seed", demo: true },
        });
      });
      console.log(`page    /estudio/${item.sessionCode ? `sesiones/${item.sessionCode}/preparacion` : item.key}`);
    }

    // Application form configuration
    for (const q of DEMO_QUESTIONS) {
      await db
        .insert(schema.applicationQuestions)
        .values({ ...q, studyId: study.id })
        .onConflictDoUpdate({
          target: [schema.applicationQuestions.studyId, schema.applicationQuestions.key],
          set: {
            position: q.position,
            type: q.type,
            required: q.required,
            options: q.options ?? null,
            labelEs: q.labelEs,
            labelEn: q.labelEn ?? null,
            helpEs: q.helpEs ?? null,
            helpEn: q.helpEn ?? null,
            active: true,
          },
        });
    }
    console.log(`form    ${DEMO_QUESTIONS.length} questions (operational only)`);

    // Synthetic applications
    const questions = await db
      .select({ id: schema.applicationQuestions.id, key: schema.applicationQuestions.key })
      .from(schema.applicationQuestions)
      .where(eq(schema.applicationQuestions.studyId, study.id));
    const questionId = new Map(questions.map((q) => [q.key, q.id]));

    for (const applicant of DEMO_APPLICANTS) {
      const emailNormalized = normalizeEmail(applicant.email);
      const [already] = await db
        .select({ id: schema.participantContacts.participantId })
        .from(schema.participantContacts)
        .where(
          and(
            eq(schema.participantContacts.studyId, study.id),
            eq(schema.participantContacts.emailNormalized, emailNormalized),
          ),
        )
        .limit(1);
      if (already) {
        console.log(`apply   skip (exists)  ${applicant.email}`);
        continue;
      }

      await db.transaction(async (tx) => {
        const [{ nextval }] = await tx.execute<{ nextval: string }>(
          sql`select nextval('participant_code_seq') as nextval`,
        );
        const code = formatParticipantCode(Number(nextval));

        const [participant] = await tx
          .insert(schema.participants)
          .values({
            studyId: study.id,
            code,
            locale: "es",
            recruitmentStatus: "APPLICATION_SUBMITTED",
          })
          .returning({ id: schema.participants.id });

        await tx.insert(schema.participantContacts).values({
          participantId: participant.id,
          studyId: study.id,
          fullName: applicant.fullName,
          email: applicant.email,
          emailNormalized,
          phone: applicant.phone,
        });

        const [application] = await tx
          .insert(schema.applications)
          .values({
            studyId: study.id,
            participantId: participant.id,
            status: applicant.status,
            // IMPORT, not PUBLIC_FORM: that route is retired (D-031) and no
            // code path — the seed included — creates one any more.
            source: "IMPORT",
            locale: "es",
          })
          .returning({ id: schema.applications.id });

        const answers: (typeof schema.applicationAnswers.$inferInsert)[] = [];
        const push = (key: string, value: string | string[] | boolean | null) => {
          const id = questionId.get(key);
          if (id && value !== null && value !== undefined) {
            answers.push({ applicationId: application.id, questionId: id, value });
          }
        };
        push("full_name", applicant.fullName);
        push("email", applicant.email);
        push("phone", applicant.phone);
        push("city", applicant.city);
        push("availability", applicant.availability);
        push("referral_source", applicant.referral);
        push("notes", applicant.notes);
        push("contact_consent", true);
        if (answers.length > 0) await tx.insert(schema.applicationAnswers).values(answers);

        // Synthetic participant operations (Phase 2).
        // Screening rows carry no clinical content: an appointment, a recorded
        // result, and an obviously fake reference to an external system.
        const ops = applicant.ops;
        if (ops) {
          const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          if (ops.screening === "SCHEDULED") {
            await tx.insert(schema.screenings).values({
              studyId: study.id,
              participantId: participant.id,
              status: "SCHEDULED",
              scheduledAt,
            });
            await tx
              .update(schema.participants)
              .set({ recruitmentStatus: "SCREENING_SCHEDULED" })
              .where(eq(schema.participants.id, participant.id));
          } else if (ops.screening === "COMPLETED" && ops.result) {
            await tx.insert(schema.screenings).values({
              studyId: study.id,
              participantId: participant.id,
              status: "COMPLETED",
              scheduledAt,
              completedAt: new Date(),
              result: ops.result,
              externalRecordId: "DEMO-EXT-0004",
            });
            await tx
              .update(schema.participants)
              .set({ recruitmentStatus: "SCREENING_SCHEDULED", eligibilityStatus: ops.result })
              .where(eq(schema.participants.id, participant.id));
          }

          if (ops.consent === "CONSENTED") {
            await tx.insert(schema.consents).values({
              studyId: study.id,
              participantId: participant.id,
              status: "CONSENTED",
              consentType: "DIGITAL",
              versionLabel: "HIP DEMO v1.0",
              decidedAt: new Date(),
              externalRecordId: "DEMO-CONSENT-0004",
            });
            await tx
              .update(schema.participants)
              .set({ enrollmentStatus: "ENROLLED" })
              .where(eq(schema.participants.id, participant.id));
          }
        }

        await recordAuditEvent(tx, {
          studyId: study.id,
          actor: { type: "SYSTEM" },
          action: "application.submitted",
          entityType: "application",
          entityId: application.id,
          after: { status: applicant.status, participantCode: code, answerCount: answers.length },
          metadata: { source: "seed", demo: true },
        });

        console.log(`apply   ${code}  ${applicant.status.padEnd(22)} ${applicant.email}`);
      });
    }

    // Eligibility reasons (Phase 4a). Configuration: the wording is a row, the
    // CONSORT category it reports under is a fixed enum in the domain.
    for (const r of DEMO_REASONS) {
      await db
        .insert(schema.eligibilityReasons)
        .values({ ...r, studyId: study.id })
        .onConflictDoUpdate({
          target: [schema.eligibilityReasons.studyId, schema.eligibilityReasons.code],
          set: {
            category: r.category,
            labelEs: r.labelEs,
            labelEn: r.labelEn,
            appliesTo: r.appliesTo,
            position: r.position,
            active: true,
          },
        });
    }
    console.log(`reasons ${DEMO_REASONS.length} exclusion / review reasons`);

    // Qualtrics field mappings, all disabled. No transfer is implemented; these
    // rows only make the intended shape of one explicit and reviewable.
    for (const m of DEMO_QUALTRICS_MAPPINGS) {
      await db
        .insert(schema.qualtricsFieldMappings)
        .values({ ...m, studyId: study.id, enabled: false })
        .onConflictDoUpdate({
          target: [schema.qualtricsFieldMappings.studyId, schema.qualtricsFieldMappings.target],
          set: {
            sourceField: m.sourceField,
            sourceClass: m.sourceClass,
            notes: m.notes,
            // Never re-enabled by a re-seed. Arming an integration is a person's
            // decision, not a side effect of running a script.
            enabled: false,
          },
        });
    }
    console.log(`qual    ${DEMO_QUALTRICS_MAPPINGS.length} Qualtrics field mappings (all disabled)`);

    // Participants who entered through Qualtrics. No contact row is written for
    // any of them: that is the boundary this route exists to hold (D-031).
    const reasonRows = await db
      .select({ id: schema.eligibilityReasons.id, code: schema.eligibilityReasons.code })
      .from(schema.eligibilityReasons)
      .where(eq(schema.eligibilityReasons.studyId, study.id));
    const reasonId = new Map(reasonRows.map((r) => [r.code, r.id]));

    for (const intake of DEMO_QUALTRICS_INTAKE) {
      const [already] = await db
        .select({ id: schema.participants.id })
        .from(schema.participants)
        .where(
          and(
            eq(schema.participants.studyId, study.id),
            eq(schema.participants.externalRef, intake.externalRef),
          ),
        )
        .limit(1);
      if (already) {
        console.log(`intake  skip (exists)  ${intake.externalRef}`);
        continue;
      }

      await db.transaction(async (tx) => {
        const [{ nextval }] = await tx.execute<{ nextval: string }>(
          sql`select nextval('participant_code_seq') as nextval`,
        );
        const code = formatParticipantCode(Number(nextval));

        const [participant] = await tx
          .insert(schema.participants)
          .values({
            studyId: study.id,
            code,
            externalRef: intake.externalRef,
            locale: "es",
            recruitmentStatus: "APPLICATION_SUBMITTED",
            eligibilityStatus: intake.result,
          })
          .returning({ id: schema.participants.id });

        const [application] = await tx
          .insert(schema.applications)
          .values({
            studyId: study.id,
            participantId: participant.id,
            status: intake.result === "ELIGIBLE" ? "ACCEPTED_FOR_SCREENING" : "IN_REVIEW",
            source: "QUALTRICS",
            locale: "es",
          })
          .returning({ id: schema.applications.id });

        await tx.insert(schema.screenings).values({
          studyId: study.id,
          participantId: participant.id,
          status: "COMPLETED",
          completedAt: new Date(),
          result: intake.result,
          externalRecordId: intake.externalRef,
          reasonId: intake.reasonCode ? (reasonId.get(intake.reasonCode) ?? null) : null,
          reasonNote: intake.reasonNote,
        });

        await recordAuditEvent(tx, {
          studyId: study.id,
          actor: { type: "SYSTEM" },
          action: "participant.created",
          entityType: "participant",
          entityId: participant.id,
          after: {
            code,
            source: "QUALTRICS",
            externalRef: intake.externalRef,
            eligibilityStatus: intake.result,
          },
          metadata: { source: "seed", demo: true, contactStored: false },
        });

        await recordAuditEvent(tx, {
          studyId: study.id,
          actor: { type: "SYSTEM" },
          action: "application.submitted",
          entityType: "application",
          entityId: application.id,
          after: { source: "QUALTRICS", participantCode: code, answerCount: 0 },
          metadata: { source: "seed", demo: true },
        });

        console.log(`intake  ${code}  ${intake.result.padEnd(16)} ${intake.externalRef}`);
      });
    }

    console.log("\nSeed complete. Sign in at /equipo/login with any demo email and SEED_STAFF_PASSWORD.");
  } finally {
    await sqlClient.end();
  }
}

async function ensureAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { demo: true },
  });
  if (!created.error && created.data.user) return created.data.user.id;

  // Already exists: look it up.
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;
  const found = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) throw created.error ?? new Error(`Could not create or find auth user ${email}`);
  return found.id;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
