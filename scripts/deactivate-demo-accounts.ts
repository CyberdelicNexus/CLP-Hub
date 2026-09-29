/**
 * One-time: deactivate the DEMO study's placeholder staff accounts
 * (2026-09-29 request — "remove all the demo accounts").
 *
 * Their role grants were already revoked in DEMO by scripts/provision-staff.ts
 * ("OLD_DEMO_ROLES"), and they never held one in CLP. But `users.active` was
 * never flipped, and `listStaffWithoutRole` (services/staff.ts) — the "Persona"
 * picker on /equipo/equipo for granting someone a role — lists every active
 * user account regardless of role status. That is why these five kept
 * appearing there for the real CLP study: an account with no live role is
 * still a candidate to grant one to.
 *
 * This sets `users.active = false` for the five demo.<role>@example.com
 * accounts, which is what every staff-picker in the app already filters on
 * (`eq(users.active, true)`). Reversible — flip it back if DEMO is ever
 * presented again and needs its placeholder team to sign in.
 *
 * Does NOT delete the Supabase Auth logins or the DEMO study's synthetic data;
 * this only affects which accounts the real app treats as staff. Run once:
 *
 *   npx tsx scripts/deactivate-demo-accounts.ts
 */
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { recordAuditEvent } from "@/audit/record";
import { scriptEnvSchema } from "@/config/env-schema";
import * as schema from "@/db/schema";
import { STAFF_ROLES } from "@/domain/roles";

loadEnv({ path: ".env.local" });
loadEnv();

/** seed.ts's DEMO_STAFF pattern: demo.<role>@example.com, one per role. */
const DEMO_EMAILS = STAFF_ROLES.map((role) => `demo.${role.toLowerCase().replace("_", "-")}@example.com`);

async function main() {
  const env = scriptEnvSchema.parse(process.env);
  const sqlClient = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const accounts = await db
      .select({ id: schema.users.id, email: schema.users.email, active: schema.users.active })
      .from(schema.users)
      .where(inArray(schema.users.email, DEMO_EMAILS));

    for (const account of accounts) {
      if (!account.active) {
        console.log(`skip    ${account.email} (already inactive)`);
        continue;
      }

      await db.transaction(async (tx) => {
        await tx.update(schema.users).set({ active: false }).where(eq(schema.users.id, account.id));
        await recordAuditEvent(tx, {
          actor: { type: "SYSTEM" },
          action: "user.deactivated",
          entityType: "user",
          entityId: account.id,
          before: { active: true },
          after: { active: false, email: account.email },
          metadata: { source: "deactivate-demo-accounts", reason: "demo placeholder account, no longer needed" },
        });
      });
      console.log(`deactivate ${account.email}`);
    }

    console.log("\nDone.");
  } finally {
    await sqlClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
