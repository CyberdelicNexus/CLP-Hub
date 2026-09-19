import { StatusBadge, type StatusTone } from "@/components/status-badge";
import type { ApplicationStatus, RecruitmentStatus } from "@/domain/recruitment";

/**
 * The single place where recruitment enums map to colour. Pages pass the
 * translated label; they never decide a tone themselves.
 *
 * Note the tones are operational, not evaluative: NOT_PURSUED is neutral, not
 * "critical". Nothing here implies an eligibility judgement about a person.
 */
export const APPLICATION_TONES: Record<ApplicationStatus, StatusTone> = {
  SUBMITTED: "info",
  IN_REVIEW: "warning",
  ACCEPTED_FOR_SCREENING: "success",
  NOT_PURSUED: "neutral",
  WITHDRAWN: "neutral",
};

const RECRUITMENT_TONES: Record<RecruitmentStatus, StatusTone> = {
  INTERESTED: "neutral",
  APPLICATION_STARTED: "neutral",
  APPLICATION_SUBMITTED: "info",
  PRESCREEN: "warning",
  SCREENING_PENDING: "warning",
  SCREENING_SCHEDULED: "success",
};

export function ApplicationStatusBadge({
  status,
  label,
}: {
  status: ApplicationStatus;
  label: string;
}) {
  return <StatusBadge tone={APPLICATION_TONES[status]}>{label}</StatusBadge>;
}

export function RecruitmentStatusBadge({
  status,
  label,
}: {
  status: RecruitmentStatus;
  label: string;
}) {
  return <StatusBadge tone={RECRUITMENT_TONES[status]}>{label}</StatusBadge>;
}
