import "server-only";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { recordStudyEvent } from "./automation";
import { getDb } from "@/db/client";
import {
  cohorts,
  deviceAssignments,
  deviceIncidents,
  devices,
  participantCohortAssignments,
  participantContacts,
  participantResponsibilities,
  participants,
  users,
  type Device,
  type DeviceAssignment,
  type DeviceIncident,
} from "@/db/schema";
import {
  canTransitionDevice,
  isAvailableForAssignment,
  isValidIncidentDescription,
  logisticsStep,
  type DeviceStatus,
  type IncidentKind,
  type LogisticsStep,
  type VrReadiness,
} from "@/domain/logistics";

/**
 * VR device logistics (Phase 6).
 *
 * Equipment tracking. Every write runs in one transaction with its audit row.
 *
 * Two things this service reads rather than stores, deliberately (D-038):
 *
 * - **Who is responsible** comes from `participant_responsibilities` with role
 *   VR_EQUIPMENT (D-035). A `responsible_user_id` column on the assignment would
 *   be the same fact written twice, and the two would drift.
 * - **The next session** comes from `cohort_sessions` via the participant's
 *   cohort. Copied onto the assignment it would go stale the moment a session
 *   moved.
 *
 * `listOpenAssignments` also joins `participant_contacts.full_name`. It is
 * always selected — callers gate whether they render it on
 * `participants.contact.read` — which supersedes D-038's blanket "codes only,
 * even for an entitled viewer" rule for this build (D-065, temporary, pending
 * the team's decision on shared-monitor exposure).
 *
 * And one it never computes: `readiness` is reported, never inferred (D-003).
 */

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move a device from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly reason:
    | "deviceNotAvailable"
    | "deviceAlreadyOut"
    | "participantHasDevice"
    | "duplicateCode"
    | "notReturned"
    | "openIncidents"
    | "descriptionTooLong";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface DeviceRow extends Device {
  /** Participant code of the open assignment, if any. Never a name. */
  assignedToCode: string | null;
  openIncidents: number;
}

export async function listDevices(studyId: string): Promise<DeviceRow[]> {
  const rows = await getDb()
    .select({
      device: devices,
      assignedToCode: participants.code,
      openIncidents: sql<number>`(
        select count(*)::int from device_incidents di
        where di.device_id = ${devices.id} and di.resolved_at is null
      )`,
    })
    .from(devices)
    .leftJoin(
      deviceAssignments,
      and(eq(deviceAssignments.deviceId, devices.id), isNull(deviceAssignments.closedAt)),
    )
    .leftJoin(participants, eq(participants.id, deviceAssignments.participantId))
    .where(eq(devices.studyId, studyId))
    .orderBy(asc(devices.code));

  return rows.map((r) => ({
    ...r.device,
    assignedToCode: r.assignedToCode,
    openIncidents: Number(r.openIncidents),
  }));
}

export interface AssignmentRow {
  assignment: DeviceAssignment;
  deviceCode: string;
  deviceStatus: DeviceStatus;
  participantId: string;
  participantCode: string;
  /**
   * From participant_contacts. Always selected; callers gate whether they
   * render it on the viewer's own `participants.contact.read` permission
   * (D-065 superseded D-038's blanket code-only rule for this build).
   */
  participantName: string | null;
  cohortCode: string | null;
  /** From participant_responsibilities, not from a column here (D-038). */
  responsibleName: string | null;
  openIncidents: number;
  step: LogisticsStep;
}

/**
 * Open assignments, with everything the operations view needs.
 *
 * The responsible and the incident count are joined in rather than stored, so
 * this list cannot disagree with the participant page about who is handling a
 * headset.
 */
export async function listOpenAssignments(studyId: string): Promise<AssignmentRow[]> {
  const rows = await getDb()
    .select({
      assignment: deviceAssignments,
      deviceCode: devices.code,
      deviceStatus: devices.status,
      participantId: participants.id,
      participantCode: participants.code,
      participantName: participantContacts.fullName,
      cohortCode: cohorts.code,
      responsibleName: users.displayName,
      openIncidents: sql<number>`(
        select count(*)::int from device_incidents di
        where di.assignment_id = ${deviceAssignments.id} and di.resolved_at is null
      )`,
    })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .innerJoin(participants, eq(participants.id, deviceAssignments.participantId))
    .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
    .leftJoin(
      participantCohortAssignments,
      and(
        eq(participantCohortAssignments.participantId, participants.id),
        isNull(participantCohortAssignments.removedAt),
      ),
    )
    .leftJoin(cohorts, eq(cohorts.id, participantCohortAssignments.cohortId))
    .leftJoin(
      participantResponsibilities,
      and(
        eq(participantResponsibilities.participantId, participants.id),
        eq(participantResponsibilities.role, "VR_EQUIPMENT"),
        isNull(participantResponsibilities.revokedAt),
      ),
    )
    .leftJoin(users, eq(users.id, participantResponsibilities.userId))
    .where(and(eq(deviceAssignments.studyId, studyId), isNull(deviceAssignments.closedAt)))
    .orderBy(asc(deviceAssignments.expectedReturnAt), asc(devices.code));

  return rows.map((r) => ({
    assignment: r.assignment,
    deviceCode: r.deviceCode,
    deviceStatus: r.deviceStatus,
    participantId: r.participantId,
    participantCode: r.participantCode,
    participantName: r.participantName,
    cohortCode: r.cohortCode,
    responsibleName: r.responsibleName,
    openIncidents: Number(r.openIncidents),
    step: logisticsStep({
      deviceStatus: r.deviceStatus,
      handedOverAt: r.assignment.handedOverAt,
      receivedAt: r.assignment.receivedAt,
      readiness: r.assignment.readiness,
      expectedReturnAt: r.assignment.expectedReturnAt,
      returnedAt: r.assignment.returnedAt,
      closedAt: r.assignment.closedAt,
      openIncidents: Number(r.openIncidents),
    }),
  }));
}

/** A participant's device history, for the participant page. */
export async function listParticipantAssignments(
  participantId: string,
): Promise<{ assignment: DeviceAssignment; deviceCode: string; deviceStatus: DeviceStatus }[]> {
  const rows = await getDb()
    .select({
      assignment: deviceAssignments,
      deviceCode: devices.code,
      deviceStatus: devices.status,
    })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(eq(deviceAssignments.participantId, participantId))
    .orderBy(desc(deviceAssignments.createdAt));

  return rows;
}

export async function listIncidents(
  studyId: string,
  options: { openOnly?: boolean } = {},
): Promise<(DeviceIncident & { deviceCode: string; participantCode: string | null })[]> {
  const rows = await getDb()
    .select({
      incident: deviceIncidents,
      deviceCode: devices.code,
      participantCode: participants.code,
    })
    .from(deviceIncidents)
    .innerJoin(devices, eq(devices.id, deviceIncidents.deviceId))
    .leftJoin(deviceAssignments, eq(deviceAssignments.id, deviceIncidents.assignmentId))
    .leftJoin(participants, eq(participants.id, deviceAssignments.participantId))
    .where(
      options.openOnly
        ? and(eq(deviceIncidents.studyId, studyId), isNull(deviceIncidents.resolvedAt))
        : eq(deviceIncidents.studyId, studyId),
    )
    .orderBy(desc(deviceIncidents.reportedAt));

  return rows.map((r) => ({
    ...r.incident,
    deviceCode: r.deviceCode,
    participantCode: r.participantCode,
  }));
}

export async function countLogistics(
  studyId: string,
): Promise<{ available: number; out: number; openIncidents: number }> {
  const db = getDb();
  const [available, out, incidents] = await Promise.all([
    db
      .select({ n: count() })
      .from(devices)
      .where(and(eq(devices.studyId, studyId), eq(devices.status, "AVAILABLE"), eq(devices.active, true))),
    db
      .select({ n: count() })
      .from(deviceAssignments)
      .where(and(eq(deviceAssignments.studyId, studyId), isNull(deviceAssignments.closedAt))),
    db
      .select({ n: count() })
      .from(deviceIncidents)
      .where(and(eq(deviceIncidents.studyId, studyId), isNull(deviceIncidents.resolvedAt))),
  ]);

  return {
    available: Number(available[0]?.n ?? 0),
    out: Number(out[0]?.n ?? 0),
    openIncidents: Number(incidents[0]?.n ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Device writes
// ---------------------------------------------------------------------------

export async function createDevice(params: {
  studyId: string;
  actorId: string;
  code: string;
  model?: string | null;
  serial?: string | null;
}): Promise<string> {
  const { studyId, actorId } = params;
  const code = params.code.trim().toUpperCase();

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.studyId, studyId), eq(devices.code, code)))
      .limit(1);
    if (existing) throw new ConflictError("duplicateCode");

    const [created] = await tx
      .insert(devices)
      .values({
        studyId,
        code,
        model: params.model?.trim() || null,
        serial: params.serial?.trim() || null,
        status: "AVAILABLE",
      })
      .returning({ id: devices.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device.created",
      entityType: "device",
      entityId: created.id,
      after: { code, status: "AVAILABLE" },
    });

    return created.id;
  });
}

export async function setDeviceStatus(params: {
  studyId: string;
  deviceId: string;
  actorId: string;
  status: DeviceStatus;
}): Promise<void> {
  const { studyId, deviceId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: devices.id, code: devices.code, status: devices.status })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("device", deviceId);
    if (!canTransitionDevice(current.status, status)) {
      throw new InvalidTransitionError(current.status, status);
    }

    await tx.update(devices).set({ status }).where(eq(devices.id, deviceId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device.status_changed",
      entityType: "device",
      entityId: deviceId,
      before: { status: current.status },
      after: { status, code: current.code },
    });
  });
}

// ---------------------------------------------------------------------------
// Assignment writes
// ---------------------------------------------------------------------------

/**
 * Give a device to a participant.
 *
 * Refused when the device is not AVAILABLE or when either side already has an
 * open assignment. All three are data integrity, not operational judgement: a
 * headset cannot physically be with two people, and a record saying otherwise
 * would make every later logistics figure wrong.
 */
export async function assignDevice(params: {
  studyId: string;
  deviceId: string;
  participantId: string;
  actorId: string;
  expectedReturnAt?: Date | null;
}): Promise<string> {
  const { studyId, deviceId, participantId, actorId } = params;

  return getDb().transaction(async (tx) => {
    const [device] = await tx
      .select({ id: devices.id, code: devices.code, status: devices.status, active: devices.active })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.studyId, studyId)))
      .limit(1);
    if (!device || !device.active) throw new NotFoundError("device", deviceId);
    if (!isAvailableForAssignment(device.status)) throw new ConflictError("deviceNotAvailable");

    const [participant] = await tx
      .select({ id: participants.id, code: participants.code })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [deviceOpen] = await tx
      .select({ id: deviceAssignments.id })
      .from(deviceAssignments)
      .where(and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.closedAt)))
      .limit(1);
    if (deviceOpen) throw new ConflictError("deviceAlreadyOut");

    const [participantOpen] = await tx
      .select({ id: deviceAssignments.id })
      .from(deviceAssignments)
      .where(
        and(eq(deviceAssignments.participantId, participantId), isNull(deviceAssignments.closedAt)),
      )
      .limit(1);
    if (participantOpen) throw new ConflictError("participantHasDevice");

    const [created] = await tx
      .insert(deviceAssignments)
      .values({
        studyId,
        deviceId,
        participantId,
        expectedReturnAt: params.expectedReturnAt ?? null,
        assignedBy: actorId,
      })
      .returning({ id: deviceAssignments.id });

    await tx.update(devices).set({ status: "RESERVED" }).where(eq(devices.id, deviceId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device_assignment.created",
      entityType: "device_assignment",
      entityId: created.id,
      after: {
        deviceCode: device.code,
        participantCode: participant.code,
        expectedReturnAt: params.expectedReturnAt?.toISOString() ?? null,
      },
    });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device.status_changed",
      entityType: "device",
      entityId: deviceId,
      before: { status: device.status },
      after: { status: "RESERVED", code: device.code },
      metadata: { via: "assignment", assignmentId: created.id },
    });

    // Against the DEVICE, not the person. A logistics rule is about a headset
    // that has to come back; the participant is reachable from the open
    // assignment when a rule genuinely needs them.
    await recordStudyEvent(tx, {
      studyId,
      eventType: "DEVICE_ASSIGNED",
      subject: { kind: "DEVICE", id: deviceId },
      metadata: { deviceCode: device.code, participantCode: participant.code },
    });

    return created.id;
  });
}

/**
 * Record a milestone on an open assignment: handed over, received, returned.
 *
 * One function rather than three because they are the same shape — stamp a date,
 * move the device, audit it — and three near-identical functions would drift.
 */
export async function recordAssignmentMilestone(params: {
  studyId: string;
  assignmentId: string;
  actorId: string;
  milestone: "HANDED_OVER" | "RECEIVED" | "RETURNED";
  at?: Date;
  /** The device status that goes with it, chosen by staff, not inferred. */
  deviceStatus: DeviceStatus;
}): Promise<void> {
  const { studyId, assignmentId, actorId, milestone, deviceStatus } = params;
  const at = params.at ?? new Date();

  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: deviceAssignments.id,
        deviceId: deviceAssignments.deviceId,
        closedAt: deviceAssignments.closedAt,
        handedOverAt: deviceAssignments.handedOverAt,
        receivedAt: deviceAssignments.receivedAt,
        returnedAt: deviceAssignments.returnedAt,
        deviceCode: devices.code,
        deviceStatus: devices.status,
        participantCode: participants.code,
      })
      .from(deviceAssignments)
      .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
      .innerJoin(participants, eq(participants.id, deviceAssignments.participantId))
      .where(and(eq(deviceAssignments.id, assignmentId), eq(deviceAssignments.studyId, studyId)))
      .limit(1);
    if (!row) throw new NotFoundError("device assignment", assignmentId);
    if (row.closedAt) throw new NotFoundError("open device assignment", assignmentId);

    if (!canTransitionDevice(row.deviceStatus, deviceStatus)) {
      throw new InvalidTransitionError(row.deviceStatus, deviceStatus);
    }

    const patch =
      milestone === "HANDED_OVER"
        ? { handedOverAt: at }
        : milestone === "RECEIVED"
          ? { receivedAt: at }
          : { returnedAt: at };

    await tx.update(deviceAssignments).set(patch).where(eq(deviceAssignments.id, assignmentId));
    await tx.update(devices).set({ status: deviceStatus }).where(eq(devices.id, row.deviceId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device_assignment.milestone_recorded",
      entityType: "device_assignment",
      entityId: assignmentId,
      after: {
        milestone,
        at: at.toISOString(),
        deviceCode: row.deviceCode,
        participantCode: row.participantCode,
        deviceStatus,
      },
      before: { deviceStatus: row.deviceStatus },
    });

    // Only the two milestones a rule can usefully hang off: the headset is with
    // the participant, or it is back. RECEIVED is the participant confirming
    // arrival and has no schedule of its own.
    if (milestone === "HANDED_OVER" || milestone === "RETURNED") {
      await recordStudyEvent(tx, {
        studyId,
        eventType: milestone === "HANDED_OVER" ? "DEVICE_DELIVERED" : "DEVICE_RETURNED",
        subject: { kind: "DEVICE", id: row.deviceId },
        anchorAt: at,
        metadata: { deviceCode: row.deviceCode, participantCode: row.participantCode },
      });
    }
  });
}

/** Record reported setup readiness. Reported, never inferred (D-003). */
export async function reportReadiness(params: {
  studyId: string;
  assignmentId: string;
  actorId: string;
  readiness: Exclude<VrReadiness, "UNKNOWN">;
}): Promise<void> {
  const { studyId, assignmentId, actorId, readiness } = params;

  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: deviceAssignments.id,
        readiness: deviceAssignments.readiness,
        participantCode: participants.code,
      })
      .from(deviceAssignments)
      .innerJoin(participants, eq(participants.id, deviceAssignments.participantId))
      .where(and(eq(deviceAssignments.id, assignmentId), eq(deviceAssignments.studyId, studyId)))
      .limit(1);
    if (!row) throw new NotFoundError("device assignment", assignmentId);

    await tx
      .update(deviceAssignments)
      .set({ readiness, readinessReportedAt: new Date() })
      .where(eq(deviceAssignments.id, assignmentId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device_assignment.readiness_reported",
      entityType: "device_assignment",
      entityId: assignmentId,
      before: { readiness: row.readiness },
      after: { readiness, participantCode: row.participantCode },
    });
  });
}

/**
 * Close the logistics for an assignment.
 *
 * Refused while the device has not come back or an incident is still open —
 * closing over an unresolved incident is exactly how a broken headset gets
 * forgotten.
 */
export async function closeAssignment(params: {
  studyId: string;
  assignmentId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, assignmentId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: deviceAssignments.id,
        returnedAt: deviceAssignments.returnedAt,
        deviceId: deviceAssignments.deviceId,
        participantCode: participants.code,
      })
      .from(deviceAssignments)
      .innerJoin(participants, eq(participants.id, deviceAssignments.participantId))
      .where(and(eq(deviceAssignments.id, assignmentId), eq(deviceAssignments.studyId, studyId)))
      .limit(1);
    if (!row) throw new NotFoundError("device assignment", assignmentId);
    if (!row.returnedAt) throw new ConflictError("notReturned");

    const [open] = await tx
      .select({ n: count() })
      .from(deviceIncidents)
      .where(
        and(eq(deviceIncidents.assignmentId, assignmentId), isNull(deviceIncidents.resolvedAt)),
      );
    if (Number(open?.n ?? 0) > 0) throw new ConflictError("openIncidents");

    await tx
      .update(deviceAssignments)
      .set({ closedAt: new Date() })
      .where(eq(deviceAssignments.id, assignmentId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device_assignment.closed",
      entityType: "device_assignment",
      entityId: assignmentId,
      after: { closed: true, participantCode: row.participantCode },
    });
  });
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export async function reportIncident(params: {
  studyId: string;
  deviceId: string;
  assignmentId?: string | null;
  actorId: string;
  kind: IncidentKind;
  description?: string | null;
}): Promise<string> {
  const { studyId, deviceId, actorId, kind } = params;
  const description = params.description?.trim() || null;
  if (description && !isValidIncidentDescription(description)) {
    throw new ConflictError("descriptionTooLong");
  }

  return getDb().transaction(async (tx) => {
    const [device] = await tx
      .select({ id: devices.id, code: devices.code })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.studyId, studyId)))
      .limit(1);
    if (!device) throw new NotFoundError("device", deviceId);

    const [created] = await tx
      .insert(deviceIncidents)
      .values({
        studyId,
        deviceId,
        assignmentId: params.assignmentId || null,
        kind,
        description,
        reportedBy: actorId,
      })
      .returning({ id: deviceIncidents.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device_incident.reported",
      entityType: "device_incident",
      entityId: created.id,
      // The kind is a fixed vocabulary and safe to snapshot; the description is
      // free text and is not, for the same reason as the visit note (D-035).
      after: { kind, deviceCode: device.code, hasDescription: Boolean(description) },
    });

    return created.id;
  });
}

export async function resolveIncident(params: {
  studyId: string;
  incidentId: string;
  actorId: string;
  resolution?: string | null;
}): Promise<void> {
  const { studyId, incidentId, actorId } = params;
  const resolution = params.resolution?.trim() || null;
  if (resolution && !isValidIncidentDescription(resolution)) {
    throw new ConflictError("descriptionTooLong");
  }

  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: deviceIncidents.id, kind: deviceIncidents.kind, resolvedAt: deviceIncidents.resolvedAt })
      .from(deviceIncidents)
      .where(and(eq(deviceIncidents.id, incidentId), eq(deviceIncidents.studyId, studyId)))
      .limit(1);
    if (!row) throw new NotFoundError("incident", incidentId);

    await tx
      .update(deviceIncidents)
      .set({ resolvedAt: new Date(), resolvedBy: actorId, resolution })
      .where(eq(deviceIncidents.id, incidentId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "device_incident.resolved",
      entityType: "device_incident",
      entityId: incidentId,
      before: { resolved: Boolean(row.resolvedAt) },
      after: { resolved: true, kind: row.kind, hasResolution: Boolean(resolution) },
    });
  });
}

/** Devices free to hand out. */
export async function listAvailableDevices(studyId: string): Promise<Device[]> {
  return getDb()
    .select()
    .from(devices)
    .where(and(eq(devices.studyId, studyId), eq(devices.status, "AVAILABLE"), eq(devices.active, true)))
    .orderBy(asc(devices.code));
}
