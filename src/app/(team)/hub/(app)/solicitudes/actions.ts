"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { APPLICATION_STATUSES } from "@/domain/recruitment";
import { logger } from "@/lib/logger";
import {
  DuplicateExternalRefError,
  InvalidExternalRefError,
  InvalidTransitionError,
  recordQualtricsIntake,
  setApplicationStatus,
} from "@/services/recruitment";
import { EXTERNAL_REF_MAX_LENGTH, isValidExternalRef } from "@/domain/intake";

export type StatusActionState = { error: "forbidden" | "invalid" | "failed" | null; ok?: boolean };

const schema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
});

/**
 * Move an application to another triage state.
 *
 * The study is taken from the server-resolved context, never from the form, so
 * a crafted request cannot act on another study. Permission is asserted here
 * and the service records the audit row inside its transaction.
 */
export async function changeApplicationStatus(
  _prev: StatusActionState,
  formData: FormData,
): Promise<StatusActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = schema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "applications.manage");
    await setApplicationStatus({
      studyId: ctx.study.id,
      applicationId: parsed.data.applicationId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      logger.warn(
        { event: "application.status_forbidden", studyId: ctx.study.id },
        "status change refused",
      );
      return { error: "forbidden" };
    }
    if (err instanceof InvalidTransitionError) return { error: "invalid" };
    logger.error(
      { event: "application.status_failed", err: err instanceof Error ? err.message : String(err) },
      "status change failed",
    );
    return { error: "failed" };
  }

  revalidatePath(`${TEAM_BASE_PATH}/solicitudes`);
  revalidatePath(`${TEAM_BASE_PATH}/solicitudes/${parsed.data.applicationId}`);
  return { error: null, ok: true };
}

/**
 * Correct a mistaken status, bypassing the forward-only transition graph
 * `changeApplicationStatus` enforces (D-066). Same permission, same schema —
 * the only difference is `correction: true`, which the service audits under
 * a distinct action so a correction never reads as an ordinary triage step.
 */
export async function correctApplicationStatus(
  _prev: StatusActionState,
  formData: FormData,
): Promise<StatusActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = schema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "applications.manage");
    await setApplicationStatus({
      studyId: ctx.study.id,
      applicationId: parsed.data.applicationId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
      correction: true,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      logger.warn(
        { event: "application.status_correction_forbidden", studyId: ctx.study.id },
        "status correction refused",
      );
      return { error: "forbidden" };
    }
    logger.error(
      {
        event: "application.status_correction_failed",
        err: err instanceof Error ? err.message : String(err),
      },
      "status correction failed",
    );
    return { error: "failed" };
  }

  revalidatePath(`${TEAM_BASE_PATH}/solicitudes`);
  revalidatePath(`${TEAM_BASE_PATH}/solicitudes/${parsed.data.applicationId}`);
  return { error: null, ok: true };
}

/**
 * Same triage move as `changeApplicationStatus`, called directly rather than
 * bound to a `<form>` — for the kanban board's drag-and-drop, which has no
 * FormData to parse. Same permission, same transition check, same audit
 * action; only the calling convention differs.
 */
export async function moveApplicationStatus(
  applicationId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getStudyContext();
  if (!ctx) return { ok: false, error: "forbidden" };

  const parsed = schema.safeParse({ applicationId, status });
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    assertPermission(ctx, "applications.manage");
    await setApplicationStatus({
      studyId: ctx.study.id,
      applicationId: parsed.data.applicationId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    if (err instanceof InvalidTransitionError) return { ok: false, error: "invalid" };
    logger.error(
      { event: "application.status_move_failed", err: err instanceof Error ? err.message : String(err) },
      "kanban status move failed",
    );
    return { ok: false, error: "failed" };
  }

  revalidatePath(`${TEAM_BASE_PATH}/solicitudes`);
  revalidatePath(`${TEAM_BASE_PATH}/solicitudes/${parsed.data.applicationId}`);
  return { ok: true };
}

// --- Qualtrics intake -------------------------------------------------------

export type IntakeActionState = {
  error: "forbidden" | "invalid" | "duplicate" | "failed" | null;
  /** Echoed back so staff can find the person they just created. */
  participantCode?: string;
};

const intakeSchema = z.object({
  // An identifier, never free text. The same check the domain and SQL apply, so
  // a name typed into this box is refused in three places rather than stored.
  externalRef: z.string().trim().max(EXTERNAL_REF_MAX_LENGTH).refine(isValidExternalRef),
});

/**
 * Create a participant from a completed Qualtrics screening (D-031).
 *
 * The ONLY input is the anonymized response reference. There is deliberately no
 * name, email or phone field: the person gave those in Qualtrics after accepting
 * the digital consent, and there is no authorization to copy them here. Contact
 * details are added later, deliberately and audited, by someone who needs them
 * to arrange the initial visit.
 */
export async function recordQualtricsIntakeAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = intakeSchema.safeParse({ externalRef: formData.get("externalRef") });
  if (!parsed.success) return { error: "invalid" };

  let participantCode: string;
  try {
    assertPermission(ctx, "participants.manage");
    const result = await recordQualtricsIntake({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      externalRef: parsed.data.externalRef,
    });
    participantCode = result.participantCode;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      logger.warn({ event: "intake.qualtrics_forbidden", studyId: ctx.study.id }, "intake refused");
      return { error: "forbidden" };
    }
    if (err instanceof DuplicateExternalRefError) return { error: "duplicate" };
    if (err instanceof InvalidExternalRefError) return { error: "invalid" };
    logger.error(
      // The reference itself is not logged: it is the key that ties this record
      // to an identifiable Qualtrics response, and logs are read more widely
      // than the database is.
      { event: "intake.qualtrics_failed", err: err instanceof Error ? err.message : String(err) },
      "intake failed",
    );
    return { error: "failed" };
  }

  revalidatePath(`${TEAM_BASE_PATH}/solicitudes`);
  revalidatePath(`${TEAM_BASE_PATH}/participantes`);
  revalidatePath(TEAM_BASE_PATH);
  return { error: null, participantCode };
}
