/**
 * Session and attendance vocabularies (Phase 3b).
 *
 * Session names, order and timings are configuration rows, never code
 * (non-negotiable 6): a session called "Vida" is data belonging to a study.
 */

/** From the founder's brief. */
export const SESSION_MODALITIES = ["ZOOM", "VR", "IN_PERSON", "ASYNCHRONOUS", "OTHER"] as const;
export type SessionModality = (typeof SESSION_MODALITIES)[number];

/**
 * Operational state of a scheduled session.
 *
 * ASSUMPTION: the brief supplies modality and attendance vocabularies but not
 * one for the session itself. Recorded as an open question (D-024).
 */
export const SESSION_STATUSES = ["SCHEDULED", "HELD", "CANCELLED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** From the founder's brief. TECHNICAL_FAILURE is deliberately its own outcome. */
export const ATTENDANCE_STATUSES = [
  "EXPECTED",
  "ATTENDED",
  "LATE",
  "ABSENT",
  "EXCUSED",
  "TECHNICAL_FAILURE",
  "WITHDRAWN",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isSessionModality(v: unknown): v is SessionModality {
  return typeof v === "string" && (SESSION_MODALITIES as readonly string[]).includes(v);
}
export function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === "string" && (SESSION_STATUSES as readonly string[]).includes(v);
}
export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(v);
}

/**
 * A session that has happened or been called off cannot be un-happened; a repeat
 * is a new session row. Attendance is still editable after HELD, because
 * corrections to who turned up are ordinary and every change is audited.
 */
export const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  SCHEDULED: ["HELD", "CANCELLED"],
  HELD: [],
  CANCELLED: [],
};

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Attendance semantics
// ---------------------------------------------------------------------------

/**
 * THE CENTRAL RULE OF THIS MODULE (from the brief): TECHNICAL_FAILURE ≠ ABSENT.
 *
 * Someone whose connection or headset failed did not fail to turn up. Counting
 * them as absent would misattribute an equipment problem to the participant and
 * would corrupt any adherence figure built on it. It is therefore neither
 * present nor absent — it is its own outcome, and every aggregate below keeps it
 * separate. `tests/sessions.test.ts` locks this down.
 */
export const PRESENT_STATUSES: readonly AttendanceStatus[] = ["ATTENDED", "LATE"];

/** A real non-attendance attributable to the participant. */
export const ABSENCE_STATUSES: readonly AttendanceStatus[] = ["ABSENT"];

/** Neither attendance nor absence: excluded from both sides of any ratio. */
export const NEUTRAL_STATUSES: readonly AttendanceStatus[] = [
  "EXPECTED",
  "EXCUSED",
  "TECHNICAL_FAILURE",
  "WITHDRAWN",
];

export function countsAsPresent(status: AttendanceStatus): boolean {
  return PRESENT_STATUSES.includes(status);
}

export function countsAsAbsent(status: AttendanceStatus): boolean {
  return ABSENCE_STATUSES.includes(status);
}

/** True when the outcome should be excluded from adherence figures entirely. */
export function isNeutralOutcome(status: AttendanceStatus): boolean {
  return NEUTRAL_STATUSES.includes(status);
}

export interface AttendanceTally {
  present: number;
  absent: number;
  /** Kept visible rather than folded away, so a bad session is obvious. */
  technicalFailure: number;
  excused: number;
  expected: number;
  withdrawn: number;
}

/**
 * Summarise a session's attendance. Deliberately returns categories rather than
 * a single percentage: a "70% attendance" figure that quietly swallowed three
 * headset failures would be a false statement about the participants.
 */
export function tallyAttendance(statuses: readonly AttendanceStatus[]): AttendanceTally {
  const tally: AttendanceTally = {
    present: 0,
    absent: 0,
    technicalFailure: 0,
    excused: 0,
    expected: 0,
    withdrawn: 0,
  };
  for (const s of statuses) {
    if (countsAsPresent(s)) tally.present += 1;
    else if (s === "ABSENT") tally.absent += 1;
    else if (s === "TECHNICAL_FAILURE") tally.technicalFailure += 1;
    else if (s === "EXCUSED") tally.excused += 1;
    else if (s === "WITHDRAWN") tally.withdrawn += 1;
    else tally.expected += 1;
  }
  return tally;
}

/** Session name and location caps. Operational text, not clinical notes. */
export const SESSION_NAME_MAX_LENGTH = 120;
export const SESSION_LOCATION_MAX_LENGTH = 200;

// ---------------------------------------------------------------------------
// Session templates — the programme definition (Phase 4g)
// ---------------------------------------------------------------------------

/**
 * A session template's code, e.g. `vida` or `orientacion_grupal` — the same
 * lowercase-snake shape `program_stages.code` already uses (domain/program-
 * stage.ts), enforced by the matching database check constraint.
 */
export const SESSION_TEMPLATE_CODE_PATTERN = /^[a-z][a-z0-9_-]{1,48}$/;
export const SESSION_TEMPLATE_NAME_MAX_LENGTH = 120;
