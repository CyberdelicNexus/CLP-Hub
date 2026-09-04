import "server-only";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import {
  consents,
  participantContacts,
  participants,
  screenings,
  type Consent,
  type Screening,
} from "@/db/schema";
import {
  canTransitionConsent,
  enrollmentStatusForConsent,
  type ConsentStatus,
} from "@/domain/consent";
import {
  canTransitionEligibility,
  canTransitionEnrollment,
  type EligibilityStatus,
  type EnrollmentStatus,
} from "@/domain/participant-state";
import type { RecruitmentStatus } from "@/domain/recruitment";
import {
  canTransitionScreening,
  RECRUITMENT_STATUS_WHEN_SCHEDULED,
  type ScreeningStatus,
} from "@/domain/screening";

/**
 * Participant operations (Phase 2): screening and consent.
 *
 * Every write runs in one transaction with its audit rows. Nothing here decides
 * anything about a participant: eligibility results and consent decisions are
 * produced outside this application and recorded by staff. No screening answers,
 * scores or clinical notes are read or written — see
 * docs/research-data-boundaries.md.
 */

export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string | null, to: string) {
    super(`Cannot move ${entity} from ${from ?? "none"} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ParticipantListRow {
  id: string;
  code: string;
  recruitmentStatus: RecruitmentStatus;
  eligibilityStatus: EligibilityStatus;
  enrollmentStatus: EnrollmentStatus | null;
  createdAt: Date;
  /** Only populated when the caller holds participants.contact.read. */
  fullName: string | null;
}

/**
 * Participants in a study, newest first. As in Phase 1, contact columns are not
 * selected at all unless the caller may see them.
 */
export async function listParticipants(
  studyId: string,
  options: {
    includeContact: boolean;
    eligibility?: EligibilityStatus;
    limit?: number;
  },
): Promise<ParticipantListRow[]> {
  const { includeContact, eligibility, limit = 200 } = options;

  const rows = await getDb()
    .select({
      id: participants.id,
      code: participants.code,
      recruitmentStatus: participants.recruitmentStatus,
      eligibilityStatus: participants.eligibilityStatus,
      enrollmentStatus: participants.enrollmentStatus,
      createdAt: participants.createdAt,
      fullName: includeContact ? participantContacts.fullName : sql<null>`null`,
    })
    .from(participants)
    .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
    .where(
      eligibility
        ? and(eq(participants.studyId, studyId), eq(participants.eligibilityStatus, eligibility))
        : eq(participants.studyId, studyId),
    )
    .orderBy(desc(participants.createdAt))
    .limit(limit);

  return rows as ParticipantListRow[];
}

export interface ParticipantDetail {
  participant: {
    id: string;
    code: string;
    recruitmentStatus: RecruitmentStatus;
    eligibilityStatus: EligibilityStatus;
    enrollmentStatus: EnrollmentStatus | null;
    createdAt: Date;
  };
  contact: { fullName: string | null; email: string | null; phone: string | null } | null;
  screenings: Screening[];
  consents: Consent[];
}

export async function getParticipantDetail(
  studyId: string,
  participantId: string,
  options: { includeContact: boolean; includeScreening: boolean; includeConsent: boolean },
): Promise<ParticipantDetail | null> {
  const db = getDb();

  const [participant] = await db
    .select({
      id: participants.id,
      code: participants.code,
      recruitmentStatus: participants.recruitmentStatus,
      eligibilityStatus: participants.eligibilityStatus,
      enrollmentStatus: participants.enrollmentStatus,
      createdAt: participants.createdAt,
    })
    .from(participants)
    .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
    .limit(1);

  if (!participant) return null;

  // Each sub-resource is gated by its own permission, so a viewer who may see a
  // participant but not their consent history simply gets an empty list.
  const [contact, screeningRows, consentRows] = await Promise.all([
    options.includeContact
      ? db
          .select({
            fullName: participantContacts.fullName,
            email: participantContacts.email,
            phone: participantContacts.phone,
          })
          .from(participantContacts)
          .where(eq(participantContacts.participantId, participantId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    options.includeScreening
      ? db
          .select()
          .from(screenings)
          .where(eq(screenings.participantId, participantId))
          .orderBy(desc(screenings.createdAt))
      : Promise.resolve([] as Screening[]),
    options.includeConsent
      ? db
          .select()
          .from(consents)
          .where(eq(consents.participantId, participantId))
          .orderBy(desc(consents.createdAt))
      : Promise.resolve([] as Consent[]),
  ]);

  return { participant, contact, screenings: screeningRows, consents: consentRows };
}

/** Screenings that still need to happen, for the evaluation queue. */
export async function listOpenScreenings(
  studyId: string,
  options: { includeContact: boolean; limit?: number },
): Promise<
  {
    id: string;
    participantId: string;
    participantCode: string;
    status: ScreeningStatus;
    scheduledAt: Date | null;
    fullName: string | null;
  }[]
> {
  const rows = await getDb()
    .select({
      id: screenings.id,
      participantId: participants.id,
      participantCode: participants.code,
      status: screenings.status,
      scheduledAt: screenings.scheduledAt,
      fullName: options.includeContact ? participantContacts.fullName : sql<null>`null`,
    })
    .from(screenings)
    .innerJoin(participants, eq(participants.id, screenings.participantId))
    .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
    .where(and(eq(screenings.studyId, studyId), eq(screenings.status, "SCHEDULED")))
    .orderBy(screenings.scheduledAt)
    .limit(options.limit ?? 100);

  return rows as Awaited<ReturnType<typeof listOpenScreenings>>;
}

export interface ParticipantOpsCounts {
  screeningPending: number;
  eligible: number;
  enrolled: number;
}

/** Counts for the overview tiles. Each is a plain fact, not a derived judgement. */
export async function countParticipantOps(studyId: string): Promise<ParticipantOpsCounts> {
  const db = getDb();
  const [pending, eligible, enrolled] = await Promise.all([
    db
      .select({ n: count() })
      .from(screenings)
      .where(and(eq(screenings.studyId, studyId), eq(screenings.status, "SCHEDULED"))),
    db
      .select({ n: count() })
      .from(participants)
      .where(and(eq(participants.studyId, studyId), eq(participants.eligibilityStatus, "ELIGIBLE"))),
    db
      .select({ n: count() })
      .from(participants)
      .where(
        and(
          eq(participants.studyId, studyId),
          isNotNull(participants.enrollmentStatus),
          inArray(participants.enrollmentStatus, ["ENROLLED", "RANDOMIZED", "COHORT_ASSIGNED"]),
        ),
      ),
  ]);

  return {
    screeningPending: Number(pending[0]?.n ?? 0),
    eligible: Number(eligible[0]?.n ?? 0),
    enrolled: Number(enrolled[0]?.n ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Screening writes
// ---------------------------------------------------------------------------

/**
 * Book a screening appointment. Also advances the participant's recruitment
 * status, in the same transaction, because scheduling is the event that makes
 * SCREENING_SCHEDULED true.
 */
export async function scheduleScreening(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  scheduledAt: Date;
}): Promise<string> {
  const { studyId, participantId, actorId, scheduledAt } = params;

  return getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({ id: participants.id, code: participants.code, recruitmentStatus: participants.recruitmentStatus })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [created] = await tx
      .insert(screenings)
      .values({ studyId, participantId, status: "SCHEDULED", scheduledAt, recordedBy: actorId })
      .returning({ id: screenings.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "screening.scheduled",
      entityType: "screening",
      entityId: created.id,
      after: {
        participantCode: participant.code,
        status: "SCHEDULED",
        scheduledAt: scheduledAt.toISOString(),
      },
    });

    if (participant.recruitmentStatus !== RECRUITMENT_STATUS_WHEN_SCHEDULED) {
      await tx
        .update(participants)
        .set({ recruitmentStatus: RECRUITMENT_STATUS_WHEN_SCHEDULED })
        .where(eq(participants.id, participantId));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant.recruitment_status_changed",
        entityType: "participant",
        entityId: participantId,
        before: { recruitmentStatus: participant.recruitmentStatus },
        after: { recruitmentStatus: RECRUITMENT_STATUS_WHEN_SCHEDULED },
        metadata: { via: "screening", screeningId: created.id },
      });
    }

    return created.id;
  });
}

/**
 * Record the outcome of a screening.
 *
 * `result` is an eligibility determination made elsewhere and typed in by staff.
 * It is copied onto the participant so the funnel is queryable, and both writes
 * plus both audit rows happen in one transaction. PENDING is not accepted as a
 * result: "not determined" is expressed by leaving the screening incomplete.
 */
export async function completeScreening(params: {
  studyId: string;
  screeningId: string;
  actorId: string;
  result: Exclude<EligibilityStatus, "PENDING">;
  externalRecordId?: string | null;
  completedAt?: Date;
}): Promise<void> {
  const { studyId, screeningId, actorId, result, externalRecordId, completedAt } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: screenings.id,
        status: screenings.status,
        participantId: screenings.participantId,
        participantCode: participants.code,
        eligibilityStatus: participants.eligibilityStatus,
      })
      .from(screenings)
      .innerJoin(participants, eq(participants.id, screenings.participantId))
      .where(and(eq(screenings.id, screeningId), eq(screenings.studyId, studyId)))
      .limit(1);

    if (!current) throw new NotFoundError("screening", screeningId);
    if (!canTransitionScreening(current.status, "COMPLETED")) {
      throw new InvalidTransitionError("screening", current.status, "COMPLETED");
    }
    if (!canTransitionEligibility(current.eligibilityStatus, result)) {
      throw new InvalidTransitionError("eligibility", current.eligibilityStatus, result);
    }

    const when = completedAt ?? new Date();

    await tx
      .update(screenings)
      .set({
        status: "COMPLETED",
        completedAt: when,
        result,
        externalRecordId: externalRecordId?.trim() || null,
        recordedBy: actorId,
      })
      .where(eq(screenings.id, screeningId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "screening.completed",
      entityType: "screening",
      entityId: screeningId,
      before: { status: current.status },
      // The external reference is recorded; no screening content ever is.
      after: {
        status: "COMPLETED",
        result,
        completedAt: when.toISOString(),
        externalRecordId: externalRecordId?.trim() || null,
      },
    });

    await tx
      .update(participants)
      .set({ eligibilityStatus: result })
      .where(eq(participants.id, current.participantId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "participant.eligibility_changed",
      entityType: "participant",
      entityId: current.participantId,
      before: { eligibilityStatus: current.eligibilityStatus },
      after: { eligibilityStatus: result, participantCode: current.participantCode },
      metadata: { via: "screening", screeningId },
    });
  });
}

/** Close a scheduled screening that did not produce a result. */
export async function closeScreening(params: {
  studyId: string;
  screeningId: string;
  actorId: string;
  status: Extract<ScreeningStatus, "NO_SHOW" | "CANCELLED">;
}): Promise<void> {
  const { studyId, screeningId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: screenings.id, status: screenings.status })
      .from(screenings)
      .where(and(eq(screenings.id, screeningId), eq(screenings.studyId, studyId)))
      .limit(1);

    if (!current) throw new NotFoundError("screening", screeningId);
    if (!canTransitionScreening(current.status, status)) {
      throw new InvalidTransitionError("screening", current.status, status);
    }

    await tx.update(screenings).set({ status, recordedBy: actorId }).where(eq(screenings.id, screeningId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "screening.closed",
      entityType: "screening",
      entityId: screeningId,
      before: { status: current.status },
      after: { status },
    });
  });
}

// ---------------------------------------------------------------------------
// Consent writes
// ---------------------------------------------------------------------------

/**
 * Open a consent process against a named form version.
 *
 * Any consent currently in force is marked SUPERSEDED and points at the new row,
 * so the previous decision is preserved rather than overwritten. The partial
 * unique index guarantees only one PENDING/CONSENTED row survives.
 */
export async function startConsent(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  versionLabel: string;
}): Promise<string> {
  const { studyId, participantId, actorId } = params;
  const versionLabel = params.versionLabel.trim();

  return getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({ id: participants.id, code: participants.code, enrollmentStatus: participants.enrollmentStatus })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [existing] = await tx
      .select({ id: consents.id, status: consents.status })
      .from(consents)
      .where(
        and(
          eq(consents.participantId, participantId),
          inArray(consents.status, ["PENDING", "CONSENTED"]),
        ),
      )
      .limit(1);

    const [created] = await tx
      .insert(consents)
      .values({ studyId, participantId, status: "PENDING", versionLabel, recordedBy: actorId })
      .returning({ id: consents.id });

    if (existing) {
      await tx
        .update(consents)
        .set({ status: "SUPERSEDED", supersededBy: created.id, decidedAt: new Date() })
        .where(eq(consents.id, existing.id));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "consent.superseded",
        entityType: "consent",
        entityId: existing.id,
        before: { status: existing.status },
        after: { status: "SUPERSEDED", supersededBy: created.id },
      });
    }

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "consent.started",
      entityType: "consent",
      entityId: created.id,
      after: { status: "PENDING", versionLabel, participantCode: participant.code },
    });

    if (participant.enrollmentStatus === null) {
      await tx
        .update(participants)
        .set({ enrollmentStatus: "CONSENT_PENDING" })
        .where(eq(participants.id, participantId));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant.enrollment_changed",
        entityType: "participant",
        entityId: participantId,
        before: { enrollmentStatus: null },
        after: { enrollmentStatus: "CONSENT_PENDING" },
        metadata: { via: "consent", consentId: created.id },
      });
    }

    return created.id;
  });
}

/**
 * Record a consent decision. Consenting enrolls the participant in the same
 * transaction; declining or withdrawing does not automatically un-enrol anyone,
 * because that is a separate decision a person has to make deliberately.
 */
export async function recordConsentDecision(params: {
  studyId: string;
  consentId: string;
  actorId: string;
  status: Extract<ConsentStatus, "CONSENTED" | "DECLINED" | "WITHDRAWN">;
  externalRecordId?: string | null;
}): Promise<void> {
  const { studyId, consentId, actorId, status, externalRecordId } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: consents.id,
        status: consents.status,
        participantId: consents.participantId,
        participantCode: participants.code,
        enrollmentStatus: participants.enrollmentStatus,
      })
      .from(consents)
      .innerJoin(participants, eq(participants.id, consents.participantId))
      .where(and(eq(consents.id, consentId), eq(consents.studyId, studyId)))
      .limit(1);

    if (!current) throw new NotFoundError("consent", consentId);
    if (!canTransitionConsent(current.status, status)) {
      throw new InvalidTransitionError("consent", current.status, status);
    }

    await tx
      .update(consents)
      .set({
        status,
        decidedAt: new Date(),
        externalRecordId: externalRecordId?.trim() || null,
        recordedBy: actorId,
      })
      .where(eq(consents.id, consentId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "consent.decision_recorded",
      entityType: "consent",
      entityId: consentId,
      before: { status: current.status },
      after: { status, externalRecordId: externalRecordId?.trim() || null },
    });

    const nextEnrollment = enrollmentStatusForConsent(status);
    if (
      nextEnrollment &&
      canTransitionEnrollment(current.enrollmentStatus, nextEnrollment)
    ) {
      await tx
        .update(participants)
        .set({ enrollmentStatus: nextEnrollment })
        .where(eq(participants.id, current.participantId));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant.enrollment_changed",
        entityType: "participant",
        entityId: current.participantId,
        before: { enrollmentStatus: current.enrollmentStatus },
        after: { enrollmentStatus: nextEnrollment, participantCode: current.participantCode },
        metadata: { via: "consent", consentId },
      });
    }
  });
}

/**
 * Move a participant along the enrollment pipeline directly (withdraw, complete).
 * Phase 2 exposes only the transitions it owns; RANDOMIZED and COHORT_ASSIGNED
 * belong to Phase 3.
 */
export async function setEnrollmentStatus(params: {
  studyId: string;
  participantId: string;
  actorId: string;
  status: Extract<EnrollmentStatus, "WITHDRAWN" | "COMPLETED">;
}): Promise<void> {
  const { studyId, participantId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: participants.id, code: participants.code, enrollmentStatus: participants.enrollmentStatus })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);

    if (!current) throw new NotFoundError("participant", participantId);
    if (!canTransitionEnrollment(current.enrollmentStatus, status)) {
      throw new InvalidTransitionError("enrollment", current.enrollmentStatus, status);
    }

    await tx
      .update(participants)
      .set({ enrollmentStatus: status })
      .where(eq(participants.id, participantId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "participant.enrollment_changed",
      entityType: "participant",
      entityId: participantId,
      before: { enrollmentStatus: current.enrollmentStatus },
      after: { enrollmentStatus: status, participantCode: current.code },
    });
  });
}
