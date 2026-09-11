import "server-only";
import { and, count, countDistinct, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  applications,
  eligibilityReasons,
  participantCohortAssignments,
  participants,
  randomizations,
  screenings,
  studyArms,
} from "@/db/schema";
import type { EligibilityReasonCategory } from "@/domain/eligibility-reason";

/**
 * The numbers behind a study flow diagram (Phase 4a).
 *
 * This service answers "how many people were at each stage, and why did the
 * others leave" — the shape a CONSORT diagram is drawn from. It is a pure read:
 * nothing here decides, derives an eligibility judgement, or invents a figure.
 *
 * Two rules it keeps deliberately:
 *
 * 1. **Counts only.** No participant code, no contact field, no external
 *    reference is returned. A flow diagram is aggregate by definition, and a
 *    screen that could show "the 3 excluded people" alongside their reasons
 *    would be a re-identification surface for a small study.
 * 2. **No percentages, no derived rates.** The same argument as `tallyAttendance`
 *    (D-024): a single number that quietly folds categories together is a false
 *    statement. Whoever draws the diagram does the arithmetic knowing what they
 *    are dividing.
 *
 * It also does NOT suppress small counts. That is a disclosure-control decision
 * for the researchers, not one this application should make silently — recorded
 * as an open question in docs/decisions.md.
 */

export interface ExclusionBreakdownRow {
  reasonId: string;
  code: string;
  category: EligibilityReasonCategory;
  labelEs: string;
  labelEn: string | null;
  count: number;
}

export interface AllocationRow {
  armId: string;
  armCode: string;
  armNameEs: string;
  allocated: number;
  /** Of those allocated, how many are currently in a cohort. */
  inCohort: number;
}

export interface StudyFlowCounts {
  /** Applications received, including repeat applications from one person. */
  applicationsReceived: number;
  /** Distinct people who reached the funnel. */
  peopleApplied: number;
  /** People with at least one COMPLETED screening — "assessed for eligibility". */
  assessed: number;
  /** Screenings that were scheduled but produced no assessment. */
  notAssessed: { noShow: number; cancelled: number; stillScheduled: number };
  /** Current determination, one per person. */
  determination: {
    pending: number;
    eligible: number;
    ineligible: number;
    reviewRequired: number;
    waitlist: number;
  };
  /** Why the excluded were excluded, by configured reason. */
  exclusionsByReason: ExclusionBreakdownRow[];
  /** The same, folded to the CONSORT category a reason reports under. */
  exclusionsByCategory: { category: EligibilityReasonCategory; count: number }[];
  /** Recorded allocations per arm. Never computed — see D-018. */
  allocation: AllocationRow[];
  /** Eligible people with no allocation recorded yet. */
  eligibleNotAllocated: number;
}

export async function getStudyFlowCounts(studyId: string): Promise<StudyFlowCounts> {
  const db = getDb();

  const [
    applicationRows,
    assessedRows,
    screeningStateRows,
    determinationRows,
    reasonRows,
    allocationRows,
    eligibleNotAllocatedRows,
  ] = await Promise.all([
    db
      .select({
        total: count(applications.id),
        people: countDistinct(applications.participantId),
      })
      .from(applications)
      .where(eq(applications.studyId, studyId)),

    db
      .select({ n: countDistinct(screenings.participantId) })
      .from(screenings)
      .where(and(eq(screenings.studyId, studyId), eq(screenings.status, "COMPLETED"))),

    db
      .select({ status: screenings.status, n: count() })
      .from(screenings)
      .where(and(eq(screenings.studyId, studyId), inArray(screenings.status, ["NO_SHOW", "CANCELLED", "SCHEDULED"])))
      .groupBy(screenings.status),

    db
      .select({ status: participants.eligibilityStatus, n: count() })
      .from(participants)
      .where(eq(participants.studyId, studyId))
      .groupBy(participants.eligibilityStatus),

    // Exclusions are counted from the screening that recorded them, not from the
    // participant's current status, so a determination later revised still shows
    // the reason it was made under at the time. Only the most recent completed
    // screening per participant counts, so a re-screened person is one person.
    db
      .select({
        reasonId: eligibilityReasons.id,
        code: eligibilityReasons.code,
        category: eligibilityReasons.category,
        labelEs: eligibilityReasons.labelEs,
        labelEn: eligibilityReasons.labelEn,
        n: count(),
      })
      .from(screenings)
      .innerJoin(eligibilityReasons, eq(eligibilityReasons.id, screenings.reasonId))
      .where(
        and(
          eq(screenings.studyId, studyId),
          eq(screenings.result, "INELIGIBLE"),
          sql`${screenings.completedAt} = (
            select max(s2.completed_at) from screenings s2
            where s2.participant_id = ${screenings.participantId}
              and s2.status = 'COMPLETED'
          )`,
        ),
      )
      .groupBy(
        eligibilityReasons.id,
        eligibilityReasons.code,
        eligibilityReasons.category,
        eligibilityReasons.labelEs,
        eligibilityReasons.labelEn,
        eligibilityReasons.position,
      )
      .orderBy(eligibilityReasons.position, eligibilityReasons.code),

    db
      .select({
        armId: studyArms.id,
        armCode: studyArms.code,
        armNameEs: studyArms.nameEs,
        allocated: count(randomizations.id),
        inCohort: countDistinct(participantCohortAssignments.participantId),
      })
      .from(studyArms)
      .leftJoin(
        randomizations,
        and(eq(randomizations.armId, studyArms.id), eq(randomizations.studyId, studyId)),
      )
      .leftJoin(
        participantCohortAssignments,
        and(
          eq(participantCohortAssignments.participantId, randomizations.participantId),
          sql`${participantCohortAssignments.removedAt} is null`,
        ),
      )
      .where(eq(studyArms.studyId, studyId))
      .groupBy(studyArms.id, studyArms.code, studyArms.nameEs, studyArms.position)
      .orderBy(studyArms.position, studyArms.code),

    db
      .select({ n: count() })
      .from(participants)
      .where(
        and(
          eq(participants.studyId, studyId),
          eq(participants.eligibilityStatus, "ELIGIBLE"),
          sql`not exists (
            select 1 from randomizations r where r.participant_id = ${participants.id}
          )`,
        ),
      ),
  ]);

  const byScreeningStatus = Object.fromEntries(
    screeningStateRows.map((r) => [r.status, Number(r.n)]),
  );
  const byDetermination = Object.fromEntries(
    determinationRows.map((r) => [r.status, Number(r.n)]),
  );

  const exclusionsByReason: ExclusionBreakdownRow[] = reasonRows.map((r) => ({
    reasonId: r.reasonId,
    code: r.code,
    category: r.category,
    labelEs: r.labelEs,
    labelEn: r.labelEn,
    count: Number(r.n),
  }));

  const categoryTotals = new Map<EligibilityReasonCategory, number>();
  for (const row of exclusionsByReason) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.count);
  }

  return {
    applicationsReceived: Number(applicationRows[0]?.total ?? 0),
    peopleApplied: Number(applicationRows[0]?.people ?? 0),
    assessed: Number(assessedRows[0]?.n ?? 0),
    notAssessed: {
      noShow: byScreeningStatus.NO_SHOW ?? 0,
      cancelled: byScreeningStatus.CANCELLED ?? 0,
      stillScheduled: byScreeningStatus.SCHEDULED ?? 0,
    },
    determination: {
      pending: byDetermination.PENDING ?? 0,
      eligible: byDetermination.ELIGIBLE ?? 0,
      ineligible: byDetermination.INELIGIBLE ?? 0,
      reviewRequired: byDetermination.REVIEW_REQUIRED ?? 0,
      waitlist: byDetermination.WAITLIST ?? 0,
    },
    exclusionsByReason,
    exclusionsByCategory: [...categoryTotals.entries()]
      .map(([category, n]) => ({ category, count: n }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    allocation: allocationRows.map((r) => ({
      armId: r.armId,
      armCode: r.armCode,
      armNameEs: r.armNameEs,
      allocated: Number(r.allocated),
      inCohort: Number(r.inCohort),
    })),
    eligibleNotAllocated: Number(eligibleNotAllocatedRows[0]?.n ?? 0),
  };
}

/**
 * Exclusions recorded with no reason attached.
 *
 * Should always be zero: a check constraint added in migration 0007 refuses an
 * INELIGIBLE result without one. It is queried anyway because rows written
 * before that constraint existed are legitimately unreasoned, and a flow diagram
 * that silently dropped them would understate the exclusions. Surfacing the
 * figure lets staff go back and complete the record instead.
 */
export async function countExclusionsWithoutReason(studyId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(screenings)
    .where(
      and(
        eq(screenings.studyId, studyId),
        eq(screenings.result, "INELIGIBLE"),
        isNotNull(screenings.completedAt),
        sql`${screenings.reasonId} is null`,
      ),
    );
  return Number(row?.n ?? 0);
}
