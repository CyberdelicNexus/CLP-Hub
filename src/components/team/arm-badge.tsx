import { cn } from "@/lib/utils";

/**
 * Which study group (arm) a cohort runs, as a badge (2026-10-14 request: make
 * the control / programme difference visible on the card and the details).
 *
 * The colour comes from the arm's POSITION in the study's configured arms,
 * never from its name: "control" is this trial's word, and a colour chosen by
 * matching it would be a trial specific in code (CLAUDE.md rule 6). The same
 * arm therefore has the same colour on every screen.
 */
const ARM_TONES = [
  "bg-surface-mint text-surface-mint-ink",
  "bg-surface-lilac text-surface-lilac-ink",
  "bg-surface-sky text-surface-sky-ink",
  "bg-surface-peach text-surface-peach-ink",
] as const;

/** The same four tones as CSS colours, for the cards' edge glow (`.edge-glow`). */
const ARM_GLOW = [
  "var(--surface-mint-ink)",
  "var(--surface-lilac-ink)",
  "var(--surface-sky-ink)",
  "var(--surface-peach-ink)",
] as const;

const wrap = (position: number, n: number) => ((position % n) + n) % n;

export function armToneClass(position: number): string {
  return ARM_TONES[wrap(position, ARM_TONES.length)];
}

export function armGlowColor(position: number): string {
  return ARM_GLOW[wrap(position, ARM_GLOW.length)];
}

export function ArmBadge({
  name,
  position,
  className,
}: {
  name: string;
  /** Index of the arm among the study's arms, ordered as configured. */
  position: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-foreground/10",
        armToneClass(position),
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{name}</span>
    </span>
  );
}
