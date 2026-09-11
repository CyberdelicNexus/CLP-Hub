import { StatusBadge } from "@/components/status-badge";
import type { CohortSize } from "@/domain/cohort";

/**
 * How full a cohort is, against the size its study configured (Phase 4c).
 *
 * Two deliberate choices:
 *
 * - The numbers are always shown; the WARNING is only shown when there is
 *   something to warn about. A permanent red badge on a cohort that is still
 *   filling up would train staff to ignore it, and being under-sized in
 *   PLANNING is the normal state, not a problem.
 * - An unbounded cohort shows a plain count and nothing else. No bounds were
 *   configured, so there is nothing to be outside of, and inventing a default
 *   of 6-8 here would put a trial specific in a component.
 */
export function CohortOccupancy({
  size,
  labels,
  showWarning = true,
}: {
  size: CohortSize;
  labels: { under: string; over: string; remaining: string };
  /** Off in a dense table row, where the count alone carries the signal. */
  showWarning?: boolean;
}) {
  const bounds =
    size.minSize !== null && size.maxSize !== null
      ? `${size.minSize}–${size.maxSize}`
      : size.maxSize !== null
        ? `${size.maxSize}`
        : size.minSize !== null
          ? `${size.minSize}+`
          : null;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span data-numeric className="tabular-nums">
        {bounds ? `${size.members} / ${bounds}` : size.members}
      </span>

      {showWarning && size.verdict === "UNDER" ? (
        <StatusBadge tone="warning">{labels.under}</StatusBadge>
      ) : null}
      {showWarning && size.verdict === "OVER" ? (
        <StatusBadge tone="critical">{labels.over}</StatusBadge>
      ) : null}
      {showWarning && size.verdict === "WITHIN" && size.remaining !== null && size.remaining > 0 ? (
        <span className="text-xs text-muted-foreground">{labels.remaining}</span>
      ) : null}
    </span>
  );
}
