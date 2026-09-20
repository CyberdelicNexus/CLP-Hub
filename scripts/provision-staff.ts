/**
 * One-time provisioning of real staff accounts (2026-09-19 request).
 *
 * NOT synthetic seed data — rule 9 ("seeds must be obviously fake") is about
 * scripts/seed.ts's demo content. This creates real Supabase Auth logins for
 * real people, using their real email addresses. Run once:
 *
 *   npx tsx scripts/provision-staff.ts
 *
 * (requires .env.local with SUPABASE_SERVICE_ROLE_KEY and SEED_STAFF_PASSWORD,
 * same as db:seed). Idempotent — safe to re-run, but there is no reason to
 * keep re-running it once it has succeeded. Afterward, consider deleting this
 * file or scrubbing the real email addresses below before committing: unlike
 * everything in seed.ts, they are personal data, not synthetic placeholders.
 *
 * Does three things:
 * 1. Creates (or reuses) a real "Clear Light Program" study (code CLP) —
 *    DRAFT, recruitment closed, until the founder is ready to open it.
 * 2. Creates five real Supabase Auth accounts, all on SEED_STAFF_PASSWORD,
 *    and grants each their role in BOTH the existing DEMO study and the new
 *    CLP study — so the study switcher already in the header (Header,
 *    `studies.length > 1`) lets them move between the two once signed in.
 * 3. Revokes the DEMO study's placeholder demo.<role>@example.com grants
 *    that share a first name with one of these five but a DIFFERENT role
 *    (seed.ts's DEMO_PERSON_NAMES was a guess made before the real
 *    assignments were known) — the Supabase Auth accounts themselves are
 *    untouched, only their access to DEMO is revoked.
 */
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { recordAuditEvent } from "@/audit/record";
import { scriptEnvSchema } from "@/config/env-schema";
import * as schema from "@/db/schema";
import type { StaffRole } from "@/domain/roles";

loadEnv({ path: ".env.local" });
loadEnv();

const REAL_STUDY = {
  code: "CLP",
  title: "Clear Light Program",
  timezone: "Europe/Madrid",
} as const;

const REAL_STAFF: ReadonlyArray<{ email: string; displayName: string; role: StaffRole }> = [
  { email: "jose@metanoic.vision", displayName: "Jose", role: "ADMIN" },
  { email: "cathyandreu@gmail.com", displayName: "Cathy", role: "STUDY_MANAGER" },
  { email: "joanajoanavidal@gmail.com", displayName: "Joana", role: "RESEARCHER" },
  { email: "drglowacki@gmail.com", displayName: "David", role: "SUPERVISOR" },
  { email: "jlhardyphd@gmail.com", displayName: "Joe", role: "SUPERVISOR" },
];

/** seed.ts's DEMO_STAFF pattern: demo.<role>@example.com, one per role. */
const OLD_DEMO_ROLES: readonly StaffRole[] = ["ADMIN", "STUDY_MANAGER", "FACILITATOR", "RESEARCHER", "LOGISTICS"];
function demoEmailFor(role: StaffRole): string {
  return `demo.${role.toLowerCase().replace("_", "-")}@example.com`;
}

async function ensureAuthUser(admin: SupabaseClient, email: string, password: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error && created.data.user) return created.data.user.id;

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw list.error;
  const found = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) throw created.error ?? new Error(`Could not create or find auth user ${email}`);
  return found.id;
}

async function main() {
  const env = scriptEnvSchema.parse(process.env);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sqlClient = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const [demoStudy] = await db
      .select({ id: schema.studies.id })
      .from(schema.studies)
      .where(eq(schema.studies.code, "DEMO"))
      .limit(1);
    if (!demoStudy) throw new Error("DEMO study not found — run `npm run db:seed` first.");

    const [clpStudy] = await db
      .insert(schema.studies)
      .values({ ...REAL_STUDY, status: "DRAFT", recruitmentOpen: false })
      .onConflictDoUpdate({ target: schema.studies.code, set: { title: REAL_STUDY.title } })
      .returning();
    console.log(`study   ${clpStudy.code} (${clpStudy.id})`);

    for (const staff of REAL_STAFF) {
      const authUserId = await ensureAuthUser(admin, staff.email, env.SEED_STAFF_PASSWORD);

      await db
        .insert(schema.users)
        .values({ id: authUserId, email: staff.email, displayName: staff.displayName, preferredLocale: "es" })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: { displayName: staff.displayName, email: staff.email, active: true },
        });

      for (const study of [demoStudy, clpStudy]) {
        const [existing] = await db
          .select({ id: schema.userRoles.id })
          .from(schema.userRoles)
          .where(
            and(
              eq(schema.userRoles.studyId, study.id),
              eq(schema.userRoles.userId, authUserId),
              eq(schema.userRoles.role, staff.role),
              isNull(schema.userRoles.revokedAt),
            ),
          )
          .limit(1);

        if (!existing) {
          await db.transaction(async (tx) => {
            const [grant] = await tx
              .insert(schema.userRoles)
              .values({ studyId: study.id, userId: authUserId, role: staff.role })
              .returning();
            await recordAuditEvent(tx, {
              studyId: study.id,
              actor: { type: "SYSTEM" },
              action: "user_role.granted",
              entityType: "user_role",
              entityId: grant.id,
              after: { userId: authUserId, role: staff.role, displayName: staff.displayName },
              metadata: { source: "provision-staff" },
            });
          });
        }
      }
      console.log(`staff   ${staff.role.padEnd(14)} ${staff.displayName.padEnd(8)} ${staff.email}`);
    }

    for (const role of OLD_DEMO_ROLES) {
      const email = demoEmailFor(role);
      const [demoUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (!demoUser) continue;

      const [grant] = await db
        .select({ id: schema.userRoles.id })
        .from(schema.userRoles)
        .where(
          and(
            eq(schema.userRoles.studyId, demoStudy.id),
            eq(schema.userRoles.userId, demoUser.id),
            eq(schema.userRoles.role, role),
            isNull(schema.userRoles.revokedAt),
          ),
        )
        .limit(1);
      if (!grant) continue;

      await db.transaction(async (tx) => {
        await tx.update(schema.userRoles).set({ revokedAt: new Date() }).where(eq(schema.userRoles.id, grant.id));
        await recordAuditEvent(tx, {
          studyId: demoStudy.id,
          actor: { type: "SYSTEM" },
          action: "user_role.revoked",
          entityType: "user_role",
          entityId: grant.id,
          before: { userId: demoUser.id, role },
          after: { revoked: true },
          metadata: { source: "provision-staff", reason: "replaced by real staff account" },
        });
      });
      console.log(`revoke  ${role.padEnd(14)} ${email}`);
    }

    console.log("\nDone. Sign in at /equipo/login with any address above and SEED_STAFF_PASSWORD.");
  } finally {
    await sqlClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
