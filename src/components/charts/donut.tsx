const SEGMENT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * A small SVG donut for a true part-of-a-whole breakdown (an exclusion
 * reason's share of all exclusions, an arm's share of allocations) — NOT for
 * sequential/funnel counts, where a proportion would misstate what the
 * numbers mean (2026-09-19: replaces bar rows the founder found meaningless,
 * "they don't mean anything", for exactly the data shapes where a
 * proportion IS a meaningful claim). Built by hand (stroke-dasharray
 * segments) rather than a charting library — this is one shape, reused
 * twice, and the rest of this app's visuals are hand-rolled the same way.
 */
export function Donut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number }[];
  centerLabel: string;
  centerValue: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;

  const lengths = segments.map((s) => (total === 0 ? 0 : (s.value / total) * circumference));
  const arcs = segments.map((s, i) => {
    const priorOffset = lengths.slice(0, i).reduce((sum, l) => sum + l, 0);
    const length = lengths[i];
    return {
      ...s,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -priorOffset,
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 36 36" className="size-32 -rotate-90">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--muted)" strokeWidth="4" />
          {total > 0
            ? arcs.map((a) => (
                <circle
                  key={a.label}
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="4"
                  strokeDasharray={a.dasharray}
                  strokeDashoffset={a.dashoffset}
                />
              ))
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span data-numeric className="text-xl font-semibold">
            {centerValue}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <dl className="flex-1 space-y-1.5">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden />
            <dt className="min-w-0 flex-1 truncate">{a.label}</dt>
            <dd data-numeric className="shrink-0 font-medium tabular-nums">
              {a.value}
            </dd>
          </div>
        ))}
        {total === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
      </dl>
    </div>
  );
}
