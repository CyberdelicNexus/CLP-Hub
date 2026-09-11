/**
 * Why an eligibility determination came out the way it did (Phase 4a).
 *
 * NOTHING HERE DECIDES ANYTHING. This module says which *shapes* of reason may
 * be recorded, never which reason applies to whom. The determination itself is
 * made outside this application (non-negotiable 3); staff record its outcome and
 * now, additionally, a standardized reason for it.
 *
 * CATEGORY C BOUNDARY. A reason says *that* a criterion was not met, never
 * *which* criterion or any clinical fact behind it. "DID_NOT_MEET_CRITERIA" is
 * the whole statement: the specific criterion, the score and the clinical
 * reasoning live in the institution's approved system
 * (docs/research-data-boundaries.md). The category vocabulary below is
 * deliberately administrative for exactly that reason.
 */

import type { EligibilityStatus } from "./participant-state";

/**
 * Fixed, reusable categories. These are the groupings a CONSORT flow diagram
 * reports exclusions under — a reporting standard, not a clinical rule and not
 * trial-specific, which is why they are code rather than configuration.
 *
 * The trial's own reason *labels* ARE configuration: a row in
 * `eligibility_reasons` carries the wording and points at one category here
 * (non-negotiable 6). So a study can say "no cumple el rango de edad" without
 * that sentence ever appearing in this repository.
 */
export const ELIGIBILITY_REASON_CATEGORIES = [
  /** CONSORT: "did not meet inclusion criteria". Which criterion is not stored. */
  "DID_NOT_MEET_CRITERIA",
  /** CONSORT: "declined to participate". */
  "DECLINED",
  /** Could not be contacted after the study's configured attempts. */
  "UNREACHABLE",
  /** Availability, location, travel, equipment — operational, not clinical. */
  "LOGISTICS",
  /** Left before an allocation existed; distinct from a post-allocation withdrawal. */
  "WITHDREW_BEFORE_ALLOCATION",
  /** The same person reached the funnel twice. */
  "DUPLICATE",
  /** Recruitment closed, quota met, cohort full. A study-side reason, not a person-side one. */
  "STUDY_CAPACITY",
  /** CONSORT: "other reasons". */
  "OTHER",
] as const;
export type EligibilityReasonCategory = (typeof ELIGIBILITY_REASON_CATEGORIES)[number];

export function isEligibilityReasonCategory(v: unknown): v is EligibilityReasonCategory {
  return (
    typeof v === "string" && (ELIGIBILITY_REASON_CATEGORIES as readonly string[]).includes(v)
  );
}

/**
 * Which determinations must carry a reason.
 *
 * INELIGIBLE and REVIEW_REQUIRED both demand one: an exclusion with no recorded
 * reason cannot be reported in a flow diagram, and "requires review" with no
 * statement of what needs reviewing is not a handover, it is a dead end.
 */
export const STATUSES_REQUIRING_REASON: readonly EligibilityStatus[] = [
  "INELIGIBLE",
  "REVIEW_REQUIRED",
];

/**
 * WAITLIST may carry one (capacity, timing) but is not an exclusion, so it is
 * not forced. ELIGIBLE accepts none at all: a reason attached to an inclusion
 * would be a clinical justification, which is precisely what does not belong
 * in this database.
 */
export const STATUSES_ACCEPTING_REASON: readonly EligibilityStatus[] = [
  "INELIGIBLE",
  "REVIEW_REQUIRED",
  "WAITLIST",
];

export function requiresReason(status: EligibilityStatus): boolean {
  return STATUSES_REQUIRING_REASON.includes(status);
}

export function acceptsReason(status: EligibilityStatus): boolean {
  return STATUSES_ACCEPTING_REASON.includes(status);
}

/**
 * The optional free-text note.
 *
 * This is a deliberate, narrow exception to the "no free text near a
 * determination" rule that D-019 established for screenings, made because staff
 * asked for context that a fixed category cannot carry (e.g. "reagendar en
 * septiembre"). It is kept as small as the ask allows:
 *
 * - 280 characters, which is room for a sentence and not room for a history.
 * - Newlines rejected, so it cannot become a notes field with paragraphs.
 * - Never copied into audit snapshots — the audit records only whether a note
 *   was present, so the note exists in exactly one place and can be erased.
 * - The form warns, in Spanish, that clinical information does not go here.
 *
 * None of that makes it *safe*, only small. Recorded as D-030.
 */
export const REASON_NOTE_MAX_LENGTH = 280;

export function isValidReasonNote(note: string): boolean {
  return note.length <= REASON_NOTE_MAX_LENGTH && !/[\r\n]/.test(note);
}

/** Reason code, e.g. "EDAD_FUERA_DE_RANGO". Configuration per study. */
export const REASON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_]{1,47}$/;
export const REASON_LABEL_MAX_LENGTH = 120;

/**
 * Shape of a configured reason, as the UI and services see it. The row itself
 * lives in `eligibility_reasons`.
 */
export interface EligibilityReason {
  id: string;
  code: string;
  category: EligibilityReasonCategory;
  labelEs: string;
  labelEn: string | null;
  /** Determinations this reason may be attached to. Never contains ELIGIBLE. */
  appliesTo: readonly EligibilityStatus[];
  position: number;
  active: boolean;
}

/** Reasons offered for a given determination, in configured order. */
export function reasonsFor(
  reasons: readonly EligibilityReason[],
  status: EligibilityStatus,
): EligibilityReason[] {
  if (!acceptsReason(status)) return [];
  return reasons
    .filter((r) => r.active && r.appliesTo.includes(status))
    .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
}

/**
 * Validate a (status, reason, note) triple before it is written.
 *
 * Returns a machine-readable problem rather than throwing, because every caller
 * is a server action that has to turn it into a translated message.
 */
export type ReasonProblem =
  | "reasonRequired"
  | "reasonNotAllowed"
  | "reasonNotApplicable"
  | "noteTooLong";

export function validateReason(input: {
  status: EligibilityStatus;
  reason: EligibilityReason | null;
  note: string | null;
}): ReasonProblem | null {
  const { status, reason, note } = input;

  if (reason && !acceptsReason(status)) return "reasonNotAllowed";
  if (!reason && requiresReason(status)) return "reasonRequired";
  if (reason && !reason.appliesTo.includes(status)) return "reasonNotApplicable";
  if (note && !isValidReasonNote(note)) return "noteTooLong";

  return null;
}
