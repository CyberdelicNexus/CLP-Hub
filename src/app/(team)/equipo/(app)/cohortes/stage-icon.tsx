import { CheckCircle2, Circle, Clock, Flag, Shuffle, Users, XCircle, type LucideIcon } from "lucide-react";
import type { EnrollmentStatus } from "@/domain/participant-state";

/**
 * A shape per enrollment status, alongside the colour `ENROLLMENT_TONES`
 * already provides (participant-status-badge.tsx) — colour alone repeats
 * across other statuses (ENROLLED and COMPLETED are both "success"), so a
 * shape carries the distinction for anyone who cannot rely on colour alone,
 * and reads at a glance in the cohort gallery's member chips.
 */
const STAGE_ICONS: Record<EnrollmentStatus, LucideIcon> = {
  CONSENT_PENDING: Clock,
  ENROLLED: CheckCircle2,
  RANDOMIZED: Shuffle,
  COHORT_ASSIGNED: Users,
  WITHDRAWN: XCircle,
  COMPLETED: Flag,
};

export function StageIcon({
  status,
  className,
}: {
  status: EnrollmentStatus | null;
  className?: string;
}) {
  const Icon = status ? STAGE_ICONS[status] : Circle;
  return <Icon className={className} aria-hidden />;
}
