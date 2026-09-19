import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { recordStudyEvent } from "./automation";
import type { CohortScope } from "@/auth/cohort-scope";
import { getDb, type DbExecutor } from "@/db/client";
import {
  cohortNotes,
  cohortStaff,
  cohorts,
  consents,
  participantCohortAssignments,
  participantContacts,
  participants,
  randomizations,
  studyArms,
  userRoles,
  users,
  type Cohort,
  type CohortNote,
  type StudyArm,
} from "@/db/schema";
import type { NoteColor } from "@/domain/cohort-note";
import {
  acceptsAssignments,
  assessCohortSize,
  canTransitionCohort,
  checkArmCompatibility,
  sizeBlocksTransition,
  sizeIsCheckedAt,
  type CohortSize,
  type CohortStatus,
} from "@/domain/cohort";
import { canTransitionEnrollment, type EnrollmentStatus } from "@/domain/participant-state";
import { manualEntryProvider } from "@/domain/randomization";

/**
 * Cohorts, membership and recorded allocations (Phase 3a).
 *
 * Reads take a CohortScope and narrow to it, which is how facilitators are
 * limited to the cohorts they run. Writes run in one transaction with their
 * audit rows.
 *
 * Nothing here randomizes anyone: `recordRandomization` stores an outcome that
 * an approved mechanism produced elsewhere.
 */

export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`Cannot move ${entity} from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * A cohort was marked ACTIVE while outside its configured size.
 *
 * Deliberately NOT a ConflictError. It is not a data-integrity failure — the
 * write would be perfectly consistent — it is the application asking a person to
 * confirm that they mean it. The caller can repeat the request with
 * `overrideReason` and the override is recorded in the audit row.
 */
export class CohortSizeError extends Error {
  readonly verdict: "UNDER" | "OVER";
  readonly size: CohortSize;
  constructor(verdict: "UNDER" | "OVER", size: CohortSize) {
    super(`Cohort is ${verdict} its configured size`);
    this.name = "CohortSizeError";
    this.verdict = verdict;
    this.size = size;
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
    | "alreadyRandomized"
    | "alreadyAssigned"
    | "cohortClosed"
    | "duplicateCode"
    /** The participant's recorded arm is not the arm this cohort runs. */
    | "armMismatch"
    /** The cohort runs one arm and no allocation has been recorded yet. */
    | "armNotRecorded"
    /** Already in the cohort being moved to; nothing to do. */
    | "sameCohort";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

/** Applies cohort narrowing to a query. An empty scope matches nothing. */
function scopeFilter(scope: CohortScope) {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`false`;
  return inArray(cohorts.id, scope);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface CohortListRow extends Cohort {
  memberCount: number;
  /** Active `cohort_staff` rows — a subquery, not a second join, so it can't
   * fan out `memberCount`'s single-join count (2026-09-18 request: surface
   * team size on the cohort stack's compact card). */
  staffCount: number;
  /** Members against configured bounds. Never a judgement, just arithmetic. */
  size: CohortSize;
  armCode: string | null;
}

export async function listCohorts(
  studyId: string,
  options: { scope: CohortScope },
): Promise<CohortListRow[]> {
  const narrowing = scopeFilter(options.scope);

  const rows = await getDb()
    .select({
      cohort: cohorts,
      memberCount: count(participantCohortAssignments.id),
      staffCount: sql<number>`(
        select count(*)::int from cohort_staff cs
        where cs.cohort_id = ${cohorts.id} and cs.revoked_at is null
      )`,
      armCode: studyArms.code,
    })
    .from(cohorts)
    .leftJoin(
      participantCohortAssignments,
      and(
        eq(participantCohortAssignments.cohortId, cohorts.id),
        isNull(participantCohortAssignments.removedAt),
      ),
    )
    .leftJoin(studyArms, eq(studyArms.id, cohorts.armId))
    .where(narrowing ? and(eq(cohorts.studyId, studyId), narrowing) : eq(cohorts.studyId, studyId))
    .groupBy(cohorts.id, studyArms.code)
    .orderBy(asc(cohorts.code));

  return rows.map((r) => ({
    ...r.cohort,
    memberCount: Number(r.memberCount),
    staffCount: Number(r.staffCount),
    armCode: r.armCode,
    size: assessCohortSize({
      members: Number(r.memberCount),
      minSize: r.cohort.minSize,
      maxSize: r.cohort.maxSize,
    }),
  }));
}

export interface CohortDetail {
  cohort: Cohort;
  staff: { userId: string; displayName: string; assignedAt: Date }[];
  members: {
    participantId: string;
    code: string;
    fullName: string | null;
    assignedAt: Date;
    armCode: string | null;
    enrollmentStatus: EnrollmentStatus | null;
  }[];
}

export async function getCohortDetail(
  studyId: string,
  cohortId: string,
  options: { scope: CohortScope; includeContact: boolean },
): Promise<CohortDetail | null> {
  const db = getDb();
  const narrowing = scopeFilter(options.scope);

  const [cohort] = await db
    .select()
    .from(cohorts)
    .where(
      narrowing
        ? and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId), narrowing)
        : and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)),
    )
    .limit(1);

  if (!cohort) return null;

  const [staff, members] = await Promise.all([
    db
      .select({
        userId: cohortStaff.userId,
        displayName: users.displayName,
        assignedAt: cohortStaff.assignedAt,
      })
      .from(cohortStaff)
      .innerJoin(users, eq(users.id, cohortStaff.userId))
      .where(and(eq(cohortStaff.cohortId, cohortId), isNull(cohortStaff.revokedAt)))
      .orderBy(asc(users.displayName)),
    db
      .select({
        participantId: participants.id,
        code: participants.code,
        fullName: options.includeContact ? participantContacts.fullName : sql<null>`null`,
        assignedAt: participantCohortAssignments.assignedAt,
        armCode: studyArms.code,
        enrollmentStatus: participants.enrollmentStatus,
      })
      .from(participantCohortAssignments)
      .innerJoin(participants, eq(participants.id, participantCohortAssignments.participantId))
      .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
      .leftJoin(randomizations, eq(randomizations.participantId, participants.id))
      .leftJoin(studyArms, eq(studyArms.id, randomizations.armId))
      .where(
        and(
          eq(participantCohortAssignments.cohortId, cohortId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .orderBy(asc(participants.code)),
  ]);

  return { cohort, staff, members: members as CohortDetail["members"] };
}

export async function listStudyArms(studyId: string): Promise<StudyArm[]> {
  return getDb()
    .select()
    .from(studyArms)
    .where(and(eq(studyArms.studyId, studyId), eq(studyArms.active, true)))
    .orderBy(asc(studyArms.position), asc(studyArms.code));
}

/** Cohorts a participant may be assigned to: open for assignment, in scope. */
export async function listAssignableCohorts(
  studyId: string,
  options: { scope: CohortScope },
): Promise<Cohort[]> {
  const all = await listCohorts(studyId, options);
  return all.filter((c) => acceptsAssignments(c.status));
}

/** The participant's current allocation and cohort, for the participant page. */
export async function getParticipantPlacement(
  studyId: string,
  participantId: string,
): Promise<{
  randomization: {
    armId: string;
    armCode: string;
    armName: string;
    allocatedAt: Date;
    externalRecordId: string | null;
    /** Configured on the arm, never decided here (D-032). */
    requiresPhysicalConsent: boolean;
  } | null;
  cohort: { id: string; code: string; name: string } | null;
}> {
  const db = getDb();

  const [[allocation], [assignment]] = await Promise.all([
    db
      .select({
        armId: studyArms.id,
        armCode: studyArms.code,
        armName: studyArms.nameEs,
        allocatedAt: randomizations.allocatedAt,
        externalRecordId: randomizations.externalRecordId,
        requiresPhysicalConsent: studyArms.requiresPhysicalConsent,
      })
      .from(randomizations)
      .innerJoin(studyArms, eq(studyArms.id, randomizations.armId))
      .where(and(eq(randomizations.participantId, participantId), eq(randomizations.studyId, studyId)))
      .limit(1),
    db
      .select({ id: cohorts.id, code: cohorts.code, name: cohorts.name })
      .from(participantCohortAssignments)
      .innerJoin(cohorts, eq(cohorts.id, participantCohortAssignments.cohortId))
      .where(
        and(
          eq(participantCohortAssignments.participantId, participantId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1),
  ]);

  return { randomization: allocation ?? null, cohort: assignment ?? null };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createCohort(params: {
  studyId: string;
  actorId: string;
  code: string;
  name: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  armId?: string | null;
  minSize?: number | null;
  maxSize?: number | null;
}): Promise<string> {
  const { studyId, actorId } = params;
  const code = params.code.trim().toUpperCase();
  const name = params.name.trim();

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: cohorts.id })
      .from(cohorts)
      .where(and(eq(cohorts.studyId, studyId), eq(cohorts.code, code)))
      .limit(1);
    if (existing) throw new ConflictError("duplicateCode");

    const [created] = await tx
      .insert(cohorts)
      .values({
        studyId,
        code,
        name,
        status: "PLANNING",
        plannedStartDate: params.plannedStartDate || null,
        plannedEndDate: params.plannedEndDate || null,
        armId: params.armId || null,
        minSize: params.minSize ?? null,
        maxSize: params.maxSize ?? null,
      })
      .returning({ id: cohorts.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort.created",
      entityType: "cohort",
      entityId: created.id,
      after: {
        code,
        name,
        status: "PLANNING",
        armId: params.armId || null,
        minSize: params.minSize ?? null,
        maxSize: params.maxSize ?? null,
      },
    });

    return created.id;
  });
}

export async function advanceCohortStatus(params: {
  studyId: string;
  cohortId: string;
  actorId: string;
  status: CohortStatus;
  /**
   * Set to proceed despite the cohort being outside its configured size. The
   * reason is recorded on the audit row, so an under-sized cohort that ran
   * anyway is answerable afterwards rather than invisible.
   */
  overrideReason?: string | null;
}): Promise<void> {
  const { studyId, cohortId, actorId, status } = params;
  const overrideReason = params.overrideReason?.trim() || null;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: cohorts.id,
        status: cohorts.status,
        code: cohorts.code,
        minSize: cohorts.minSize,
        maxSize: cohorts.maxSize,
      })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("cohort", cohortId);
    if (!canTransitionCohort(current.status, status)) {
      throw new InvalidTransitionError("cohort", current.status, status);
    }

    // The size rule bites HERE and nowhere else (D-033). Assignment is never
    // refused on size; the question "is this cohort ready to run" is asked once,
    // at the moment someone says it is running.
    const [memberRow] = await tx
      .select({ n: count() })
      .from(participantCohortAssignments)
      .where(
        and(
          eq(participantCohortAssignments.cohortId, cohortId),
          isNull(participantCohortAssignments.removedAt),
        ),
      );

    const size = assessCohortSize({
      members: Number(memberRow?.n ?? 0),
      minSize: current.minSize,
      maxSize: current.maxSize,
    });

    const blocked = sizeBlocksTransition(status, size);
    if (blocked && blocked !== "UNBOUNDED" && blocked !== "WITHIN" && !overrideReason) {
      throw new CohortSizeError(blocked, size);
    }

    await tx.update(cohorts).set({ status }).where(eq(cohorts.id, cohortId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort.status_changed",
      entityType: "cohort",
      entityId: cohortId,
      before: { status: current.status },
      after: { status, code: current.code },
      // Always recorded at a size-checked status, override or not, so the state
      // the cohort actually started in is on the record either way.
      metadata: sizeIsCheckedAt(status)
        ? {
            memberCount: size.members,
            minSize: size.minSize,
            maxSize: size.maxSize,
            sizeVerdict: size.verdict,
            sizeOverridden: Boolean(blocked && overrideReason),
            sizeOverrideReason: blocked && overrideReason ? overrideReason : null,
          }
        : null,
    });

    await recordStudyEvent(tx, {
      studyId,
      eventType: "COHORT_STATUS_CHANGED",
      subject: { kind: "COHORT", id: cohortId },
      metadata: { cohortCode: current.code, from: current.status, to: status },
    });
  });
}

/**
 * Record an allocation produced by an approved mechanism elsewhere.
 *
 * Per D-021 this does NOT refuse on the basis of consent or eligibility: staff
 * record what happened. The participant's consent and eligibility state at the
 * moment of recording is captured in the audit row instead, so the record is
 * complete and any anomaly is reviewable afterwards rather than being silently
 * lost. A second allocation for the same participant is rejected as a
 * data-integrity error, not a clinical rule.
 */
export async function recordRandomization(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  armId: string;
  allocatedAt: Date;
  externalRecordId?: string | null;
}): Promise<string> {
  const { studyId, participantId, actorId, armId, allocatedAt } = params;

  return getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({
        id: participants.id,
        code: participants.code,
        eligibilityStatus: participants.eligibilityStatus,
        enrollmentStatus: participants.enrollmentStatus,
      })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [arm] = await tx
      .select({ id: studyArms.id, code: studyArms.code })
      .from(studyArms)
      .where(and(eq(studyArms.id, armId), eq(studyArms.studyId, studyId)))
      .limit(1);
    if (!arm) throw new NotFoundError("study arm", armId);

    const [already] = await tx
      .select({ id: randomizations.id })
      .from(randomizations)
      .where(eq(randomizations.participantId, participantId))
      .limit(1);
    if (already) throw new ConflictError("alreadyRandomized");

    // Read, do not enforce: this is context for the audit record.
    //
    // The most recent consent row of ANY status, not just an active one, so the
    // audit can tell "never consented" (null) apart from "consented, then
    // withdrew" (WITHDRAWN). Both are anomalies worth seeing later, and they are
    // not the same anomaly.
    const [latestConsent] = await tx
      .select({ status: consents.status })
      .from(consents)
      .where(eq(consents.participantId, participantId))
      .orderBy(desc(consents.createdAt))
      .limit(1);

    const [activeConsent] = await tx
      .select({ status: consents.status })
      .from(consents)
      .where(
        and(
          eq(consents.participantId, participantId),
          inArray(consents.status, ["PENDING", "CONSENTED"]),
        ),
      )
      .limit(1);

    const allocation = manualEntryProvider.resolve({
      armId: arm.id,
      allocatedAt,
      externalRecordId: params.externalRecordId?.trim() || null,
    });

    const [created] = await tx
      .insert(randomizations)
      .values({
        studyId,
        participantId,
        armId: allocation.armId,
        method: allocation.method,
        allocatedAt: allocation.allocatedAt,
        externalRecordId: allocation.externalRecordId,
        recordedBy: actorId,
      })
      .returning({ id: randomizations.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "randomization.recorded",
      entityType: "randomization",
      entityId: created.id,
      after: {
        participantCode: participant.code,
        armCode: arm.code,
        method: allocation.method,
        allocatedAt: allocation.allocatedAt.toISOString(),
        externalRecordId: allocation.externalRecordId,
      },
      // State at the moment of recording. Captured because the application
      // deliberately does not refuse (D-021), so the reviewer needs to see it.
      metadata: {
        /** Latest consent of any status; null means no consent was ever recorded. */
        latestConsentStatusAtRecording: latestConsent?.status ?? null,
        /** Whether a consent was actually in force at that moment. */
        hadActiveConsentAtRecording: Boolean(activeConsent),
        eligibilityStatusAtRecording: participant.eligibilityStatus,
      },
    });

    if (canTransitionEnrollment(participant.enrollmentStatus, "RANDOMIZED")) {
      await tx
        .update(participants)
        .set({ enrollmentStatus: "RANDOMIZED" })
        .where(eq(participants.id, participantId));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant.enrollment_changed",
        entityType: "participant",
        entityId: participantId,
        before: { enrollmentStatus: participant.enrollmentStatus },
        after: { enrollmentStatus: "RANDOMIZED" },
        metadata: { via: "randomization", randomizationId: created.id },
      });
    }

    await recordStudyEvent(tx, {
      studyId,
      eventType: "ALLOCATION_RECORDED",
      subject: { kind: "PARTICIPANT", id: participantId },
      // The arm CODE is not carried here. An event is read by the processor and
      // shown in operational screens; which arm somebody is in is research data
      // that belongs on the randomization row, not in a log that drives reminders.
      metadata: { participantCode: participant.code },
    });

    return created.id;
  });
}

/**
 * Check that a participant may join a cohort on arm grounds, inside the caller's
 * transaction.
 *
 * A cohort with no arm takes anyone — the pre-Phase-4c behaviour, and still the
 * default. Once a cohort names an arm, a participant from another arm is a data
 * error rather than an operational judgement: their recorded allocation and the
 * group they actually attend would disagree, and every attendance figure built
 * on the cohort would then be wrong.
 *
 * An unallocated participant is refused too. That is the deliberate part: they
 * are not compatible by default, and assigning someone to an arm-specific cohort
 * before anyone knows their arm is exactly the accident this prevents.
 */
async function assertArmCompatible(
  tx: DbExecutor,
  cohortArmId: string | null,
  participantId: string,
): Promise<string | null> {
  if (cohortArmId === null) return null;

  const [allocation] = await tx
    .select({ armId: randomizations.armId })
    .from(randomizations)
    .where(eq(randomizations.participantId, participantId))
    .limit(1);

  const verdict = checkArmCompatibility({
    cohortArmId,
    participantArmId: allocation?.armId ?? null,
  });
  if (verdict === "MISMATCH") throw new ConflictError("armMismatch");
  if (verdict === "ARM_NOT_RECORDED") throw new ConflictError("armNotRecorded");
  return allocation?.armId ?? null;
}

/** Put a participant into a cohort. One active cohort per participant. */
export async function assignToCohort(params: {
  studyId: string;
  cohortId: string;
  participantId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, cohortId, participantId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select({
        id: cohorts.id,
        code: cohorts.code,
        status: cohorts.status,
        armId: cohorts.armId,
      })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);
    if (!acceptsAssignments(cohort.status)) throw new ConflictError("cohortClosed");

    const [participant] = await tx
      .select({
        id: participants.id,
        code: participants.code,
        enrollmentStatus: participants.enrollmentStatus,
      })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [existing] = await tx
      .select({ id: participantCohortAssignments.id })
      .from(participantCohortAssignments)
      .where(
        and(
          eq(participantCohortAssignments.participantId, participantId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1);
    if (existing) throw new ConflictError("alreadyAssigned");

    await assertArmCompatible(tx, cohort.armId, participantId);

    const [created] = await tx
      .insert(participantCohortAssignments)
      .values({ studyId, cohortId, participantId, assignedBy: actorId })
      .returning({ id: participantCohortAssignments.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_assignment.created",
      entityType: "participant_cohort_assignment",
      entityId: created.id,
      after: { participantCode: participant.code, cohortCode: cohort.code },
    });

    if (canTransitionEnrollment(participant.enrollmentStatus, "COHORT_ASSIGNED")) {
      await tx
        .update(participants)
        .set({ enrollmentStatus: "COHORT_ASSIGNED" })
        .where(eq(participants.id, participantId));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant.enrollment_changed",
        entityType: "participant",
        entityId: participantId,
        before: { enrollmentStatus: participant.enrollmentStatus },
        after: { enrollmentStatus: "COHORT_ASSIGNED" },
        metadata: { via: "cohort_assignment", cohortCode: cohort.code },
      });
    }

    await recordStudyEvent(tx, {
      studyId,
      eventType: "COHORT_ASSIGNED",
      subject: { kind: "PARTICIPANT", id: participantId },
      metadata: { participantCode: participant.code, cohortCode: cohort.code },
    });
  });
}

/**
 * Move a participant from one cohort to another, in ONE transaction.
 *
 * Why this exists rather than "remove, then assign": done as two actions there
 * is a moment where the person belongs to no cohort, and if the second fails
 * they simply stay there. Both records are historical either way — the old
 * assignment gets `removedAt`, a new row is inserted — but as one transaction
 * the move either happens or does not, and the audit rows carry `movedFrom` /
 * `movedTo` so the change reads as a transfer instead of as an unexplained
 * departure followed by an unexplained arrival.
 *
 * The destination is checked exactly as a fresh assignment would be: it must be
 * open, and the arm must match.
 */
export async function transferToCohort(params: {
  studyId: string;
  participantId: string;
  toCohortId: string;
  actorId: string;
  reason?: string | null;
}): Promise<void> {
  const { studyId, participantId, toCohortId, actorId } = params;
  const reason = params.reason?.trim() || null;

  await getDb().transaction(async (tx) => {
    const [to] = await tx
      .select({ id: cohorts.id, code: cohorts.code, status: cohorts.status, armId: cohorts.armId })
      .from(cohorts)
      .where(and(eq(cohorts.id, toCohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!to) throw new NotFoundError("cohort", toCohortId);
    if (!acceptsAssignments(to.status)) throw new ConflictError("cohortClosed");

    const [participant] = await tx
      .select({ id: participants.id, code: participants.code })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [current] = await tx
      .select({
        id: participantCohortAssignments.id,
        cohortId: participantCohortAssignments.cohortId,
        cohortCode: cohorts.code,
      })
      .from(participantCohortAssignments)
      .innerJoin(cohorts, eq(cohorts.id, participantCohortAssignments.cohortId))
      .where(
        and(
          eq(participantCohortAssignments.participantId, participantId),
          eq(participantCohortAssignments.studyId, studyId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundError("cohort assignment", participantId);
    if (current.cohortId === toCohortId) throw new ConflictError("sameCohort");

    await assertArmCompatible(tx, to.armId, participantId);

    await tx
      .update(participantCohortAssignments)
      .set({ removedAt: new Date(), removedBy: actorId })
      .where(eq(participantCohortAssignments.id, current.id));

    const [created] = await tx
      .insert(participantCohortAssignments)
      .values({ studyId, cohortId: toCohortId, participantId, assignedBy: actorId })
      .returning({ id: participantCohortAssignments.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_assignment.moved",
      entityType: "participant_cohort_assignment",
      entityId: created.id,
      before: { cohortCode: current.cohortCode },
      after: { cohortCode: to.code, participantCode: participant.code },
      metadata: {
        movedFrom: current.cohortId,
        movedTo: toCohortId,
        previousAssignmentId: current.id,
        reason,
      },
    });
  });
}

/** Remove a participant from their cohort. Historical: sets removedAt. */
export async function removeFromCohort(params: {
  studyId: string;
  participantId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, participantId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [assignment] = await tx
      .select({
        id: participantCohortAssignments.id,
        cohortId: participantCohortAssignments.cohortId,
      })
      .from(participantCohortAssignments)
      .where(
        and(
          eq(participantCohortAssignments.participantId, participantId),
          eq(participantCohortAssignments.studyId, studyId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1);
    if (!assignment) throw new NotFoundError("cohort assignment", participantId);

    await tx
      .update(participantCohortAssignments)
      .set({ removedAt: new Date(), removedBy: actorId })
      .where(eq(participantCohortAssignments.id, assignment.id));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_assignment.removed",
      entityType: "participant_cohort_assignment",
      entityId: assignment.id,
      before: { cohortId: assignment.cohortId, active: true },
      after: { active: false },
    });
  });
}

/** Assign a staff member to run a cohort. This also widens what they can see. */
export async function assignCohortStaff(params: {
  studyId: string;
  cohortId: string;
  userId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, cohortId, userId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select({ id: cohorts.id, code: cohorts.code })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);

    const [existing] = await tx
      .select({ id: cohortStaff.id })
      .from(cohortStaff)
      .where(
        and(
          eq(cohortStaff.cohortId, cohortId),
          eq(cohortStaff.userId, userId),
          isNull(cohortStaff.revokedAt),
        ),
      )
      .limit(1);
    if (existing) return;

    const [created] = await tx
      .insert(cohortStaff)
      .values({ cohortId, userId, assignedBy: actorId })
      .returning({ id: cohortStaff.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_staff.assigned",
      entityType: "cohort_staff",
      entityId: created.id,
      after: { cohortCode: cohort.code, userId },
      // Flagged because this grants visibility, not just a work assignment.
      metadata: { grantsCohortVisibility: true },
    });
  });
}

export async function revokeCohortStaff(params: {
  studyId: string;
  cohortId: string;
  userId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, cohortId, userId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: cohortStaff.id })
      .from(cohortStaff)
      .innerJoin(cohorts, eq(cohorts.id, cohortStaff.cohortId))
      .where(
        and(
          eq(cohortStaff.cohortId, cohortId),
          eq(cohortStaff.userId, userId),
          eq(cohorts.studyId, studyId),
          isNull(cohortStaff.revokedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundError("cohort staff", userId);

    await tx
      .update(cohortStaff)
      .set({ revokedAt: new Date(), revokedBy: actorId })
      .where(eq(cohortStaff.id, row.id));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_staff.revoked",
      entityType: "cohort_staff",
      entityId: row.id,
      before: { active: true },
      after: { active: false, userId },
      metadata: { grantsCohortVisibility: false },
    });
  });
}

/** Staff who could be assigned to a cohort: active members of the study. */
export async function listAssignableStaff(
  studyId: string,
): Promise<{ id: string; displayName: string }[]> {
  const rows = await getDb()
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
    .orderBy(asc(users.displayName));
  return rows;
}

// ---------------------------------------------------------------------------
// Sticky notes (2026-09-19 request)
// ---------------------------------------------------------------------------

export async function listCohortNotes(
  studyId: string,
  cohortId: string,
): Promise<(CohortNote & { authorName: string | null })[]> {
  const rows = await getDb()
    .select({ note: cohortNotes, authorName: users.displayName })
    .from(cohortNotes)
    .leftJoin(users, eq(users.id, cohortNotes.createdBy))
    .where(and(eq(cohortNotes.studyId, studyId), eq(cohortNotes.cohortId, cohortId)))
    .orderBy(desc(cohortNotes.createdAt));
  return rows.map((r) => ({ ...r.note, authorName: r.authorName }));
}

export async function createCohortNote(params: {
  studyId: string;
  cohortId: string;
  actorId: string;
  color: NoteColor;
  body: string;
}): Promise<string> {
  const { studyId, cohortId, actorId, color } = params;
  const body = params.body.trim();

  return getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select({ id: cohorts.id })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);

    const [created] = await tx
      .insert(cohortNotes)
      .values({ studyId, cohortId, color, body, createdBy: actorId })
      .returning({ id: cohortNotes.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_note.created",
      entityType: "cohort_note",
      entityId: created.id,
      // The note text itself is not audited (free text is never stored in a
      // snapshot in this codebase) — only that one was added, and its colour.
      after: { cohortId, color, length: body.length },
    });

    return created.id;
  });
}

export async function deleteCohortNote(params: {
  studyId: string;
  noteId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, noteId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [note] = await tx
      .select({ id: cohortNotes.id, cohortId: cohortNotes.cohortId })
      .from(cohortNotes)
      .where(and(eq(cohortNotes.id, noteId), eq(cohortNotes.studyId, studyId)))
      .limit(1);
    if (!note) throw new NotFoundError("cohort note", noteId);

    await tx.delete(cohortNotes).where(eq(cohortNotes.id, noteId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_note.deleted",
      entityType: "cohort_note",
      entityId: noteId,
      before: { cohortId: note.cohortId },
    });
  });
}

/** Counts for the overview. */
export async function countCohorts(
  studyId: string,
  options: { scope: CohortScope },
): Promise<number> {
  const narrowing = scopeFilter(options.scope);
  const [row] = await getDb()
    .select({ n: count() })
    .from(cohorts)
    .where(narrowing ? and(eq(cohorts.studyId, studyId), narrowing) : eq(cohorts.studyId, studyId));
  return Number(row?.n ?? 0);
}
