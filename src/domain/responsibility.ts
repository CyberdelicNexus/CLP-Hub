/**
 * Who is responsible for what, per participant (Phase 4d).
 *
 * Cohort-level staffing already exists as `cohort_staff` (D-022) and is not
 * duplicated here. This is the narrower question the 2026-09-11 meeting asked:
 * for *this* person, who runs the initial visit, and who takes or sets up the
 * headset when that is someone else.
 *
 * Assignments are historical, like `cohort_staff` and `user_roles`: revoked,
 * never deleted, so "who was responsible in March" stays answerable.
 *
 * NOTE, deliberately: unlike `cohort_staff`, being responsible for a participant
 * grants NO extra visibility. It is a work assignment and nothing else. Widening
 * what someone can see is a permission change, and permission changes go through
 * `src/domain/permissions.ts` where they can be reviewed (non-negotiable 8).
 */

/**
 * The two responsibilities the meeting named.
 *
 * A fixed vocabulary rather than configuration, because these are structural
 * operational roles this product already assumes elsewhere — VR logistics has
 * its own permission area and its own planned tables. If a study ever needs a
 * third kind of responsible, that is a schema change and a recorded decision,
 * which is the right amount of friction for adding a new kind of accountability.
 */
export const RESPONSIBILITY_ROLES = [
  /** Runs the initial visit. */
  "INITIAL_SESSION",
  /** Takes or sets up the headset, when that is a different person. */
  "VR_EQUIPMENT",
] as const;
export type ResponsibilityRole = (typeof RESPONSIBILITY_ROLES)[number];

export function isResponsibilityRole(v: unknown): v is ResponsibilityRole {
  return typeof v === "string" && (RESPONSIBILITY_ROLES as readonly string[]).includes(v);
}

/**
 * One active holder per role per participant. Two people simultaneously
 * "responsible for the headset" is how a headset ends up with nobody carrying
 * it, so the second assignment supersedes the first rather than sitting
 * alongside it. Enforced by a partial unique index.
 */
export const ONE_HOLDER_PER_ROLE = true;

// ---------------------------------------------------------------------------
// The initial visit
// ---------------------------------------------------------------------------

/**
 * Operational state of the initial visit.
 *
 * The same four values screening uses, because it is the same kind of thing — an
 * appointment that either happened or did not. A separate enum rather than
 * reusing `screening_status`: the two vocabularies are equal today by
 * coincidence, not by rule, and coupling them would mean a change to one
 * silently changing the other.
 */
export const VISIT_STATUSES = ["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export function isVisitStatus(v: unknown): v is VisitStatus {
  return typeof v === "string" && (VISIT_STATUSES as readonly string[]).includes(v);
}

/**
 * A visit that happened cannot be un-happened; a repeat is a new row, exactly as
 * screening works (D-019). The history stays honest rather than being edited
 * into the outcome someone wishes had occurred.
 */
export const VISIT_TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = {
  SCHEDULED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

export function canTransitionVisit(from: VisitStatus, to: VisitStatus): boolean {
  return VISIT_TRANSITIONS[from].includes(to);
}

/**
 * Operational notes on a visit.
 *
 * Another narrow exception to "no free text near a participant", granted for the
 * same reason as the reason note in D-030 and with the same limits in spirit:
 * 500 characters, and the UI says in Spanish that clinical information does not
 * belong here. It is longer than the reason note because the ask is genuinely
 * different — "aparcar en la parte de atrás, el portero abre a las 9" is
 * logistics, and refusing to store it just moves it to WhatsApp.
 *
 * Its CONTENT is never copied into an audit snapshot, so it lives in one place
 * and can be erased.
 */
export const VISIT_NOTES_MAX_LENGTH = 500;
export const VISIT_LOCATION_MAX_LENGTH = 200;

export function isValidVisitNotes(notes: string): boolean {
  return notes.length <= VISIT_NOTES_MAX_LENGTH;
}
