import type { StatusTone } from "@/components/status-badge";
import type { CohortStatus } from "@/domain/cohort";

/**
 * The single place cohort status maps to colour. Lifecycle stages are
 * informational, so nothing here is coloured as an error.
 */
const TONES: Record<CohortStatus, StatusTone> = {
  PLANNING: "neutral",
  RECRUITING: "info",
  PREPARATION: "warning",
  ACTIVE: "success",
  INTEGRATION: "info",
  FOLLOW_UP: "info",
  COMPLETED: "neutral",
};

export function cohortTone(status: CohortStatus): StatusTone {
  return TONES[status];
}
