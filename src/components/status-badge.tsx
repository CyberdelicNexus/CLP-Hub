import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "critical" | "info";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-transparent",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-transparent",
  critical: "bg-[var(--status-critical-bg)] text-[var(--status-critical-fg)] border-transparent",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border-transparent",
};

/**
 * Single badge component for every domain status. Callers map a domain
 * enum value to a tone in one place (never inline colour logic in pages)
 * and pass the translated label as children.
 */
export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
