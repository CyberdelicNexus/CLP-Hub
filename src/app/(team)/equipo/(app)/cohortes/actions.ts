"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { COHORT_CODE_PATTERN, COHORT_NAME_MAX_LENGTH, COHORT_STATUSES } from "@/domain/cohort";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import { logger } from "@/lib/logger";
import {
  advanceCohortStatus,
  assignCohortStaff,
  assignToCohort,
  ConflictError,
  createCohort,
  InvalidTransitionError,
  NotFoundError,
  recordRandomization,
  removeFromCohort,
  revokeCohortStaff,
} from "@/services/cohorts";

/**
 * Phase 3a staff actions. Each resolves the study server-side, asserts its own
 * permission, and delegates to a service that writes with its audit row.
 *
 * `recordRandomizationAction` records an allocation produced elsewhere. It does
 * not choose an arm, and per D-021 it does not refuse on consent or eligibility
 * grounds — the service captures that state in the audit row instead.
 */

export type CohortState = {
  error:
    | "forbidden"
    | "invalid"
    | "badReference"
    | "notFound"
    | "duplicateCode"
    | "alreadyRandomized"
    | "alreadyAssigned"
    | "cohortClosed"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

const externalRecordId = z
  .string()
  .trim()
  .max(EXTERNAL_RECORD_ID_MAX_LENGTH)
  .regex(/^[\w.:/-]*$/)
  .optional()
  .transform((v) => (v ? v : null));

function validationError(issues: readonly { path: PropertyKey[] }[]): CohortState["error"] {
  return issues.some((i) => i.path.includes("externalRecordId")) ? "badReference" : "invalid";
}

function fail(err: unknown, event: string): CohortState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  if (err instanceof ConflictError) return { error: err.reason };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(extra?: string) {
  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  revalidatePath(`${TEAM_BASE_PATH}/participantes`);
  revalidatePath(TEAM_BASE_PATH);
  if (extra) revalidatePath(extra);
}

// --- Cohorts ----------------------------------------------------------------

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => COHORT_CODE_PATTERN.test(v)),
  name: z.string().trim().min(1).max(COHORT_NAME_MAX_LENGTH),
  plannedStartDate: z.string().trim().optional(),
  plannedEndDate: z.string().trim().optional(),
  capacity: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0)),
});

export async function createCohortAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = createSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    plannedStartDate: formData.get("plannedStartDate") ?? undefined,
    plannedEndDate: formData.get("plannedEndDate") ?? undefined,
    capacity: formData.get("capacity") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await createCohort({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      code: parsed.data.code,
      name: parsed.data.name,
      plannedStartDate: parsed.data.plannedStartDate || null,
      plannedEndDate: parsed.data.plannedEndDate || null,
      capacity: parsed.data.capacity,
    });
  } catch (err) {
    return fail(err, "cohort.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const advanceSchema = z.object({ cohortId: uuid, status: z.enum(COHORT_STATUSES) });

export async function advanceCohortAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = advanceSchema.safeParse({
    cohortId: formData.get("cohortId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await advanceCohortStatus({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "cohort.advance");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  return { error: null, ok: true };
}

// --- Cohort staff -----------------------------------------------------------

const staffSchema = z.object({ cohortId: uuid, userId: uuid });

export async function assignStaffAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = staffSchema.safeParse({
    cohortId: formData.get("cohortId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    // Assigning cohort staff also widens what that person can see, so it is
    // gated on cohorts.manage rather than a weaker scheduling permission.
    assertPermission(ctx, "cohorts.manage");
    await assignCohortStaff({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      userId: parsed.data.userId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "cohort_staff.assign");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  return { error: null, ok: true };
}

export async function revokeStaffAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = staffSchema.safeParse({
    cohortId: formData.get("cohortId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await revokeCohortStaff({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      userId: parsed.data.userId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "cohort_staff.revoke");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  return { error: null, ok: true };
}

// --- Allocation and membership ----------------------------------------------

const randomizationSchema = z.object({
  participantId: uuid,
  armId: uuid,
  allocatedAt: z.string().min(1),
  externalRecordId,
});

/**
 * Record an allocation decided elsewhere. This never generates one — see
 * src/domain/randomization.ts.
 */
export async function recordRandomizationAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = randomizationSchema.safeParse({
    participantId: formData.get("participantId"),
    armId: formData.get("armId"),
    allocatedAt: formData.get("allocatedAt"),
    externalRecordId: formData.get("externalRecordId") ?? undefined,
  });
  if (!parsed.success) return { error: validationError(parsed.error.issues) };

  const when = new Date(parsed.data.allocatedAt);
  if (Number.isNaN(when.getTime())) return { error: "invalid" };

  try {
    assertPermission(ctx, "randomization.manage");
    await recordRandomization({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      armId: parsed.data.armId,
      allocatedAt: when,
      externalRecordId: parsed.data.externalRecordId,
    });
  } catch (err) {
    return fail(err, "randomization.record");
  }

  revalidate(`${TEAM_BASE_PATH}/participantes/${parsed.data.participantId}`);
  return { error: null, ok: true };
}

const assignSchema = z.object({ participantId: uuid, cohortId: uuid });

export async function assignToCohortAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = assignSchema.safeParse({
    participantId: formData.get("participantId"),
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await assignToCohort({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "cohort_assignment.create");
  }

  revalidate(`${TEAM_BASE_PATH}/participantes/${parsed.data.participantId}`);
  return { error: null, ok: true };
}

const removeSchema = z.object({ participantId: uuid });

export async function removeFromCohortAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = removeSchema.safeParse({ participantId: formData.get("participantId") });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await removeFromCohort({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "cohort_assignment.remove");
  }

  revalidate(`${TEAM_BASE_PATH}/participantes/${parsed.data.participantId}`);
  return { error: null, ok: true };
}
