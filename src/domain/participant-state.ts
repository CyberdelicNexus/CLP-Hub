/**
 * Participant state vocabularies (Phase 2).
 *
 * Three independent status fields, never blended into one string
 * (docs/domain-model.md). Recruitment status is defined in ./recruitment.ts.
 *
 * Nothing here decides anything. Eligibility is determined outside this
 * application and recorded by staff; this module only says which recorded
 * values exist and which moves between them are coherent.
 */

/** Result of an eligibility determination made elsewhere. */
export const ELIGIBILITY_STATUSES = [
  "PENDING",
  "ELIGIBLE",
  "INELIGIBLE",
  "REVIEW_REQUIRED",
  "WAITLIST",
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

/**
 * Position in the enrollment pipeline. Null on the participant means "not yet
 * in the pipeline at all", which is different from CONSENT_PENDING — that value
 * asserts a consent process has started.
 */
export const ENROLLMENT_STATUSES = [
  "CONSENT_PENDING",
  "ENROLLED",
  "RANDOMIZED",
  "COHORT_ASSIGNED",
  "WITHDRAWN",
  "COMPLETED",
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/**
 * Values no Phase 2 code path can set. RANDOMIZED and COHORT_ASSIGNED belong to
 * randomization and cohort assignment, both deferred to Phase 3 (D-017), so the
 * vocabulary is complete here but deliberately not yet reachable.
 */
export const PHASE_3_ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = [
  "RANDOMIZED",
  "COHORT_ASSIGNED",
];

export function isEligibilityStatus(value: unknown): value is EligibilityStatus {
  return typeof value === "string" && (ELIGIBILITY_STATUSES as readonly string[]).includes(value);
}

export function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return typeof value === "string" && (ENROLLMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Eligibility transitions.
 *
 * PENDING is an initial state only: nothing may return to it, because
 * "we have not looked yet" stops being true once staff have recorded a result.
 * Every other move is permitted, including reversals — a determination made
 * outside this app can legitimately be corrected or revisited, and the app is
 * not entitled to refuse to record what the researchers decided. The audit log
 * is what makes such a change accountable.
 */
export function canTransitionEligibility(
  from: EligibilityStatus,
  to: EligibilityStatus,
): boolean {
  if (from === to) return false;
  return to !== "PENDING";
}

/**
 * Enrollment transitions. Unlike eligibility this is a pipeline, so the map is
 * explicit. WITHDRAWN and COMPLETED are terminal: a participant who withdrew is
 * not quietly moved back in, they get a new, separately recorded decision.
 */
export const ENROLLMENT_TRANSITIONS: Record<EnrollmentStatus, readonly EnrollmentStatus[]> = {
  CONSENT_PENDING: ["ENROLLED", "WITHDRAWN"],
  ENROLLED: ["RANDOMIZED", "WITHDRAWN", "COMPLETED"],
  RANDOMIZED: ["COHORT_ASSIGNED", "WITHDRAWN", "COMPLETED"],
  COHORT_ASSIGNED: ["WITHDRAWN", "COMPLETED"],
  WITHDRAWN: [],
  COMPLETED: [],
};

/** From "not in the pipeline" (null) only the entry state is reachable. */
export const ENROLLMENT_ENTRY_STATUS: EnrollmentStatus = "CONSENT_PENDING";

export function canTransitionEnrollment(
  from: EnrollmentStatus | null,
  to: EnrollmentStatus,
): boolean {
  if (from === null) return to === ENROLLMENT_ENTRY_STATUS;
  if (from === to) return false;
  return ENROLLMENT_TRANSITIONS[from].includes(to);
}
