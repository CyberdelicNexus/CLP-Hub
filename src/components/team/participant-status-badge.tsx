import { StatusBadge, type StatusTone } from "@/components/status-badge";
import type { ConsentStatus } from "@/domain/consent";
import type { EligibilityStatus, EnrollmentStatus } from "@/domain/participant-state";
import type { ScreeningStatus } from "@/domain/screening";

/**
 * The single place where Phase 2 enums map to colour.
 *
 * Tones describe *operational* state, never a judgement about a person.
 * INELIGIBLE and DECLINED are neutral, not "critical": someone not taking part
 * is an ordinary outcome, and colouring it as an error would be wrong both
 * ethically and as an interface.
 */
const ELIGIBILITY_TONES: Record<EligibilityStatus, StatusTone> = {
  PENDING: "neutral",
  ELIGIBLE: "success",
  INELIGIBLE: "neutral",
  REVIEW_REQUIRED: "warning",
  WAITLIST: "info",
};

const ENROLLMENT_TONES: Record<EnrollmentStatus, StatusTone> = {
  CONSENT_PENDING: "warning",
  ENROLLED: "success",
  RANDOMIZED: "info",
  COHORT_ASSIGNED: "info",
  WITHDRAWN: "neutral",
  COMPLETED: "success",
};

const SCREENING_TONES: Record<ScreeningStatus, StatusTone> = {
  SCHEDULED: "info",
  COMPLETED: "success",
  NO_SHOW: "neutral",
  CANCELLED: "neutral",
};

const CONSENT_TONES: Record<ConsentStatus, StatusTone> = {
  PENDING: "warning",
  CONSENTED: "success",
  DECLINED: "neutral",
  WITHDRAWN: "neutral",
  SUPERSEDED: "neutral",
};

export function EligibilityBadge({ status, label }: { status: EligibilityStatus; label: string }) {
  return <StatusBadge tone={ELIGIBILITY_TONES[status]}>{label}</StatusBadge>;
}

export function EnrollmentBadge({ status, label }: { status: EnrollmentStatus; label: string }) {
  return <StatusBadge tone={ENROLLMENT_TONES[status]}>{label}</StatusBadge>;
}

export function ScreeningBadge({ status, label }: { status: ScreeningStatus; label: string }) {
  return <StatusBadge tone={SCREENING_TONES[status]}>{label}</StatusBadge>;
}

export function ConsentBadge({ status, label }: { status: ConsentStatus; label: string }) {
  return <StatusBadge tone={CONSENT_TONES[status]}>{label}</StatusBadge>;
}
