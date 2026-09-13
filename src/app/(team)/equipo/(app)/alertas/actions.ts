"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { ALERT_DETAIL_MAX_LENGTH } from "@/domain/automation";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { acknowledgeAlert, NotFoundError, resolveAlert } from "@/services/automation";

/**
 * Alert actions (Phase 8).
 *
 * Both are a PERSON'S STATEMENT about a problem the system found. Nothing here
 * raises an alert — that is the processor's job — and nothing resolves one on
 * its own: a sweep that closed its own alerts would erase the record that
 * something was wrong for two weeks.
 *
 * Gated on `alerts.read` rather than a separate manage key. Acknowledging and
 * resolving are what you do with an alert; a role that can see the queue but
 * cannot clear it would leave the queue permanently full.
 */

export type AlertState = {
  error: "forbidden" | "invalid" | "notFound" | "failed" | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): AlertState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate() {
  revalidatePath(`${TEAM_BASE_PATH}/alertas`);
  revalidatePath(TEAM_BASE_PATH);
}

export async function acknowledgeAlertAction(
  _prev: AlertState,
  formData: FormData,
): Promise<AlertState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = uuid.safeParse(formData.get("alertId"));
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "alerts.read");
    await acknowledgeAlert({
      studyId: ctx.study.id,
      alertId: parsed.data,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "alert.acknowledge");
  }

  revalidate();
  return { error: null, ok: true };
}

const resolveSchema = z.object({
  alertId: uuid,
  note: z.string().trim().max(ALERT_DETAIL_MAX_LENGTH).optional(),
});

export async function resolveAlertAction(
  _prev: AlertState,
  formData: FormData,
): Promise<AlertState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = resolveSchema.safeParse({
    alertId: formData.get("alertId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "alerts.read");
    await resolveAlert({
      studyId: ctx.study.id,
      alertId: parsed.data.alertId,
      actorId: ctx.session.userId,
      note: parsed.data.note,
    });
  } catch (err) {
    return fail(err, "alert.resolve");
  }

  revalidate();
  return { error: null, ok: true };
}
