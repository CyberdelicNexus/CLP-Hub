"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { STAFF_ROLES } from "@/domain/roles";
import { logger } from "@/lib/logger";
import { DuplicateGrantError, GrantNotFoundError, grantRole, revokeRole } from "@/services/staff";

/**
 * Team membership actions.
 *
 * THESE DO NOT CREATE ACCOUNTS. Staff logins live in Supabase Auth; an
 * application that could mint one would be an account-creation surface sitting
 * behind a single compromised session. Someone is invited there, appears in the
 * list once they exist, and is then granted a role here — which is the part that
 * is this application's business, and the part that is audited (D-044).
 *
 * Both actions need `team.manage`. Reading the list needs only `team.read`,
 * which more roles hold: knowing who is on the study is not the same as being
 * able to change it.
 */

export type TeamState = {
  error: "forbidden" | "invalid" | "notFound" | "duplicate" | "failed" | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): TeamState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof DuplicateGrantError) return { error: "duplicate" };
  if (err instanceof GrantNotFoundError) return { error: "notFound" };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate() {
  revalidatePath(`${TEAM_BASE_PATH}/equipo`);
}

const grantSchema = z.object({ userId: uuid, role: z.enum(STAFF_ROLES) });

export async function grantRoleAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = grantSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "team.manage");
    await grantRole({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      userId: parsed.data.userId,
      role: parsed.data.role,
    });
  } catch (err) {
    return fail(err, "team.grant");
  }

  revalidate();
  return { error: null, ok: true };
}

/**
 * Take a role away.
 *
 * Deliberately NOT guarded against removing your own last grant. A guard would
 * have to decide what "locked out" means across five roles and several studies,
 * and would be wrong somewhere; the honest protection is that the grant is
 * never deleted, so an administrator can restore it and the audit row says who
 * removed it and when.
 */
export async function revokeRoleAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = uuid.safeParse(formData.get("grantId"));
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "team.manage");
    await revokeRole({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      grantId: parsed.data,
    });
  } catch (err) {
    return fail(err, "team.revoke");
  }

  revalidate();
  return { error: null, ok: true };
}
