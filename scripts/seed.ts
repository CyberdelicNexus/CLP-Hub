/**
 * Development seed. SYNTHETIC DATA ONLY.
 *
 * Creates one DEMO study and one obviously fake staff account per role.
 * Refuses to run unless ALLOW_DEMO_DATA=true and APP_ENV is not production.
 * Idempotent: safe to re-run.
 *
 * Usage: npm run db:seed   (requires .env.local with SUPABASE_SERVICE_ROLE_KEY)
 */
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { recordAuditEvent } from "@/audit/record";
import { isDemoDataAllowed, scriptEnvSchema } from "@/config/env-schema";
import * as schema from "@/db/schema";
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

async function main() {
  const env = scriptEnvSchema.parse(process.env);
  if (!isDemoDataAllowed(env)) {
    throw new Error("Refusing to seed: set ALLOW_DEMO_DATA=true and ensure APP_ENV is not production.");
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(sql, { schema });

  try {
    // Study
    const [study] = await db
      .insert(schema.studies)
      .values({ ...DEMO_STUDY, status: "ACTIVE" })
      .onConflictDoUpdate({ target: schema.studies.code, set: { title: DEMO_STUDY.title } })
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

    console.log("\nSeed complete. Sign in at /equipo/login with any demo email and SEED_STAFF_PASSWORD.");
  } finally {
    await sql.end();
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
