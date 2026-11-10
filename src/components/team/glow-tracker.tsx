"use client";

/**
 * Makes every `.edge-glow` element inside it follow the pointer, the way the
 * cohort cards do (CohortWorkspace): one listener on the wrapper sets
 * --glow-x / --glow-y on whichever glowing element the pointer is over. Lets a
 * server component use the effect without becoming a client component.
 */
export function GlowTracker({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(".edge-glow");
        if (!el || !e.currentTarget.contains(el)) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
