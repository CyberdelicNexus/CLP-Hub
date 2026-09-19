/**
 * Recruitment vocabularies (Phase 1).
 *
 * These are fixed operational vocabularies, not clinical ones. Nothing here
 * expresses an eligibility criterion or computes a decision: staff record
 * outcomes that were determined elsewhere (docs/research-data-boundaries.md).
 *
 * Eligibility and enrollment status are deliberately NOT part of this phase;
 * they arrive with screening in Phase 2.
 */

/** Where a participant sits in the intake funnel. Set by staff, never inferred. */
export const RECRUITMENT_STATUSES = [
  "INTERESTED",
  "APPLICATION_STARTED",
  "APPLICATION_SUBMITTED",
  "PRESCREEN",
  "SCREENING_PENDING",
  "SCREENING_SCHEDULED",
] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

/**
 * Operational triage state of a single application.
 *
 * Deliberately avoids "eligible"/"ineligible" language: that is an eligibility
 * determination made outside this app and recorded in Phase 2. ACCEPTED_FOR_SCREENING
 * means only "staff decided to take this forward", and NOT_PURSUED means
 * "staff closed it", with the reason living in the researcher's own records.
 */
export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "ACCEPTED_FOR_SCREENING",
  "NOT_PURSUED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * How the application reached the study.
 *
 * QUALTRICS is the live route (D-031): initial screening — and the digital
 * consent that must precede any data collection, including the name — happens in
 * Qualtrics, and staff record the anonymized outcome here.
 *
 * PUBLIC_FORM is RETIRED and kept only so historical rows remain readable. No
 * code path creates one: `/participar` is now a landing page that hands the
 * person to Qualtrics. Postgres enum values cannot be dropped safely, and
 * rewriting old rows would be falsifying history, so the value stays.
 */
export const APPLICATION_SOURCES = [
  "PUBLIC_FORM",
  "STAFF_ENTRY",
  "IMPORT",
  "QUALTRICS",
] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

/** Sources a new application may be created with today. */
export const ACTIVE_APPLICATION_SOURCES: readonly ApplicationSource[] = [
  "QUALTRICS",
  "STAFF_ENTRY",
  "IMPORT",
];

export function isActiveApplicationSource(v: unknown): v is ApplicationSource {
  return typeof v === "string" && (ACTIVE_APPLICATION_SOURCES as readonly string[]).includes(v);
}

/**
 * Question types the public application form can render.
 *
 * BOUNDARY (D-014): these exist to collect *operational* information only —
 * contact details, availability, location and consent to be contacted. Configuring
 * a health, symptom, diagnosis, medication or psychometric question would put
 * Category C research data into this app, which is forbidden by
 * docs/research-data-boundaries.md. That boundary is a documented convention,
 * not a database constraint: whoever configures questions must uphold it.
 */
export const QUESTION_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "EMAIL",
  "PHONE",
  "SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
  "DATE",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Types whose answer is one of a configured option list. */
export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ["SELECT", "MULTI_SELECT"];

/** Types whose answer is an array rather than a scalar. */
export const MULTI_VALUE_QUESTION_TYPES: readonly QuestionType[] = ["MULTI_SELECT"];

/** Free-text length cap. Keeps a stray clinical narrative from being pasted in. */
export const LONG_TEXT_MAX_LENGTH = 1000;
export const SHORT_TEXT_MAX_LENGTH = 200;

export function isRecruitmentStatus(value: unknown): value is RecruitmentStatus {
  return typeof value === "string" && (RECRUITMENT_STATUSES as readonly string[]).includes(value);
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

/**
 * Allowed staff transitions between application states.
 *
 * Every transition is an explicit staff action with an audit row; nothing moves
 * on its own. Terminal states stay terminal in the ordinary triage flow —
 * reopening is not offered here, so day-to-day history reads as one forward
 * path. `setApplicationStatus`'s `correction` flag (D-066) is the one escape
 * valve: any status to any other, for a staff mistake rather than a triage
 * step. It is not offered by bypassing this graph silently — it is always
 * audited under its own action (`application.status_corrected`) so a
 * correction never reads as an ordinary transition and history is corrected
 * loudly, not quietly rewritten.
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  SUBMITTED: ["IN_REVIEW", "ACCEPTED_FOR_SCREENING", "NOT_PURSUED", "WITHDRAWN"],
  IN_REVIEW: ["ACCEPTED_FOR_SCREENING", "NOT_PURSUED", "WITHDRAWN"],
  ACCEPTED_FOR_SCREENING: ["WITHDRAWN"],
  NOT_PURSUED: [],
  WITHDRAWN: [],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Recruitment status implied by an application reaching a given state.
 * Returns null when the application state says nothing about the funnel.
 * Applied by the service inside the same transaction, never by a background job.
 */
export function recruitmentStatusForApplication(status: ApplicationStatus): RecruitmentStatus | null {
  switch (status) {
    case "SUBMITTED":
      return "APPLICATION_SUBMITTED";
    case "IN_REVIEW":
      return "PRESCREEN";
    case "ACCEPTED_FOR_SCREENING":
      return "SCREENING_PENDING";
    default:
      return null;
  }
}

/**
 * Canonical form of an email for duplicate detection (D-013).
 * Trim + lowercase only: no dot-stripping or plus-tag removal, because those
 * rules are provider-specific and would wrongly merge two different people.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Participant code format, e.g. "P-000042". Generated from a database sequence. */
export function formatParticipantCode(sequence: number): string {
  return `P-${String(sequence).padStart(6, "0")}`;
}
