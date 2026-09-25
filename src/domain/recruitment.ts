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
 * PUBLIC_FORM is the expression of interest on `/participar` (D-086, reviving
 * the value D-031 retired): the person leaves name, email and phone, and only
 * then opens the Qualtrics questionnaire, which carries the Hub's participant
 * code. The information sheet, the consent and the screening answers stay in
 * Qualtrics.
 *
 * QUALTRICS is staff recording a Qualtrics response by its opaque reference
 * (D-031), for anyone who reached the questionnaire without the Hub step.
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
  "PUBLIC_FORM",
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

/**
 * Sequence-based participant code, e.g. "P-000042". Used by the staff-entry,
 * IMPORT and Qualtrics-reference routes, and by every participant created
 * before D-087. The public route now builds `formatInterestCode` instead.
 */
export function formatParticipantCode(sequence: number): string {
  return `P-${String(sequence).padStart(6, "0")}`;
}

/**
 * The public route's code (D-087): initials of the first name and the first
 * surname, then the month and year of the submission, e.g. "P-JM1026".
 *
 * NOT PSEUDONYMOUS. Unlike the sequence code it is derived from the person's
 * name, so it reveals initials wherever a code is shown "instead of the name"
 * (D-038, D-040) and survives a pseudonymizing erasure. The founder chose
 * that trade-off; see D-087 for what it costs. Accents are folded (Á to A,
 * Ñ to N) and a name with no Latin letter yields "X".
 *
 * Two people with the same initials in the same month collide; the service
 * appends "-2", "-3", ... (`withCollisionSuffix`).
 */
export function initialOf(name: string): string {
  const folded = name.normalize("NFD").replace(/\p{M}/gu, "");
  const letter = folded.match(/[A-Za-z]/)?.[0];
  return letter ? letter.toUpperCase() : "X";
}

/** Month and year as the study's own calendar reads them, not the server's. */
export function monthYearIn(date: Date, timeZone: string): { month: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, month: "2-digit", year: "2-digit" }).formatToParts(date);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { month: pick("month"), year: pick("year") };
}

export function formatInterestCode(params: {
  firstName: string;
  lastName: string;
  submittedAt: Date;
  timeZone: string;
}): string {
  const { month, year } = monthYearIn(params.submittedAt, params.timeZone);
  return `P-${initialOf(params.firstName)}${initialOf(params.lastName)}${month}${year}`;
}

export function withCollisionSuffix(baseCode: string, attempt: number): string {
  return attempt <= 1 ? baseCode : `${baseCode}-${attempt}`;
}

/** Every code shape the database accepts; mirrored by `participants_code_format`. */
export const PARTICIPANT_CODE_PATTERN = /^P-([0-9]{6,}|[A-Z]{2}[0-9]{4}(-[0-9]+)?)$/;
