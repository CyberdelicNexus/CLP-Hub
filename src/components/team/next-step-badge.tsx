import { StatusBadge } from "@/components/status-badge";
import { isTimeSensitive, type NextStep } from "@/domain/next-step";

/**
 * The next missing record for a participant (Phase 4d).
 *
 * The wording matters more than the styling here. Every label is phrased as
 * something to RECORD or ARRANGE, never as a statement about the person: the
 * badge says "registrar asignación", not "listo para aleatorizar". The domain
 * makes the same distinction (see `src/domain/next-step.ts`); this component
 * must not undo it with friendlier copy.
 *
 * Only two steps get visual weight, and neither is a judgement about the
 * participant: a booked visit with no outcome, and a booked visit with nobody
 * running it. Those are the ones that go wrong silently. Everything else is
 * simply work not yet done, and colouring it all would make the colour useless.
 */
export function NextStepBadge({ step, label }: { step: NextStep; label: string }) {
  if (step === "NONE") return <span className="text-sm text-muted-foreground">—</span>;

  return (
    <StatusBadge
      tone={isTimeSensitive(step) ? "warning" : step === "IN_FOLLOW_UP" ? "success" : "neutral"}
    >
      {label}
    </StatusBadge>
  );
}
