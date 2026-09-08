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
