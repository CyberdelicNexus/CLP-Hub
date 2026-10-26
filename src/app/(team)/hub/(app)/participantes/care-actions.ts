"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import {
  RESPONSIBILITY_ROLES,
  VISIT_LOCATION_MAX_LENGTH,
  VISIT_NOTES_MAX_LENGTH,
} from "@/domain/responsibility";
import { logger } from "@/lib/logger";
import {
  assignResponsible,
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  revokeResponsible,
  scheduleInitialVisit,
  setInitialVisitStatus,
  updateVisitNotes,
} from "@/services/participant-care";

/**
 * Responsibles and initial visits (Phase 4d).
 *
 * As everywhere else, the study comes from the server-resolved context and never
 * from the form, each action asserts its own permission, and the service writes
 * the change and its audit row in one transaction.
 *
 * These are the actions that accept the most free text in the whole application
 * — a location and a visit note — so both are capped here as well as in the
 * domain and in SQL, and neither is ever logged.
 */

export type CareState = {
  error:
    | "forbidden"
    | "invalid"
    | "notFound"
    | "visitAlreadyOpen"
    | "notesTooLong"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): CareState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  if (err instanceof ConflictError) return { error: err.reason };
  logger.error(
    // Never the note, never the location: logs are read more widely than the
    // database is.
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(participantId: string) {
  revalidatePath(`${TEAM_BASE_PATH}/participantes`);
  revalidatePath(`${TEAM_BASE_PATH}/participantes/${participantId}`);
  revalidatePath(TEAM_BASE_PATH);
}

// --- Responsibles -----------------------------------------------------------

const assignSchema = z.object({
  participantId: uuid,
  role: z.enum(RESPONSIBILITY_ROLES),
  userId: uuid,
});

export async function assignResponsibleAction(
  _prev: CareState,
  formData: FormData,
): Promise<CareState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = assignSchema.safeParse({
    participantId: formData.get("participantId"),
    role: formData.get("role"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    // Naming who runs a participant's visit is participant management, not
    // cohort management: it grants no visibility and touches no cohort.
    assertPermission(ctx, "participants.manage");
    await assignResponsible({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      role: parsed.data.role,
      userId: parsed.data.userId,
    });
  } catch (err) {
    return fail(err, "responsibility.assign");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const revokeSchema = z.object({ participantId: uuid, role: z.enum(RESPONSIBILITY_ROLES) });

export async function revokeResponsibleAction(
  _prev: CareState,
  formData: FormData,
): Promise<CareState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = revokeSchema.safeParse({
    participantId: formData.get("participantId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await revokeResponsible({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      role: parsed.data.role,
    });
  } catch (err) {
    return fail(err, "responsibility.revoke");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

// --- Initial visit ----------------------------------------------------------

const notes = z
  .string()
  .trim()
  .max(VISIT_NOTES_MAX_LENGTH)
  .optional()
  .transform((v) => (v ? v : null));

const location = z
  .string()
  .trim()
  .max(VISIT_LOCATION_MAX_LENGTH)
  .optional()
  .transform((v) => (v ? v : null));

const scheduleVisitSchema = z.object({
  participantId: uuid,
  // datetime-local gives "YYYY-MM-DDTHH:mm" with no zone, interpreted as the
  // server's zone and stored as UTC — the same convention screening uses.
  scheduledAt: z.string().min(1),
  location,
  notes,
});

export async function scheduleInitialVisitAction(
  _prev: CareState,
  formData: FormData,
): Promise<CareState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = scheduleVisitSchema.safeParse({
    participantId: formData.get("participantId"),
    scheduledAt: formData.get("scheduledAt"),
    location: formData.get("location") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const when = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(when.getTime())) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await scheduleInitialVisit({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      scheduledAt: when,
      location: parsed.data.location,
      notes: parsed.data.notes,
    });
  } catch (err) {
    return fail(err, "initial_visit.schedule");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const closeVisitSchema = z.object({
  participantId: uuid,
  visitId: uuid,
  status: z.enum(["COMPLETED", "NO_SHOW", "CANCELLED"]),
  notes,
});

export async function closeInitialVisitAction(
  _prev: CareState,
  formData: FormData,
): Promise<CareState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = closeVisitSchema.safeParse({
    participantId: formData.get("participantId"),
    visitId: formData.get("visitId"),
    status: formData.get("status"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await setInitialVisitStatus({
      studyId: ctx.study.id,
      visitId: parsed.data.visitId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });
  } catch (err) {
    return fail(err, "initial_visit.close");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const notesSchema = z.object({ participantId: uuid, visitId: uuid, notes, location });

export async function updateVisitNotesAction(
  _prev: CareState,
  formData: FormData,
): Promise<CareState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = notesSchema.safeParse({
    participantId: formData.get("participantId"),
    visitId: formData.get("visitId"),
    notes: formData.get("notes") ?? undefined,
    location: formData.get("location") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await updateVisitNotes({
      studyId: ctx.study.id,
      visitId: parsed.data.visitId,
      actorId: ctx.session.userId,
      notes: parsed.data.notes,
      location: parsed.data.location,
    });
  } catch (err) {
    return fail(err, "initial_visit.notes");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}
