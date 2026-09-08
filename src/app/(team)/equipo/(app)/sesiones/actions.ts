"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import {
  ATTENDANCE_STATUSES,
  SESSION_LOCATION_MAX_LENGTH,
  SESSION_MODALITIES,
  SESSION_NAME_MAX_LENGTH,
} from "@/domain/session";
import { logger } from "@/lib/logger";
import {
  InvalidTransitionError,
  NotFoundError,
  recordAttendance,
  refreshRegister,
  scheduleSession,
  setSessionStatus,
} from "@/services/sessions";

/**
 * Phase 3b staff actions.
 *
 * Attendance uses the full vocabulary from the brief, including
 * TECHNICAL_FAILURE, which is accepted and stored as itself. Nothing here maps
 * it onto ABSENT.
 */

export type SessionState = {
  error: "forbidden" | "invalid" | "notFound" | "failed" | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): SessionState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(sessionId?: string) {
  revalidatePath(`${TEAM_BASE_PATH}/sesiones`);
  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  revalidatePath(TEAM_BASE_PATH);
  if (sessionId) revalidatePath(`${TEAM_BASE_PATH}/sesiones/${sessionId}`);
}

const scheduleSchema = z.object({
  cohortId: uuid,
  name: z.string().trim().min(1).max(SESSION_NAME_MAX_LENGTH),
  modality: z.enum(SESSION_MODALITIES),
  scheduledStart: z.string().min(1),
  durationMinutes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0)),
  location: z.string().trim().max(SESSION_LOCATION_MAX_LENGTH).optional(),
  templateId: z.string().optional(),
});

export async function scheduleSessionAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = scheduleSchema.safeParse({
    cohortId: formData.get("cohortId"),
    name: formData.get("name"),
    modality: formData.get("modality"),
    scheduledStart: formData.get("scheduledStart"),
    durationMinutes: formData.get("durationMinutes") ?? undefined,
    location: formData.get("location") ?? undefined,
    templateId: formData.get("templateId") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const when = new Date(parsed.data.scheduledStart);
  if (Number.isNaN(when.getTime())) return { error: "invalid" };

  try {
    assertPermission(ctx, "sessions.manage");
    await scheduleSession({
      studyId: ctx.study.id,
      cohortId: parsed.data.cohortId,
      actorId: ctx.session.userId,
      name: parsed.data.name,
      modality: parsed.data.modality,
      scheduledStart: when,
      durationMinutes: parsed.data.durationMinutes,
      location: parsed.data.location || null,
      templateId: parsed.data.templateId || null,
    });
  } catch (err) {
    return fail(err, "session.schedule");
  }

  revalidate();
  return { error: null, ok: true };
}

const statusSchema = z.object({ sessionId: uuid, status: z.enum(["HELD", "CANCELLED"]) });

export async function setSessionStatusAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = statusSchema.safeParse({
    sessionId: formData.get("sessionId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "sessions.manage");
    await setSessionStatus({
      studyId: ctx.study.id,
      sessionId: parsed.data.sessionId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "session.status");
  }

  revalidate(parsed.data.sessionId);
  return { error: null, ok: true };
}

const attendanceSchema = z.object({
  sessionId: uuid,
  participantId: uuid,
  // The full vocabulary, TECHNICAL_FAILURE included, stored as given.
  status: z.enum(ATTENDANCE_STATUSES),
});

export async function recordAttendanceAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = attendanceSchema.safeParse({
    sessionId: formData.get("sessionId"),
    participantId: formData.get("participantId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "attendance.manage");
    await recordAttendance({
      studyId: ctx.study.id,
      sessionId: parsed.data.sessionId,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "attendance.record");
  }

  revalidate(parsed.data.sessionId);
  return { error: null, ok: true };
}

const refreshSchema = z.object({ sessionId: uuid });

export async function refreshRegisterAction(
  _prev: SessionState,
  formData: FormData,
): Promise<SessionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = refreshSchema.safeParse({ sessionId: formData.get("sessionId") });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "sessions.manage");
    await refreshRegister({
      studyId: ctx.study.id,
      sessionId: parsed.data.sessionId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "session.refresh_register");
  }

  revalidate(parsed.data.sessionId);
  return { error: null, ok: true };
}
