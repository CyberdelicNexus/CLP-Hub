/**
 * The next operational step for a participant (Phase 4d).
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE
 * ---------------------------------------
 * Every value below is a statement about a MISSING RECORD, never about a person.
 * "RECORD_ALLOCATION" means *no allocation has been written down*; it does not
 * mean the participant should be allocated, is ready to be, or deserves to be.
 * Those are protocol decisions made outside this application (non-negotiable 3).
 *
 * The distinction is not pedantic. A function that said "this person is ready
 * for randomization" would be making a clinical judgement with a friendly label
 * on it. A function that says "the randomization field is empty" is doing
 * bookkeeping. This one does bookkeeping.
 *
 * Consequences of that rule, visible in the code:
 *
 * - It never looks at eligibility to decide what comes next. An INELIGIBLE
 *   participant's next step is whatever record is missing, and the eligibility
 *   badge next to it is what tells staff not to proceed. The app does not
 *   quietly withhold a step because it has formed an opinion.
 * - It never invents a step that the study has not configured as required. A
 *   physical consent is only "missing" where `requiresPhysicalConsent` says the
 *   arm signs one (D-032).
 * - It stops at WITHDRAWN and COMPLETED, because for those there is genuinely
 *   nothing outstanding.
 */

import type { ConsentType } from "./consent";
import type { EnrollmentStatus } from "./participant-state";
import type { VisitStatus } from "./responsibility";

export const NEXT_STEPS = [
  /** The screening appointment has no recorded outcome yet. */
  "RECORD_SCREENING_RESULT",
  /** No screening has been booked. */
  "SCHEDULE_SCREENING",
  /** No digital consent is in force. */
  "RECORD_DIGITAL_CONSENT",
  /** No allocation has been written down. */
  "RECORD_ALLOCATION",
  /** Allocated, but not in a cohort. */
  "ASSIGN_COHORT",
  /** The arm signs in person and no physical consent is in force. */
  "RECORD_PHYSICAL_CONSENT",
  /** No initial visit has been booked. */
  "SCHEDULE_INITIAL_VISIT",
  /** Nobody is recorded as running the initial visit. */
  "ASSIGN_INITIAL_RESPONSIBLE",
  /** The booked visit has no recorded outcome. */
  "COMPLETE_INITIAL_VISIT",
  /** Everything this module knows about is recorded. */
  "IN_FOLLOW_UP",
  /** Terminal: withdrawn or completed. */
  "NONE",
] as const;
export type NextStep = (typeof NEXT_STEPS)[number];

export interface ParticipantSnapshot {
  enrollmentStatus: EnrollmentStatus | null;
  /** True when a screening exists with a recorded result. */
  hasScreeningResult: boolean;
  /** True when a screening is booked and still open. */
  hasOpenScreening: boolean;
  /** Consent types currently in force (status CONSENTED). */
  activeConsentTypes: readonly ConsentType[];
  /** From the participant's arm configuration. Null when not yet allocated. */
  requiresPhysicalConsent: boolean | null;
  hasAllocation: boolean;
  hasCohort: boolean;
  /** Status of the most recent initial visit, or null when none exists. */
  initialVisitStatus: VisitStatus | null;
  hasInitialSessionResponsible: boolean;
}

/**
 * The single most useful missing record, in pipeline order.
 *
 * Returns ONE step rather than a list because the point is a column staff can
 * scan down. `outstandingSteps` below returns everything, for the detail page.
 */
export function nextStep(s: ParticipantSnapshot): NextStep {
  if (s.enrollmentStatus === "WITHDRAWN" || s.enrollmentStatus === "COMPLETED") return "NONE";

  if (!s.hasScreeningResult) {
    return s.hasOpenScreening ? "RECORD_SCREENING_RESULT" : "SCHEDULE_SCREENING";
  }

  if (!s.activeConsentTypes.includes("DIGITAL")) return "RECORD_DIGITAL_CONSENT";
  if (!s.hasAllocation) return "RECORD_ALLOCATION";

  // Only where the study configured the arm to sign in person. An unallocated
  // participant never reaches here, so `null` cannot be misread as `false`.
  if (s.requiresPhysicalConsent === true && !s.activeConsentTypes.includes("PHYSICAL")) {
    return "RECORD_PHYSICAL_CONSENT";
  }

  if (!s.hasCohort) return "ASSIGN_COHORT";

  if (s.initialVisitStatus === null) return "SCHEDULE_INITIAL_VISIT";
  if (s.initialVisitStatus === "SCHEDULED") {
    // Who is running it matters more than the visit existing: an appointment
    // with nobody attached is the one that gets missed.
    return s.hasInitialSessionResponsible ? "COMPLETE_INITIAL_VISIT" : "ASSIGN_INITIAL_RESPONSIBLE";
  }

  return "IN_FOLLOW_UP";
}

/**
 * Every missing record, not just the first.
 *
 * Same rules, same ordering. Useful on a detail page where showing only the next
 * one hides how much is outstanding.
 */
export function outstandingSteps(s: ParticipantSnapshot): NextStep[] {
  if (s.enrollmentStatus === "WITHDRAWN" || s.enrollmentStatus === "COMPLETED") return [];

  const steps: NextStep[] = [];

  if (!s.hasScreeningResult) {
    steps.push(s.hasOpenScreening ? "RECORD_SCREENING_RESULT" : "SCHEDULE_SCREENING");
  }
  if (!s.activeConsentTypes.includes("DIGITAL")) steps.push("RECORD_DIGITAL_CONSENT");
  if (!s.hasAllocation) steps.push("RECORD_ALLOCATION");
  if (s.requiresPhysicalConsent === true && !s.activeConsentTypes.includes("PHYSICAL")) {
    steps.push("RECORD_PHYSICAL_CONSENT");
  }
  if (!s.hasCohort) steps.push("ASSIGN_COHORT");
  if (s.initialVisitStatus === null) steps.push("SCHEDULE_INITIAL_VISIT");
  if (s.initialVisitStatus === "SCHEDULED") {
    if (!s.hasInitialSessionResponsible) steps.push("ASSIGN_INITIAL_RESPONSIBLE");
    steps.push("COMPLETE_INITIAL_VISIT");
  }

  return steps;
}

/**
 * Steps that deserve visual weight on a dashboard.
 *
 * Not a severity ranking of participants — a note that these two are about a
 * date that has been booked and an appointment that has nobody attached, which
 * are the ones that go wrong silently. Everything else is simply work not yet
 * done.
 */
export const TIME_SENSITIVE_STEPS: readonly NextStep[] = [
  "COMPLETE_INITIAL_VISIT",
  "ASSIGN_INITIAL_RESPONSIBLE",
];

export function isTimeSensitive(step: NextStep): boolean {
  return TIME_SENSITIVE_STEPS.includes(step);
}
