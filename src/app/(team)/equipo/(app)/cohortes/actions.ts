"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { COHORT_CODE_PATTERN, COHORT_NAME_MAX_LENGTH, COHORT_STATUSES } from "@/domain/cohort";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import { logger } from "@/lib/logger";
import { NOTE_COLORS } from "@/domain/cohort-note";
import {
  advanceCohortStatus,
  assignCohortStaff,
  assignToCohort,
  CohortSizeError,
  ConflictError,
  createCohort,
  createCohortNote,
  deleteCohortNote,
  InvalidTransitionError,
  NotFoundError,
  recordRandomization,
  removeFromCohort,
  revokeCohortStaff,
  transferToCohort,
} from "@/services/cohorts";
import {
  setCohortStage,
  NotFoundError as StageNotFoundError,
} from "@/services/program-stages";

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
    | "armMismatch"
    | "armNotRecorded"
    | "sameCohort"
    | "sizeUnder"
    | "sizeOver"
    | "failed"
    | null;
  ok?: boolean;
  /**
   * Set when a size check refused the transition, so the form can ask for a
   * confirmation instead of just reporting a failure (D-033).
   */
  size?: { members: number; minSize: number | null; maxSize: number | null };
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
  if (err instanceof NotFoundError || err instanceof StageNotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  if (err instanceof ConflictError) return { error: err.reason };
  if (err instanceof CohortSizeError) {
    return {
      error: err.verdict === "UNDER" ? "sizeUnder" : "sizeOver",
      size: {
        members: err.size.members,
        minSize: err.size.minSize,
        maxSize: err.size.maxSize,
      },
    };
  }
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

/** An optional positive whole number from a text input. */
const positiveIntOrNull = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0));

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => COHORT_CODE_PATTERN.test(v)),
  name: z.string().trim().min(1).max(COHORT_NAME_MAX_LENGTH),
  plannedStartDate: z.string().trim().optional(),
  plannedEndDate: z.string().trim().optional(),
  armId: z.union([uuid, z.literal("")]).optional(),
  minSize: positiveIntOrNull,
  maxSize: positiveIntOrNull,
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
    armId: formData.get("armId") ?? undefined,
    minSize: formData.get("minSize") ?? undefined,
    maxSize: formData.get("maxSize") ?? undefined,
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
      armId: parsed.data.armId || null,
      minSize: parsed.data.minSize,
      maxSize: parsed.data.maxSize,
    });
  } catch (err) {
    return fail(err, "cohort.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const advanceSchema = z.object({
  cohortId: uuid,
  status: z.enum(COHORT_STATUSES),
  /**
   * Present only on a second, deliberate attempt. Kept short and stored on the
   * audit row, so a cohort that ran outside its configured size is answerable.
   */
  overrideReason: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function advanceCohortAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = advanceSchema.safeParse({
    cohortId: formData.get("cohortId"),
    status: formData.get("status"),
    overrideReason: formData.get("overrideReason") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await advanceCohortStatus({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
      overrideReason: parsed.data.overrideReason,
    });
  } catch (err) {
    return fail(err, "cohort.advance");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  return { error: null, ok: true };
}

// --- Programme stage (Phase 4f) ----------------------------------------------

const stageSchema = z.object({
  cohortId: uuid,
  // Empty string clears the stage back to "programme not started".
  stageId: z.union([uuid, z.literal("")]),
});

/**
 * Move a cohort to a programme stage — any configured stage to any other, not
 * a forward-only lifecycle like `advanceCohortAction`'s cohort status. See
 * `setCohortStage` (services/program-stages.ts) for why.
 */
/**
 * The same move as `setCohortStageAction`, as a plain single-argument action
 * for the "advance to next stage" button (2026-09-19 request) — that button
 * is a bare `<form action={...}>` with no client state to track (no confirm
 * step, no error UI beyond the redirect), so it doesn't need
 * `useActionState`'s two-argument shape the way the timeline's per-stage
 * buttons do.
 */
export async function advanceStageAction(formData: FormData): Promise<void> {
  await setCohortStageAction({ error: null }, formData);
}

export async function setCohortStageAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = stageSchema.safeParse({
    cohortId: formData.get("cohortId"),
    stageId: formData.get("stageId") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await setCohortStage({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      actorId: ctx.session.userId,
      stageId: parsed.data.stageId || null,
    });
  } catch (err) {
    return fail(err, "cohort.stage_change");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  revalidatePath(`${TEAM_BASE_PATH}/sesiones`);
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

const transferSchema = z.object({
  participantId: uuid,
  toCohortId: uuid,
  reason: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((v) => (v ? v : null)),
});

/**
 * Move a participant between cohorts as one action.
 *
 * Deliberately not "remove, then assign from the other screen": that leaves a
 * moment with no cohort and, if the second step fails, an unexplained departure.
 * The service does both in one transaction (D-033).
 */
export async function transferCohortAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = transferSchema.safeParse({
    participantId: formData.get("participantId"),
    toCohortId: formData.get("toCohortId"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "cohorts.manage");
    await transferToCohort({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      toCohortId: parsed.data.toCohortId,
      actorId: ctx.session.userId,
      reason: parsed.data.reason,
    });
  } catch (err) {
    return fail(err, "cohort.transfer");
  }

  revalidate(`${TEAM_BASE_PATH}/participantes/${parsed.data.participantId}`);
  return { error: null, ok: true };
}

// --- Sticky notes (2026-09-19 request) ---------------------------------------

const createNoteSchema = z.object({
  cohortId: uuid,
  color: z.enum(NOTE_COLORS),
  body: z.string().trim().min(1).max(280),
});

export async function createCohortNoteAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = createNoteSchema.safeParse({
    cohortId: formData.get("cohortId"),
    color: formData.get("color"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "tasks.manage");
    await createCohortNote({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      actorId: ctx.session.userId,
      color: parsed.data.color,
      body: parsed.data.body,
    });
  } catch (err) {
    return fail(err, "cohort_note.create");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  return { error: null, ok: true };
}

const deleteNoteSchema = z.object({ noteId: uuid, cohortId: uuid });

export async function deleteCohortNoteAction(
  _prev: CohortState,
  formData: FormData,
): Promise<CohortState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = deleteNoteSchema.safeParse({
    noteId: formData.get("noteId"),
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "tasks.manage");
    await deleteCohortNote({
      studyId: ctx.study.id,
      noteId: parsed.data.noteId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "cohort_note.delete");
  }

  revalidate(`${TEAM_BASE_PATH}/cohortes/${parsed.data.cohortId}`);
  return { error: null, ok: true };
}
