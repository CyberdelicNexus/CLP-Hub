/**
 * Consent vocabularies (Phase 2).
 *
 * This application records the *status* of consent, not the consent itself. The
 * signed document lives in the institution's approved system; here we keep which
 * form version was used, when the decision was recorded, who recorded it, and an
 * external reference. No document upload, no signature, no scanned file.
 *
 * Consent rows are historical: a decision is never edited into a different one.
 * Re-consenting to a new form version supersedes the previous row.
 */

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
