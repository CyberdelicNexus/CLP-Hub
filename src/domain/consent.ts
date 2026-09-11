/**
 * Consent vocabularies (Phase 2, extended in Phase 4b).
 *
 * This application records the *status* of consent, not the consent itself. The
 * signed document lives in the institution's approved system; here we keep which
 * form version was used, when the decision was recorded, who recorded it, and an
 * external reference. No document upload, no signature, no scanned file.
 *
 * Consent rows are historical: a decision is never edited into a different one.
 * Re-consenting to a new form version supersedes the previous row.
 */

/**
 * HOW a consent was given (Phase 4b, D-032).
 *
 * Two distinct moments in the study, not two wordings of one thing:
 *
 * - DIGITAL is accepted remotely, in the external screening platform, *before*
 *   any datum about the person is collected — their name included (D-031).
 * - PHYSICAL is signed in person at the initial visit and is the one that can
 *   carry extra authorizations.
 *
 * Deliberately generic. The platform's name is configuration, not a value in
 * this enum, so a study that screens somewhere other than Qualtrics does not
 * need a migration.
 *
 * WHICH ARMS REQUIRE WHICH is NOT decided here. That is a protocol matter and
 * lives in `study_arms.requires_physical_consent` as configuration
 * (non-negotiable 3 and 6).
 */
export const CONSENT_TYPES = ["DIGITAL", "PHYSICAL"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export function isConsentType(value: unknown): value is ConsentType {
  return typeof value === "string" && (CONSENT_TYPES as readonly string[]).includes(value);
}

/**
 * Only the in-person consent can carry extra authorizations. A remote tick-box
 * accepted before the person has met anyone is not the place to agree to being
 * filmed, so granting a scope on a DIGITAL consent is refused rather than
 * quietly allowed.
 */
export function canCarryScopes(type: ConsentType): boolean {
  return type === "PHYSICAL";
}

/** Scope code, e.g. "ENTREVISTA". Configuration per study, never a value in code. */
export const SCOPE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_]{1,47}$/;
export const SCOPE_LABEL_MAX_LENGTH = 120;

/**
 * One configured authorization the physical consent may grant, e.g. an
 * interview or appearing in a documentary.
 *
 * These are ROWS, not columns. Writing `allows_documentary` into the schema
 * would put one trial's media plan into every study's database
 * (non-negotiable 6), and the next study would need a migration to ask for
 * something else.
 */
export interface ConsentScope {
  id: string;
  code: string;
  labelEs: string;
  labelEn: string | null;
  consentType: ConsentType;
  position: number;
  active: boolean;
}

/** Scopes offered for a given consent type, in configured order. */
export function scopesFor(
  scopes: readonly ConsentScope[],
  type: ConsentType,
): ConsentScope[] {
  if (!canCarryScopes(type)) return [];
  return scopes
    .filter((s) => s.active && s.consentType === type)
    .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
}

/**
 * Validate the scopes being granted against the consent's type and the study's
 * configuration. Returns a machine-readable problem, never throws, because
 * every caller is a server action that must translate it.
 */
export type ScopeProblem = "scopesNotAllowed" | "unknownScope";

export function validateScopes(input: {
  type: ConsentType;
  granted: readonly string[];
  configured: readonly ConsentScope[];
}): ScopeProblem | null {
  const { type, granted, configured } = input;
  if (granted.length === 0) return null;
  if (!canCarryScopes(type)) return "scopesNotAllowed";

  const allowed = new Set(scopesFor(configured, type).map((s) => s.code));
  for (const code of granted) {
    if (!allowed.has(code)) return "unknownScope";
  }
  return null;
}

export const CONSENT_STATUSES = [
  "PENDING",
  "CONSENTED",
  "DECLINED",
  "WITHDRAWN",
  "SUPERSEDED",
] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export function isConsentStatus(value: unknown): value is ConsentStatus {
  return typeof value === "string" && (CONSENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Allowed moves on a single consent row.
 *
 * SUPERSEDED is not reachable by a staff action: it is set by the service when a
 * newer consent row replaces this one, which is why it is absent from every
 * target list here. DECLINED and WITHDRAWN are terminal — changing your mind
 * later is a new consent record, not a rewrite of the old decision.
 */
export const CONSENT_TRANSITIONS: Record<ConsentStatus, readonly ConsentStatus[]> = {
  PENDING: ["CONSENTED", "DECLINED"],
  CONSENTED: ["WITHDRAWN"],
  DECLINED: [],
  WITHDRAWN: [],
  SUPERSEDED: [],
};

export function canTransitionConsent(from: ConsentStatus, to: ConsentStatus): boolean {
  return CONSENT_TRANSITIONS[from].includes(to);
}

/** Statuses that mean this row no longer governs the participant. */
export const INACTIVE_CONSENT_STATUSES: readonly ConsentStatus[] = [
  "DECLINED",
  "WITHDRAWN",
  "SUPERSEDED",
];

export function isActiveConsent(status: ConsentStatus): boolean {
  return !INACTIVE_CONSENT_STATUSES.includes(status);
}

/**
 * Enrollment status implied by a consent decision, applied in the same
 * transaction. Declining does not withdraw an already-enrolled participant:
 * that is a separate, explicit staff decision.
 */
export function enrollmentStatusForConsent(status: ConsentStatus): "ENROLLED" | null {
  return status === "CONSENTED" ? "ENROLLED" : null;
}

/** Form version label, e.g. "PIS v2.1". A label, not a document. */
export const CONSENT_VERSION_MAX_LENGTH = 60;

// ---------------------------------------------------------------------------
// Which consents a participant is still missing
// ---------------------------------------------------------------------------

/**
 * Compare what the study *configured* as required against what is *recorded*.
 *
 * READ THIS BEFORE CHANGING IT. This function decides nothing about a
 * participant. It does not know that a control arm needs less than an
 * experimental one; it is handed `requiresPhysical` from
 * `study_arms.requires_physical_consent`, which researchers configure. All it
 * does is subtract one set from another so an operational gap is visible
 * (non-negotiable 3).
 *
 * It is also advisory only. Nothing in this application refuses an action
 * because a consent is missing — the same reasoning as D-021: staff record what
 * happened, and an anomaly is surfaced rather than used to block work. Someone
 * who can see the gap can fix it; a blocked screen just gets worked around.
 */
export function missingConsentTypes(input: {
  /** From the participant's recorded allocation. Null when not yet allocated. */
  requiresPhysical: boolean | null;
  /** Types with a consent currently in force. */
  activeTypes: readonly ConsentType[];
}): ConsentType[] {
  const active = new Set(input.activeTypes);
  const missing: ConsentType[] = [];

  // The remote consent precedes data collection entirely, so it is expected for
  // everyone regardless of arm.
  if (!active.has("DIGITAL")) missing.push("DIGITAL");

  // Only when the allocation is known AND the study configured that arm to need
  // it. An unallocated participant is not "missing" a physical consent — nobody
  // knows yet whether they will need one.
  if (input.requiresPhysical === true && !active.has("PHYSICAL")) missing.push("PHYSICAL");

  return missing;
}
