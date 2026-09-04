/**
 * Screening vocabularies (Phase 2).
 *
 * CATEGORY C BOUNDARY. A screening in this application is an *appointment and
 * its recorded outcome*, nothing more. Screening answers, instruments, scores,
 * clinical notes and health history live in the institution's approved system
 * and must never be stored here (docs/research-data-boundaries.md).
 *
 * That is why the screening table has no free-text field at all: it carries a
 * status, timestamps, an eligibility result recorded by staff, and an opaque
 * `external_record_id` pointing at the real record. There is deliberately
 * nowhere to type "participant reports low mood".
 */

/** Operational state of the screening appointment itself. */
export const SCREENING_STATUSES = ["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
export type ScreeningStatus = (typeof SCREENING_STATUSES)[number];

export function isScreeningStatus(value: unknown): value is ScreeningStatus {
  return typeof value === "string" && (SCREENING_STATUSES as readonly string[]).includes(value);
}

/**
 * Allowed moves. A screening that already happened cannot be un-happened:
 * COMPLETED, NO_SHOW and CANCELLED are terminal, and a repeat attempt is a new
 * screening row rather than an edit of the old one, so the history stays honest.
 */
export const SCREENING_TRANSITIONS: Record<ScreeningStatus, readonly ScreeningStatus[]> = {
  SCHEDULED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

export function canTransitionScreening(from: ScreeningStatus, to: ScreeningStatus): boolean {
  return SCREENING_TRANSITIONS[from].includes(to);
}

/** Only a completed screening can carry an eligibility result. */
export function canCarryResult(status: ScreeningStatus): boolean {
  return status === "COMPLETED";
}

/**
 * Recruitment status implied by scheduling a screening. Applied by the service
 * in the same transaction as the write, never by a background job.
 */
export const RECRUITMENT_STATUS_WHEN_SCHEDULED = "SCREENING_SCHEDULED" as const;

/** Maximum length of an external record reference. An identifier, not a note. */
export const EXTERNAL_RECORD_ID_MAX_LENGTH = 120;
