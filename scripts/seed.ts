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
import { STAFF_ROLES, type StaffRole } from "@/domain/roles";

loadEnv({ path: ".env.local" });
loadEnv();

const DEMO_STUDY = {
  code: "DEMO",
  title: "Estudio de demostración (DATOS SINTÉTICOS)",
  timezone: "Europe/Madrid",
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
    // Study. Recruitment is opened so the public application form renders.
    const [study] = await db
      .insert(schema.studies)
      .values({ ...DEMO_STUDY, status: "ACTIVE", recruitmentOpen: true })
      .onConflictDoUpdate({
        target: schema.studies.code,
        set: { title: DEMO_STUDY.title, recruitmentOpen: true, status: "ACTIVE" },
      })
      .returning();
    console.log(`study   ${study.code} (${study.id})`);

    // Staff
    for (const staff of DEMO_STAFF) {
      const authUserId = await ensureAuthUser(admin, staff.email, env.SEED_STAFF_PASSWORD);

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
            source: "PUBLIC_FORM",
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
