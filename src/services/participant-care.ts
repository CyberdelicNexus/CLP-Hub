import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { recordStudyEvent } from "./automation";
import { getDb } from "@/db/client";
import {
  initialVisits,
  participantResponsibilities,
  participants,
  userRoles,
  users,
  type InitialVisit,
} from "@/db/schema";
import {
  canTransitionVisit,
  isValidVisitNotes,
  VISIT_LOCATION_MAX_LENGTH,
  type ResponsibilityRole,
  type VisitStatus,
} from "@/domain/responsibility";

/**
 * Responsibles and initial visits (Phase 4d).
 *
 * Every write runs in one transaction with its audit rows. Nothing here decides
 * anything about a participant: it records who is doing what, and whether an
 * appointment happened.
 *
 * NOTE ON AUDIT SNAPSHOTS: the visit's `notes` and `location` are never copied
 * into `after_json`. Both are free text about a person, and an append-only log is
 * the one place they could not later be erased. Whether a note exists is
 * recorded; what it says is not.
 */

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move a visit from ${from} to ${to}`);
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
  readonly reason: "visitAlreadyOpen" | "notesTooLong";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ResponsibleRow {
  id: string;
  role: ResponsibilityRole;
  userId: string;
  displayName: string;
  assignedAt: Date;
}

/** Who is currently responsible for a participant, by role. */
export async function listResponsibles(participantId: string): Promise<ResponsibleRow[]> {
  const rows = await getDb()
    .select({
      id: participantResponsibilities.id,
      role: participantResponsibilities.role,
      userId: participantResponsibilities.userId,
      displayName: users.displayName,
      assignedAt: participantResponsibilities.assignedAt,
    })
    .from(participantResponsibilities)
    .innerJoin(users, eq(users.id, participantResponsibilities.userId))
    .where(
      and(
        eq(participantResponsibilities.participantId, participantId),
        isNull(participantResponsibilities.revokedAt),
      ),
    )
    .orderBy(participantResponsibilities.role);

  return rows as ResponsibleRow[];
}

/** Initial visits for a participant, newest first. */
export async function listInitialVisits(participantId: string): Promise<InitialVisit[]> {
  return getDb()
    .select()
    .from(initialVisits)
    .where(eq(initialVisits.participantId, participantId))
    .orderBy(desc(initialVisits.createdAt));
}

// ---------------------------------------------------------------------------
// Responsible writes
// ---------------------------------------------------------------------------

/**
 * Put someone in charge of one aspect of a participant.
 *
 * A second assignment for the same role SUPERSEDES the first rather than sitting
 * alongside it: two people simultaneously responsible for the headset is how a
 * headset ends up with nobody carrying it. The superseded row is revoked, not
 * deleted, so who held it before stays answerable.
 */
export async function assignResponsible(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  role: ResponsibilityRole;
  userId: string;
}): Promise<void> {
  const { studyId, participantId, actorId, role, userId } = params;

  await getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({ id: participants.id, code: participants.code })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [current] = await tx
      .select({ id: participantResponsibilities.id, userId: participantResponsibilities.userId })
      .from(participantResponsibilities)
      .where(
        and(
          eq(participantResponsibilities.participantId, participantId),
          eq(participantResponsibilities.role, role),
          isNull(participantResponsibilities.revokedAt),
        ),
      )
      .limit(1);

    // Re-assigning the same person is a no-op rather than a churn of audit rows.
    if (current?.userId === userId) return;

    if (current) {
      await tx
        .update(participantResponsibilities)
        .set({ revokedAt: new Date(), revokedBy: actorId })
        .where(eq(participantResponsibilities.id, current.id));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant_responsibility.revoked",
        entityType: "participant_responsibility",
        entityId: current.id,
        before: { active: true, userId: current.userId, role },
        after: { active: false },
        metadata: { supersededBy: userId, participantCode: participant.code },
      });
    }

    const [created] = await tx
      .insert(participantResponsibilities)
      .values({ studyId, participantId, role, userId, assignedBy: actorId })
      .returning({ id: participantResponsibilities.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "participant_responsibility.assigned",
      entityType: "participant_responsibility",
      entityId: created.id,
      after: { role, userId, participantCode: participant.code },
      // Said explicitly because cohort_staff DOES widen visibility (D-022) and
      // the two are easy to conflate when reading an audit trail.
      metadata: { grantsCohortVisibility: false },
    });
  });
}

/** Step down from a responsibility without naming a successor. */
export async function revokeResponsible(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  role: ResponsibilityRole;
}): Promise<void> {
  const { studyId, participantId, actorId, role } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: participantResponsibilities.id, userId: participantResponsibilities.userId })
      .from(participantResponsibilities)
      .where(
        and(
          eq(participantResponsibilities.participantId, participantId),
          eq(participantResponsibilities.studyId, studyId),
          eq(participantResponsibilities.role, role),
          isNull(participantResponsibilities.revokedAt),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundError("responsibility", `${participantId}:${role}`);

    await tx
      .update(participantResponsibilities)
      .set({ revokedAt: new Date(), revokedBy: actorId })
      .where(eq(participantResponsibilities.id, current.id));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "participant_responsibility.revoked",
      entityType: "participant_responsibility",
      entityId: current.id,
      before: { active: true, userId: current.userId, role },
      after: { active: false },
    });
  });
}

// ---------------------------------------------------------------------------
// Initial visit writes
// ---------------------------------------------------------------------------

export async function scheduleInitialVisit(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  scheduledAt: Date;
  location?: string | null;
  notes?: string | null;
}): Promise<string> {
  const { studyId, participantId, actorId, scheduledAt } = params;
  const location = params.location?.trim().slice(0, VISIT_LOCATION_MAX_LENGTH) || null;
  const notes = params.notes?.trim() || null;

  if (notes && !isValidVisitNotes(notes)) throw new ConflictError("notesTooLong");

  return getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({ id: participants.id, code: participants.code })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [open] = await tx
      .select({ id: initialVisits.id })
      .from(initialVisits)
      .where(
        and(eq(initialVisits.participantId, participantId), eq(initialVisits.status, "SCHEDULED")),
      )
      .limit(1);
    if (open) throw new ConflictError("visitAlreadyOpen");

    const [created] = await tx
      .insert(initialVisits)
      .values({
        studyId,
        participantId,
        status: "SCHEDULED",
        scheduledAt,
        location,
        notes,
        recordedBy: actorId,
      })
      .returning({ id: initialVisits.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "initial_visit.scheduled",
      entityType: "initial_visit",
      entityId: created.id,
      after: {
        participantCode: participant.code,
        status: "SCHEDULED",
        scheduledAt: scheduledAt.toISOString(),
        // Whether a note exists, never what it says: an append-only log is the
        // one place free text about a person could not later be erased.
        hasLocation: Boolean(location),
        hasNotes: Boolean(notes),
      },
    });

    // Anchored on the appointment. "Two days before the initial visit" is then
    // a rule row, not a number in this file.
    await recordStudyEvent(tx, {
      studyId,
      eventType: "VISIT_SCHEDULED",
      subject: { kind: "PARTICIPANT", id: participantId },
      anchorAt: scheduledAt,
      metadata: { participantCode: participant.code },
    });

    return created.id;
  });
}

/** Close a visit with its outcome. A visit that happened is never rewritten. */
export async function setInitialVisitStatus(params: {
  studyId: string;
  visitId: string;
  actorId: string;
  status: Exclude<VisitStatus, "SCHEDULED">;
  notes?: string | null;
}): Promise<void> {
  const { studyId, visitId, actorId, status } = params;
  const notes = params.notes?.trim() || null;

  if (notes && !isValidVisitNotes(notes)) throw new ConflictError("notesTooLong");

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: initialVisits.id,
        status: initialVisits.status,
        notes: initialVisits.notes,
        participantId: initialVisits.participantId,
      })
      .from(initialVisits)
      .where(and(eq(initialVisits.id, visitId), eq(initialVisits.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("initial visit", visitId);
    if (!canTransitionVisit(current.status, status)) {
      throw new InvalidTransitionError(current.status, status);
    }

    await tx
      .update(initialVisits)
      .set({
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
        // An omitted note leaves the existing one alone rather than erasing it.
        notes: notes ?? current.notes,
        recordedBy: actorId,
      })
      .where(eq(initialVisits.id, visitId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "initial_visit.closed",
      entityType: "initial_visit",
      entityId: visitId,
      before: { status: current.status },
      after: { status, hasNotes: Boolean(notes ?? current.notes) },
    });
  });
}

/** Update the operational notes on an open visit, without closing it. */
export async function updateVisitNotes(params: {
  studyId: string;
  visitId: string;
  actorId: string;
  notes: string | null;
  location: string | null;
}): Promise<void> {
  const { studyId, visitId, actorId } = params;
  const notes = params.notes?.trim() || null;
  const location = params.location?.trim().slice(0, VISIT_LOCATION_MAX_LENGTH) || null;

  if (notes && !isValidVisitNotes(notes)) throw new ConflictError("notesTooLong");

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: initialVisits.id, notes: initialVisits.notes })
      .from(initialVisits)
      .where(and(eq(initialVisits.id, visitId), eq(initialVisits.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("initial visit", visitId);

    await tx.update(initialVisits).set({ notes, location }).where(eq(initialVisits.id, visitId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "initial_visit.notes_updated",
      entityType: "initial_visit",
      entityId: visitId,
      // Again: presence, not content. Someone reading the audit log can see the
      // note changed and go and read the current one; they cannot recover a
      // previous version from here, which is the point.
      before: { hasNotes: Boolean(current.notes) },
      after: { hasNotes: Boolean(notes), hasLocation: Boolean(location) },
    });
  });
}

/** Staff who may be named responsible: active members of the study. */
export async function listResponsibleCandidates(
  studyId: string,
): Promise<{ id: string; displayName: string }[]> {
  return getDb()
    .selectDistinct({ id: users.id, displayName: users.displayName })
    .from(users)
    .innerJoin(
      userRoles,
      and(
        eq(userRoles.userId, users.id),
        eq(userRoles.studyId, studyId),
        isNull(userRoles.revokedAt),
      ),
    )
    .where(eq(users.active, true))
    .orderBy(users.displayName);
}

/** Responsibles for many participants at once, for list views. */
export async function responsiblesByParticipant(
  participantIds: readonly string[],
): Promise<Map<string, ResponsibleRow[]>> {
  const byParticipant = new Map<string, ResponsibleRow[]>();
  if (participantIds.length === 0) return byParticipant;

  const rows = await getDb()
    .select({
      participantId: participantResponsibilities.participantId,
      id: participantResponsibilities.id,
      role: participantResponsibilities.role,
      userId: participantResponsibilities.userId,
      displayName: users.displayName,
      assignedAt: participantResponsibilities.assignedAt,
    })
    .from(participantResponsibilities)
    .innerJoin(users, eq(users.id, participantResponsibilities.userId))
    .where(
      and(
        inArray(participantResponsibilities.participantId, [...participantIds]),
        isNull(participantResponsibilities.revokedAt),
      ),
    );

  for (const r of rows) {
    const list = byParticipant.get(r.participantId) ?? [];
    list.push(r as ResponsibleRow);
    byParticipant.set(r.participantId, list);
  }
  return byParticipant;
}
