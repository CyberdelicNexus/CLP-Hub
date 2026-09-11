"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import {
  DEVICE_CODE_PATTERN,
  DEVICE_STATUSES,
  INCIDENT_DESCRIPTION_MAX_LENGTH,
  INCIDENT_KINDS,
} from "@/domain/logistics";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import {
  assignDevice,
  closeAssignment,
  ConflictError,
  createDevice,
  InvalidTransitionError,
  NotFoundError,
  recordAssignmentMilestone,
  reportIncident,
  reportReadiness,
  resolveIncident,
  setDeviceStatus,
} from "@/services/logistics";

/**
 * VR logistics staff actions (Phase 6).
 *
 * Every one resolves the study from the server-side context, asserts
 * `logistics.manage`, and delegates to a service that writes the change and its
 * audit row in one transaction.
 *
 * The device status that accompanies a milestone is CHOSEN by staff and passed
 * through, never inferred from the milestone. "Handed over" could mean posted or
 * given in person, and guessing which would put a fact in the database that
 * nobody stated.
 */

export type LogisticsState = {
  error:
    | "forbidden"
    | "invalid"
    | "notFound"
    | "duplicateCode"
    | "deviceNotAvailable"
    | "deviceAlreadyOut"
    | "participantHasDevice"
    | "notReturned"
    | "openIncidents"
    | "descriptionTooLong"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): LogisticsState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  if (err instanceof ConflictError) return { error: err.reason };
  logger.error(
    // Never the incident description: logs are read more widely than the database.
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(participantId?: string) {
  revalidatePath(`${TEAM_BASE_PATH}/logistica-vr`);
  revalidatePath(TEAM_BASE_PATH);
  if (participantId) revalidatePath(`${TEAM_BASE_PATH}/participantes/${participantId}`);
}

// --- Devices ----------------------------------------------------------------

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => DEVICE_CODE_PATTERN.test(v)),
  model: z.string().trim().max(120).optional(),
  serial: z.string().trim().max(120).optional(),
});

export async function createDeviceAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = createSchema.safeParse({
    code: formData.get("code"),
    model: formData.get("model") ?? undefined,
    serial: formData.get("serial") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await createDevice({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      code: parsed.data.code,
      model: parsed.data.model,
      serial: parsed.data.serial,
    });
  } catch (err) {
    return fail(err, "device.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const statusSchema = z.object({ deviceId: uuid, status: z.enum(DEVICE_STATUSES) });

export async function setDeviceStatusAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = statusSchema.safeParse({
    deviceId: formData.get("deviceId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await setDeviceStatus({
      studyId: ctx.study.id,
      deviceId: parsed.data.deviceId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "device.status");
  }

  revalidate();
  return { error: null, ok: true };
}

// --- Assignments ------------------------------------------------------------

const assignSchema = z.object({
  deviceId: uuid,
  participantId: uuid,
  expectedReturnAt: z.string().trim().optional(),
});

export async function assignDeviceAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = assignSchema.safeParse({
    deviceId: formData.get("deviceId"),
    participantId: formData.get("participantId"),
    expectedReturnAt: formData.get("expectedReturnAt") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const expected = parsed.data.expectedReturnAt ? new Date(parsed.data.expectedReturnAt) : null;
  if (expected && Number.isNaN(expected.getTime())) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await assignDevice({
      studyId: ctx.study.id,
      deviceId: parsed.data.deviceId,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      expectedReturnAt: expected,
    });
  } catch (err) {
    return fail(err, "device.assign");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const milestoneSchema = z.object({
  assignmentId: uuid,
  milestone: z.enum(["HANDED_OVER", "RECEIVED", "RETURNED"]),
  deviceStatus: z.enum(DEVICE_STATUSES),
});

export async function recordMilestoneAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = milestoneSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    milestone: formData.get("milestone"),
    deviceStatus: formData.get("deviceStatus"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await recordAssignmentMilestone({
      studyId: ctx.study.id,
      assignmentId: parsed.data.assignmentId,
      actorId: ctx.session.userId,
      milestone: parsed.data.milestone,
      deviceStatus: parsed.data.deviceStatus,
    });
  } catch (err) {
    return fail(err, "device.milestone");
  }

  revalidate();
  return { error: null, ok: true };
}

const readinessSchema = z.object({
  assignmentId: uuid,
  readiness: z.enum(["READY", "NOT_READY", "NEEDS_SUPPORT"]),
});

export async function reportReadinessAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = readinessSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    readiness: formData.get("readiness"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await reportReadiness({
      studyId: ctx.study.id,
      assignmentId: parsed.data.assignmentId,
      actorId: ctx.session.userId,
      readiness: parsed.data.readiness,
    });
  } catch (err) {
    return fail(err, "device.readiness");
  }

  revalidate();
  return { error: null, ok: true };
}

const closeSchema = z.object({ assignmentId: uuid });

export async function closeAssignmentAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = closeSchema.safeParse({ assignmentId: formData.get("assignmentId") });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await closeAssignment({
      studyId: ctx.study.id,
      assignmentId: parsed.data.assignmentId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "device.close");
  }

  revalidate();
  return { error: null, ok: true };
}

// --- Incidents --------------------------------------------------------------

const incidentSchema = z.object({
  deviceId: uuid,
  assignmentId: z.union([uuid, z.literal("")]).optional(),
  kind: z.enum(INCIDENT_KINDS),
  description: z.string().trim().max(INCIDENT_DESCRIPTION_MAX_LENGTH).optional(),
});

export async function reportIncidentAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = incidentSchema.safeParse({
    deviceId: formData.get("deviceId"),
    assignmentId: formData.get("assignmentId") ?? undefined,
    kind: formData.get("kind"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await reportIncident({
      studyId: ctx.study.id,
      deviceId: parsed.data.deviceId,
      assignmentId: parsed.data.assignmentId || null,
      actorId: ctx.session.userId,
      kind: parsed.data.kind,
      description: parsed.data.description,
    });
  } catch (err) {
    return fail(err, "incident.report");
  }

  revalidate();
  return { error: null, ok: true };
}

const resolveSchema = z.object({
  incidentId: uuid,
  resolution: z.string().trim().max(INCIDENT_DESCRIPTION_MAX_LENGTH).optional(),
});

export async function resolveIncidentAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = resolveSchema.safeParse({
    incidentId: formData.get("incidentId"),
    resolution: formData.get("resolution") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "logistics.manage");
    await resolveIncident({
      studyId: ctx.study.id,
      incidentId: parsed.data.incidentId,
      actorId: ctx.session.userId,
      resolution: parsed.data.resolution,
    });
  } catch (err) {
    return fail(err, "incident.resolve");
  }

  revalidate();
  return { error: null, ok: true };
}
