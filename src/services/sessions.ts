import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { recordStudyEvent } from "./automation";
import type { CohortScope } from "@/auth/cohort-scope";
import { getDb, type DbExecutor } from "@/db/client";
import {
  cohortSessions,
  cohorts,
  participantCohortAssignments,
  participantContacts,
  participants,
  sessionAttendance,
  sessionTemplates,
  users,
  type CohortSession,
  type SessionTemplate,
} from "@/db/schema";
import {
  canTransitionSession,
  tallyAttendance,
  type AttendanceStatus,
  type AttendanceTally,
  type SessionModality,
  type SessionStatus,
} from "@/domain/session";
import { pinSessionContent } from "./content";

/**
 * Sessions and attendance (Phase 3b).
 *
 * Reads are narrowed by CohortScope, so a facilitator sees only the sessions of
 * cohorts they run. Writes run in one transaction with their audit rows.
 *
 * Attendance keeps TECHNICAL_FAILURE distinct from ABSENT throughout: no query
 * here collapses them, and the tally returned to the UI reports them separately.
 */

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move session from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}

/** Narrowing on the cohort a session belongs to. Empty scope matches nothing. */
function scopeFilter(scope: CohortScope) {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`false`;
  return inArray(cohortSessions.cohortId, scope);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listSessionTemplates(studyId: string): Promise<SessionTemplate[]> {
  return getDb()
    .select()
    .from(sessionTemplates)
    .where(and(eq(sessionTemplates.studyId, studyId), eq(sessionTemplates.active, true)))
    .orderBy(asc(sessionTemplates.position), asc(sessionTemplates.code));
}

export interface SessionListRow {
  id: string;
  name: string;
  modality: SessionModality;
  status: SessionStatus;
  scheduledStart: Date;
  cohortId: string;
  cohortCode: string;
  templateId: string | null;
  facilitatorName: string | null;
  expected: number;
}

export async function listSessions(
  studyId: string,
  options: { scope: CohortScope; cohortId?: string; limit?: number },
): Promise<SessionListRow[]> {
  const narrowing = scopeFilter(options.scope);
  const filters = [eq(cohortSessions.studyId, studyId)];
  if (narrowing) filters.push(narrowing);
  if (options.cohortId) filters.push(eq(cohortSessions.cohortId, options.cohortId));

  const rows = await getDb()
    .select({
      id: cohortSessions.id,
      name: cohortSessions.name,
      modality: cohortSessions.modality,
      status: cohortSessions.status,
      scheduledStart: cohortSessions.scheduledStart,
      cohortId: cohorts.id,
      cohortCode: cohorts.code,
      templateId: cohortSessions.templateId,
      facilitatorName: users.displayName,
      expected: sql<number>`(
        select count(*) from session_attendance sa where sa.session_id = ${cohortSessions.id}
      )`,
    })
    .from(cohortSessions)
    .innerJoin(cohorts, eq(cohorts.id, cohortSessions.cohortId))
    .leftJoin(users, eq(users.id, cohortSessions.facilitatorId))
    .where(and(...filters))
    .orderBy(asc(cohortSessions.scheduledStart))
    .limit(options.limit ?? 200);

  return rows.map((r) => ({ ...r, expected: Number(r.expected) }));
}

export interface SessionDetail {
  session: CohortSession;
  cohort: { id: string; code: string; name: string };
  register: {
    participantId: string;
    code: string;
    fullName: string | null;
    status: AttendanceStatus;
    recordedAt: Date | null;
  }[];
  tally: AttendanceTally;
}

export async function getSessionDetail(
  studyId: string,
  sessionId: string,
  options: { scope: CohortScope; includeContact: boolean },
): Promise<SessionDetail | null> {
  const db = getDb();
  const narrowing = scopeFilter(options.scope);
  const filters = [eq(cohortSessions.id, sessionId), eq(cohortSessions.studyId, studyId)];
  if (narrowing) filters.push(narrowing);

  const [row] = await db
    .select({
      session: cohortSessions,
      cohortId: cohorts.id,
      cohortCode: cohorts.code,
      cohortName: cohorts.name,
    })
    .from(cohortSessions)
    .innerJoin(cohorts, eq(cohorts.id, cohortSessions.cohortId))
    .where(and(...filters))
    .limit(1);

  if (!row) return null;

  const register = await db
    .select({
      participantId: participants.id,
      code: participants.code,
      fullName: options.includeContact ? participantContacts.fullName : sql<null>`null`,
      status: sessionAttendance.status,
      recordedAt: sessionAttendance.recordedAt,
    })
    .from(sessionAttendance)
    .innerJoin(participants, eq(participants.id, sessionAttendance.participantId))
    .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
    .where(eq(sessionAttendance.sessionId, sessionId))
    .orderBy(asc(participants.code));

  return {
    session: row.session,
    cohort: { id: row.cohortId, code: row.cohortCode, name: row.cohortName },
    register: register as SessionDetail["register"],
    tally: tallyAttendance(register.map((r) => r.status)),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Schedule a session for a cohort and open its register.
 *
 * Every current member gets an EXPECTED row immediately, so the register is
 * complete before the session happens rather than being reconstructed afterwards
 * from whoever someone remembered to write down.
 */
export async function scheduleSession(params: {
  studyId: string;
  cohortId: string;
  actorId: string;
  name: string;
  modality: SessionModality;
  scheduledStart: Date;
  durationMinutes?: number | null;
  location?: string | null;
  templateId?: string | null;
  facilitatorId?: string | null;
}): Promise<string> {
  const { studyId, cohortId, actorId } = params;

  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select({ id: cohorts.id, code: cohorts.code })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);

    const [created] = await tx
      .insert(cohortSessions)
      .values({
        studyId,
        cohortId,
        templateId: params.templateId || null,
        name: params.name.trim(),
        modality: params.modality,
        status: "SCHEDULED",
        scheduledStart: params.scheduledStart,
        durationMinutes: params.durationMinutes ?? null,
        location: params.location?.trim() || null,
        facilitatorId: params.facilitatorId || null,
      })
      .returning({ id: cohortSessions.id });

    const expected = await openRegister(tx, created.id, cohortId);

    // Pin the content that is published right now, so "which version did this
    // cohort receive?" is answerable later (D-027). Pins nothing when the
    // session has no template or nothing is published yet.
    const pinned = await pinSessionContent(tx, {
      studyId,
      cohortSessionId: created.id,
      templateId: params.templateId || null,
      actorId,
    });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "session.scheduled",
      entityType: "cohort_session",
      entityId: created.id,
      after: {
        cohortCode: cohort.code,
        name: params.name.trim(),
        modality: params.modality,
        scheduledStart: params.scheduledStart.toISOString(),
        expectedParticipants: expected,
        pinnedContentVersions: pinned,
      },
    });

    // The ANCHOR is the session's start, not now: "24 h before session 2" is
    // relative to when session 2 happens (Phase 8). Inside this transaction, so
    // a session and the work scheduled around it commit together.
    await recordStudyEvent(tx, {
      studyId,
      eventType: "SESSION_SCHEDULED",
      subject: { kind: "SESSION", id: created.id },
      anchorAt: params.scheduledStart,
      metadata: { cohortCode: cohort.code, modality: params.modality },
    });

    return created.id;
  });
}

/** Insert EXPECTED rows for every current cohort member. Idempotent. */
async function openRegister(
  tx: DbExecutor,
  sessionId: string,
  cohortId: string,
): Promise<number> {
  const members = await tx
    .select({ participantId: participantCohortAssignments.participantId })
    .from(participantCohortAssignments)
    .where(
      and(
        eq(participantCohortAssignments.cohortId, cohortId),
        isNull(participantCohortAssignments.removedAt),
      ),
    );

  if (members.length === 0) return 0;

  await tx
    .insert(sessionAttendance)
    .values(members.map((m) => ({ sessionId, participantId: m.participantId, status: "EXPECTED" as const })))
    .onConflictDoNothing();

  return members.length;
}

/**
 * Re-sync the register with current cohort membership. Adds EXPECTED rows for
 * members who joined after the session was scheduled; never removes anyone,
 * because an existing record of who was expected is history.
 */
export async function refreshRegister(params: {
  studyId: string;
  sessionId: string;
  actorId: string;
}): Promise<number> {
  const { studyId, sessionId, actorId } = params;

  return getDb().transaction(async (tx) => {
    const [session] = await tx
      .select({ id: cohortSessions.id, cohortId: cohortSessions.cohortId })
      .from(cohortSessions)
      .where(and(eq(cohortSessions.id, sessionId), eq(cohortSessions.studyId, studyId)))
      .limit(1);
    if (!session) throw new NotFoundError("session", sessionId);

    const before = await tx
      .select({ id: sessionAttendance.id })
      .from(sessionAttendance)
      .where(eq(sessionAttendance.sessionId, sessionId));

    await openRegister(tx, sessionId, session.cohortId);

    const after = await tx
      .select({ id: sessionAttendance.id })
      .from(sessionAttendance)
      .where(eq(sessionAttendance.sessionId, sessionId));

    const added = after.length - before.length;
    if (added > 0) {
      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "session.register_refreshed",
        entityType: "cohort_session",
        entityId: sessionId,
        after: { added, total: after.length },
      });
    }
    return added;
  });
}

export async function setSessionStatus(params: {
  studyId: string;
  sessionId: string;
  actorId: string;
  status: Extract<SessionStatus, "HELD" | "CANCELLED">;
}): Promise<void> {
  const { studyId, sessionId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: cohortSessions.id, status: cohortSessions.status, name: cohortSessions.name })
      .from(cohortSessions)
      .where(and(eq(cohortSessions.id, sessionId), eq(cohortSessions.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("session", sessionId);
    if (!canTransitionSession(current.status, status)) {
      throw new InvalidTransitionError(current.status, status);
    }

    await tx.update(cohortSessions).set({ status }).where(eq(cohortSessions.id, sessionId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "session.status_changed",
      entityType: "cohort_session",
      entityId: sessionId,
      before: { status: current.status },
      after: { status, name: current.name },
    });

    // A cancelled session invalidates every reminder still planned against it;
    // `recordStudyEvent` cancels them rather than editing them in place, so the
    // audit trail of what was planned survives (docs/automations.md).
    await recordStudyEvent(tx, {
      studyId,
      eventType: status === "HELD" ? "SESSION_HELD" : "SESSION_CANCELLED",
      subject: { kind: "SESSION", id: sessionId },
      metadata: { previousStatus: current.status },
    });
  });
}

/**
 * Record one participant's attendance.
 *
 * TECHNICAL_FAILURE is recorded as itself and is never rewritten to ABSENT.
 * Attendance stays editable after a session is HELD because corrections are
 * ordinary; every change writes its own audit row with the previous value.
 */
export async function recordAttendance(params: {
  studyId: string;
  sessionId: string;
  participantId: string;
  actorId: string;
  status: AttendanceStatus;
}): Promise<void> {
  const { studyId, sessionId, participantId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: sessionAttendance.id,
        status: sessionAttendance.status,
        participantCode: participants.code,
      })
      .from(sessionAttendance)
      .innerJoin(participants, eq(participants.id, sessionAttendance.participantId))
      .innerJoin(cohortSessions, eq(cohortSessions.id, sessionAttendance.sessionId))
      .where(
        and(
          eq(sessionAttendance.sessionId, sessionId),
          eq(sessionAttendance.participantId, participantId),
          eq(cohortSessions.studyId, studyId),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundError("attendance record", participantId);
    if (current.status === status) return;

    await tx
      .update(sessionAttendance)
      .set({ status, recordedBy: actorId, recordedAt: new Date() })
      .where(eq(sessionAttendance.id, current.id));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "attendance.recorded",
      entityType: "session_attendance",
      entityId: current.id,
      before: { status: current.status },
      after: { status, participantCode: current.participantCode },
      metadata: { sessionId },
    });
  });
}

/** Sessions still to happen, for the overview. */
export async function countUpcomingSessions(
  studyId: string,
  options: { scope: CohortScope },
): Promise<number> {
  const narrowing = scopeFilter(options.scope);
  const filters = [eq(cohortSessions.studyId, studyId), eq(cohortSessions.status, "SCHEDULED")];
  if (narrowing) filters.push(narrowing);

  const rows = await getDb()
    .select({ id: cohortSessions.id })
    .from(cohortSessions)
    .where(and(...filters));
  return rows.length;
}
