/**
 * Cohort vocabularies (Phase 3a).
 *
 * A cohort is a group of participants who go through the programme together.
 * Its name, dates and capacity are configuration; nothing trial-specific is
 * encoded here (non-negotiable 6).
 */

/** Lifecycle of a cohort, from the founder's brief. */
export const COHORT_STATUSES = [
  "PLANNING",
  "RECRUITING",
  "PREPARATION",
  "ACTIVE",
  "INTEGRATION",
  "FOLLOW_UP",
  "COMPLETED",
] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export function isCohortStatus(value: unknown): value is CohortStatus {
  return typeof value === "string" && (COHORT_STATUSES as readonly string[]).includes(value);
}

/**
 * The lifecycle runs forward only: a cohort that has started integration has
 * genuinely started it, and quietly moving it back would rewrite history that
 * sessions and attendance already depend on.
 *
 * ASSUMPTION: the brief gives the vocabulary but not the permitted moves. This
 * strictly-forward reading is recorded as an open question — if a cohort ever
 * legitimately needs to go back a step, this map is where to change it.
 */
const ORDER: readonly CohortStatus[] = COHORT_STATUSES;

export function canTransitionCohort(from: CohortStatus, to: CohortStatus): boolean {
  const i = ORDER.indexOf(from);
  const j = ORDER.indexOf(to);
  return i >= 0 && j > i;
}

/** The next step in the lifecycle, or null at the end. */
export function nextCohortStatus(from: CohortStatus): CohortStatus | null {
  const i = ORDER.indexOf(from);
  return i >= 0 && i + 1 < ORDER.length ? ORDER[i + 1] : null;
}

/** Statuses in which a cohort still accepts new participants. */
export const OPEN_FOR_ASSIGNMENT: readonly CohortStatus[] = [
  "PLANNING",
  "RECRUITING",
  "PREPARATION",
];

export function acceptsAssignments(status: CohortStatus): boolean {
  return OPEN_FOR_ASSIGNMENT.includes(status);
}

/** Cohort code, e.g. "C-2026-A". Configuration, not derived from anything. */
export const COHORT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
export const COHORT_NAME_MAX_LENGTH = 120;

// ---------------------------------------------------------------------------
// Size bounds (Phase 4c)
// ---------------------------------------------------------------------------

/**
 * How full a cohort is against its configured bounds.
 *
 * THE BOUNDS ARE CONFIGURATION. "Between 6 and 8" is this trial's group size,
 * so it lives in `cohorts.min_size` / `cohorts.max_size` as data, never as a
 * number in this file (non-negotiable 6). A cohort with no bounds configured is
 * simply unbounded, not implicitly 6–8.
 */
export type SizeVerdict = "UNBOUNDED" | "UNDER" | "WITHIN" | "OVER";

export interface CohortSize {
  members: number;
  minSize: number | null;
  maxSize: number | null;
  verdict: SizeVerdict;
  /** Places left before the maximum. Null when there is no maximum. */
  remaining: number | null;
  /** How many more are needed to reach the minimum. Zero once it is met. */
  needed: number;
}

export function assessCohortSize(input: {
  members: number;
  minSize: number | null;
  maxSize: number | null;
}): CohortSize {
  const { members, minSize, maxSize } = input;

  let verdict: SizeVerdict = "WITHIN";
  if (minSize === null && maxSize === null) verdict = "UNBOUNDED";
  else if (minSize !== null && members < minSize) verdict = "UNDER";
  else if (maxSize !== null && members > maxSize) verdict = "OVER";

  return {
    members,
    minSize,
    maxSize,
    verdict,
    remaining: maxSize === null ? null : maxSize - members,
    needed: minSize === null ? 0 : Math.max(0, minSize - members),
  };
}

/**
 * Statuses at which the size rule bites.
 *
 * Deliberately only ACTIVE. Assignment itself is never refused on size — that
 * remains the operational judgement D-023 describes, and a cohort has to be
 * allowed to pass through being too small on its way to being the right size.
 * The question "is this cohort ready to run" is asked once, when someone says it
 * is running.
 */
export const SIZE_CHECKED_STATUSES: readonly CohortStatus[] = ["ACTIVE"];

export function sizeIsCheckedAt(status: CohortStatus): boolean {
  return SIZE_CHECKED_STATUSES.includes(status);
}

/**
 * Whether moving to `to` should be questioned on size grounds.
 *
 * Returns the verdict rather than a boolean so the caller can say *which* way it
 * is wrong. An UNBOUNDED cohort is never questioned: no bounds were configured,
 * so there is nothing to be outside of.
 */
export function sizeBlocksTransition(to: CohortStatus, size: CohortSize): SizeVerdict | null {
  if (!sizeIsCheckedAt(to)) return null;
  if (size.verdict === "WITHIN" || size.verdict === "UNBOUNDED") return null;
  return size.verdict;
}

// ---------------------------------------------------------------------------
// Arm compatibility
// ---------------------------------------------------------------------------

/**
 * Whether a participant may join a cohort, on arm grounds alone.
 *
 * A cohort with `armId === null` takes anyone — that is the existing behaviour
 * and every cohort created before this phase is in that state. Once a cohort
 * names an arm, putting someone from a different arm in it is a data error, not
 * an operational judgement: the allocation and the group they actually attend
 * would disagree, and every attendance figure built on the cohort would be
 * wrong.
 *
 * An unallocated participant is refused too, and this is the case worth being
 * deliberate about: they are not "compatible by default". Assigning someone to
 * an arm-specific cohort before anyone knows their arm is exactly the accident
 * this check exists to prevent.
 */
export type ArmCompatibility = "OK" | "MISMATCH" | "ARM_NOT_RECORDED";

export function checkArmCompatibility(input: {
  cohortArmId: string | null;
  participantArmId: string | null;
}): ArmCompatibility {
  if (input.cohortArmId === null) return "OK";
  if (input.participantArmId === null) return "ARM_NOT_RECORDED";
  return input.cohortArmId === input.participantArmId ? "OK" : "MISMATCH";
}
