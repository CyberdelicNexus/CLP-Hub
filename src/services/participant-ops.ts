import "server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb, type DbExecutor } from "@/db/client";
import {
  cohorts,
  consentScopes,
  consents,
  eligibilityReasons,
  participantCohortAssignments,
  randomizations,
  studyArms,
  participantContacts,
  participants,
  screenings,
  type Consent,
  type Screening,
} from "@/db/schema";
import type { ParticipantSnapshot } from "@/domain/next-step";
import { isVisitStatus } from "@/domain/responsibility";
import {
  canCarryScopes,
  canTransitionConsent,
  isConsentType,
  enrollmentStatusForConsent,
  scopesFor,
  validateScopes,
  type ConsentScope,
  type ConsentStatus,
  type ConsentType,
  type ScopeProblem,
} from "@/domain/consent";
import {
  validateReason,
  type EligibilityReason,
  type ReasonProblem,
} from "@/domain/eligibility-reason";
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

/**
 * A determination was recorded without the reason it needs, or with one that
 * does not apply to it. Separate from InvalidTransitionError because the fix is
 * different: the staff member has to choose a reason, not a different outcome.
 */
/** A consent was asked to grant an authorization it cannot carry. */
export class ScopeError extends Error {
  readonly problem: ScopeProblem;
  constructor(problem: ScopeProblem) {
    super(problem);
    this.name = "ScopeError";
    this.problem = problem;
  }
}

export class ReasonError extends Error {
  readonly problem: ReasonProblem;
  constructor(problem: ReasonProblem) {
    super(problem);
    this.name = "ReasonError";
    this.problem = problem;
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
  /** Cohort and arm, for filtering and for the operational columns. */
  cohortId: string | null;
  cohortCode: string | null;
  armId: string | null;
  armCode: string | null;
  /** Everything `nextStep` needs, gathered in the same query. */
  snapshot: ParticipantSnapshot;
}

export interface ParticipantFilters {
  eligibility?: EligibilityStatus;
  enrollment?: EnrollmentStatus;
  cohortId?: string;
  armId?: string;
  /** Narrow to participants this staff member is responsible for. */
  responsibleUserId?: string;
}

/**
 * Participants in a study, newest first.
 *
 * As in Phase 1, contact columns are not selected at all unless the caller may
 * see them. Phase 4d adds the operational picture each row needs to show a next
 * step, gathered here as correlated subqueries rather than as one query per row
 * — a list of two hundred participants would otherwise issue two thousand.
 *
 * The subqueries read only STATUS, never content: which consent types are in
 * force, whether an allocation exists, the latest visit's status. No note, no
 * reason text and no contact field is touched by any of them.
 */
export async function listParticipants(
  studyId: string,
  options: ParticipantFilters & {
    includeContact: boolean;
    limit?: number;
  },
): Promise<ParticipantListRow[]> {
  const { includeContact, limit = 200 } = options;

  const conditions = [eq(participants.studyId, studyId)];
  if (options.eligibility) {
    conditions.push(eq(participants.eligibilityStatus, options.eligibility));
  }
  if (options.enrollment) {
    conditions.push(eq(participants.enrollmentStatus, options.enrollment));
  }
  if (options.cohortId) {
    conditions.push(sql`${participantCohortAssignments.cohortId} = ${options.cohortId}`);
  }
  if (options.armId) {
    conditions.push(sql`${randomizations.armId} = ${options.armId}`);
  }
  if (options.responsibleUserId) {
    conditions.push(sql`exists (
      select 1 from participant_responsibilities pr
      where pr.participant_id = ${participants.id}
        and pr.user_id = ${options.responsibleUserId}
        and pr.revoked_at is null
    )`);
  }

  const rows = await getDb()
    .select({
      id: participants.id,
      code: participants.code,
      recruitmentStatus: participants.recruitmentStatus,
      eligibilityStatus: participants.eligibilityStatus,
      enrollmentStatus: participants.enrollmentStatus,
      createdAt: participants.createdAt,
      fullName: includeContact ? participantContacts.fullName : sql<null>`null`,
      cohortId: cohorts.id,
      cohortCode: cohorts.code,
      armId: studyArms.id,
      armCode: studyArms.code,
      requiresPhysicalConsent: studyArms.requiresPhysicalConsent,
      hasScreeningResult: sql<boolean>`exists (
        select 1 from screenings s
        where s.participant_id = ${participants.id} and s.result is not null
      )`,
      hasOpenScreening: sql<boolean>`exists (
        select 1 from screenings s
        where s.participant_id = ${participants.id} and s.status = 'SCHEDULED'
      )`,
      activeConsentTypes: sql<string[]>`coalesce((
        select array_agg(distinct c.consent_type::text) from consents c
        where c.participant_id = ${participants.id} and c.status = 'CONSENTED'
      ), '{}')`,
      initialVisitStatus: sql<string | null>`(
        select v.status::text from initial_visits v
        where v.participant_id = ${participants.id}
        order by v.created_at desc limit 1
      )`,
      hasInitialSessionResponsible: sql<boolean>`exists (
        select 1 from participant_responsibilities pr
        where pr.participant_id = ${participants.id}
          and pr.role = 'INITIAL_SESSION'
          and pr.revoked_at is null
      )`,
    })
    .from(participants)
    .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
    .leftJoin(
      participantCohortAssignments,
      and(
        eq(participantCohortAssignments.participantId, participants.id),
        isNull(participantCohortAssignments.removedAt),
      ),
    )
    .leftJoin(cohorts, eq(cohorts.id, participantCohortAssignments.cohortId))
    .leftJoin(randomizations, eq(randomizations.participantId, participants.id))
    .leftJoin(studyArms, eq(studyArms.id, randomizations.armId))
    .where(and(...conditions))
    .orderBy(desc(participants.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    recruitmentStatus: r.recruitmentStatus,
    eligibilityStatus: r.eligibilityStatus,
    enrollmentStatus: r.enrollmentStatus,
    createdAt: r.createdAt,
    fullName: r.fullName,
    cohortId: r.cohortId,
    cohortCode: r.cohortCode,
    armId: r.armId,
    armCode: r.armCode,
    snapshot: {
      enrollmentStatus: r.enrollmentStatus,
      hasScreeningResult: Boolean(r.hasScreeningResult),
      hasOpenScreening: Boolean(r.hasOpenScreening),
      activeConsentTypes: (r.activeConsentTypes ?? []).filter(isConsentType),
      // Null until an allocation exists, which is what keeps `nextStep` from
      // asserting a physical consent is missing before anyone knows the arm.
      requiresPhysicalConsent: r.armId ? Boolean(r.requiresPhysicalConsent) : null,
      hasAllocation: Boolean(r.armId),
      hasCohort: Boolean(r.cohortId),
      initialVisitStatus: isVisitStatus(r.initialVisitStatus) ? r.initialVisitStatus : null,
      hasInitialSessionResponsible: Boolean(r.hasInitialSessionResponsible),
    },
  }));
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
// Eligibility reasons (configuration)
// ---------------------------------------------------------------------------

/**
 * The study's configured reasons, active ones first in display order.
 *
 * Inactive reasons are still returned so an already-recorded determination can
 * render its reason's wording; `reasonsFor` in the domain filters them out of
 * the choices offered for a new one.
 */
export async function listEligibilityReasons(studyId: string): Promise<EligibilityReason[]> {
  const rows = await getDb()
    .select({
      id: eligibilityReasons.id,
      code: eligibilityReasons.code,
      category: eligibilityReasons.category,
      labelEs: eligibilityReasons.labelEs,
      labelEn: eligibilityReasons.labelEn,
      appliesTo: eligibilityReasons.appliesTo,
      position: eligibilityReasons.position,
      active: eligibilityReasons.active,
    })
    .from(eligibilityReasons)
    .where(eq(eligibilityReasons.studyId, studyId))
    .orderBy(eligibilityReasons.position, eligibilityReasons.code);

  return rows as EligibilityReason[];
}

/** One reason, scoped to the study and required to be active to be attachable. */
async function loadReason(
  executor: DbExecutor,
  studyId: string,
  reasonId: string,
): Promise<EligibilityReason | null> {
  const [row] = await executor
    .select({
      id: eligibilityReasons.id,
      code: eligibilityReasons.code,
      category: eligibilityReasons.category,
      labelEs: eligibilityReasons.labelEs,
      labelEn: eligibilityReasons.labelEn,
      appliesTo: eligibilityReasons.appliesTo,
      position: eligibilityReasons.position,
      active: eligibilityReasons.active,
    })
    .from(eligibilityReasons)
    .where(
      and(
        eq(eligibilityReasons.id, reasonId),
        eq(eligibilityReasons.studyId, studyId),
        eq(eligibilityReasons.active, true),
      ),
    )
    .limit(1);

  return (row as EligibilityReason) ?? null;
}

/** The study's configured consent scopes, active ones plus retired ones. */
export async function listConsentScopes(studyId: string): Promise<ConsentScope[]> {
  const rows = await getDb()
    .select({
      id: consentScopes.id,
      code: consentScopes.code,
      labelEs: consentScopes.labelEs,
      labelEn: consentScopes.labelEn,
      consentType: consentScopes.consentType,
      position: consentScopes.position,
      active: consentScopes.active,
    })
    .from(consentScopes)
    .where(eq(consentScopes.studyId, studyId))
    .orderBy(consentScopes.position, consentScopes.code);

  return rows as ConsentScope[];
}

async function loadConsentScopes(
  executor: DbExecutor,
  studyId: string,
): Promise<ConsentScope[]> {
  const rows = await executor
    .select({
      id: consentScopes.id,
      code: consentScopes.code,
      labelEs: consentScopes.labelEs,
      labelEn: consentScopes.labelEn,
      consentType: consentScopes.consentType,
      position: consentScopes.position,
      active: consentScopes.active,
    })
    .from(consentScopes)
    .where(and(eq(consentScopes.studyId, studyId), eq(consentScopes.active, true)));

  return rows as ConsentScope[];
}

/** Wording for scope codes recorded on a consent, in configured order. */
export function describeScopes(
  scopes: readonly ConsentScope[],
  codes: readonly string[],
): string[] {
  const byCode = new Map(scopes.map((s) => [s.code, s]));
  return codes
    .map((c) => byCode.get(c))
    .filter((s): s is ConsentScope => Boolean(s))
    .sort((a, b) => a.position - b.position)
    .map((s) => s.labelEs);
}

/** Scopes offered when starting a consent of a given type. */
export function offeredScopes(
  scopes: readonly ConsentScope[],
  type: ConsentType,
): ConsentScope[] {
  return scopesFor(scopes, type);
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
  /** Required for INELIGIBLE and REVIEW_REQUIRED; refused for ELIGIBLE. */
  reasonId?: string | null;
  /** One line of operational context, at most 280 characters (D-030). */
  reasonNote?: string | null;
}): Promise<void> {
  const { studyId, screeningId, actorId, result, externalRecordId, completedAt } = params;
  const reasonId = params.reasonId?.trim() || null;
  const reasonNote = params.reasonNote?.trim() || null;

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

    // Resolve the reason inside the transaction so a reason deactivated a
    // moment ago cannot be attached, and so a reason belonging to another study
    // is a not-found rather than a silent cross-study write.
    const reason = reasonId ? await loadReason(tx, studyId, reasonId) : null;
    if (reasonId && !reason) throw new NotFoundError("eligibility reason", reasonId);

    const problem = validateReason({ status: result, reason, note: reasonNote });
    if (problem) throw new ReasonError(problem);

    const when = completedAt ?? new Date();

    await tx
      .update(screenings)
      .set({
        status: "COMPLETED",
        completedAt: when,
        result,
        externalRecordId: externalRecordId?.trim() || null,
        reasonId: reason?.id ?? null,
        reasonNote: reason ? reasonNote : null,
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
        // The reason's code and CONSORT category, which are configuration, are
        // safe to snapshot. The note's CONTENT deliberately is not: it is the
        // one free-text field near a determination (D-030), and copying it into
        // an append-only log would make it impossible to erase. Whether a note
        // exists is recorded, so its presence is still auditable.
        reasonCode: reason?.code ?? null,
        reasonCategory: reason?.category ?? null,
        hasReasonNote: Boolean(reason && reasonNote),
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
      metadata: {
        via: "screening",
        screeningId,
        reasonCode: reason?.code ?? null,
        reasonCategory: reason?.category ?? null,
      },
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
  /** Defaults to DIGITAL, the consent everyone gives before any data exists. */
  consentType?: ConsentType;
  /** Configured scope codes; only a PHYSICAL consent may carry any. */
  grantedScopes?: readonly string[];
}): Promise<string> {
  const { studyId, participantId, actorId } = params;
  const versionLabel = params.versionLabel.trim();
  const consentType: ConsentType = params.consentType ?? "DIGITAL";
  const grantedScopes = [...new Set(params.grantedScopes ?? [])];

  return getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({ id: participants.id, code: participants.code, enrollmentStatus: participants.enrollmentStatus })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    // Scope membership is verified here rather than by a constraint: a CHECK
    // may not contain a subquery, so the database can only guarantee the SHAPE
    // of the array. Reading the configuration inside the transaction also means
    // a scope deactivated a moment ago cannot still be granted.
    if (grantedScopes.length > 0) {
      const configured = await loadConsentScopes(tx, studyId);
      const problem = validateScopes({
        type: consentType,
        granted: grantedScopes,
        configured,
      });
      if (problem) throw new ScopeError(problem);
    } else if (!canCarryScopes(consentType) && grantedScopes.length > 0) {
      throw new ScopeError("scopesNotAllowed");
    }

    // Superseding is scoped TO THE SAME TYPE (D-032). Starting a physical
    // consent must not quietly retire the digital one: they are two different
    // decisions the person made at two different moments, and both stay in
    // force. The partial unique index is per (participant, type) for the same
    // reason.
    const [existing] = await tx
      .select({ id: consents.id, status: consents.status })
      .from(consents)
      .where(
        and(
          eq(consents.participantId, participantId),
          eq(consents.consentType, consentType),
          inArray(consents.status, ["PENDING", "CONSENTED"]),
        ),
      )
      .limit(1);

    const [created] = await tx
      .insert(consents)
      .values({
        studyId,
        participantId,
        status: "PENDING",
        consentType,
        versionLabel,
        grantedScopes,
        recordedBy: actorId,
      })
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
      after: {
        status: "PENDING",
        consentType,
        versionLabel,
        participantCode: participant.code,
        // Scope CODES are configuration, so snapshotting them is safe and makes
        // "what did this person agree to, and when" answerable from the log.
        grantedScopes,
      },
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
