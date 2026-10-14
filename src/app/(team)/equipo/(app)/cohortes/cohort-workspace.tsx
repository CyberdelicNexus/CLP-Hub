"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The cohort workspace's two states (2026-10-14 request): a grid of every
 * cohort by default, and once one is opened, the grid "moves to the left" into
 * a narrow column while the cohort's details fade in beside it.
 *
 * Selection stays a link (`?cohorte=<id>`) rendered on the server, so this
 * component only animates what the server already laid out. It does that with
 * FLIP: every card carries `data-flip-id`; the positions are measured just
 * before a click (and after every commit), and when the layout changes each
 * card is animated from where it was to where it now is. React's
 * `<ViewTransition>` would do the same natively, but D-091 keeps this app off
 * the canary React that component needs.
 *
 * Reduced motion: no card movement and no fade, the layout simply changes.
 */
const DURATION = 520;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type Box = { left: number; top: number; width: number; height: number };

function measure(root: HTMLElement | null): Map<string, Box> {
  const boxes = new Map<string, Box>();
  root?.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
    const r = el.getBoundingClientRect();
    // Page coordinates, so a scroll between two measurements does not read as movement.
    boxes.set(el.dataset.flipId as string, {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      width: r.width,
      height: r.height,
    });
  });
  return boxes;
}

export function CohortWorkspace({
  open,
  layoutKey,
  detailKey,
  list,
  detail,
}: {
  /** A cohort is selected: list on the left, details on the right. */
  open: boolean;
  /** Changes whenever the cards' arrangement may change (selection, filter). */
  layoutKey: string;
  /** The selected cohort's id, so its details fade in again when it changes. */
  detailKey: string | null;
  list: React.ReactNode;
  detail: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const previous = useRef<Map<string, Box>>(new Map());

  useLayoutEffect(() => {
    const root = listRef.current;
    const next = measure(root);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduce && root) {
      root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
        const before = previous.current.get(el.dataset.flipId as string);
        const after = next.get(el.dataset.flipId as string);
        if (!after) return;
        if (!before) {
          // A card that just appeared (a filter widened): fade it in where it is.
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION * 0.6, easing: EASING });
          return;
        }
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        const sx = before.width / after.width;
        const sy = before.height / after.height;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
        el.animate(
          [
            { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
            { transformOrigin: "top left", transform: "none" },
          ],
          { duration: DURATION, easing: EASING },
        );
      });
    }
    previous.current = next;
  }, [layoutKey]);

  return (
    <div
      className={cn(
        "grid min-w-0 gap-4",
        open && "lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start",
      )}
    >
      <div
        ref={listRef}
        // Measured just before the click that changes the layout, so the
        // animation starts from where the cards really were (after a resize
        // or a scroll), not from the last commit.
        onClickCapture={() => {
          previous.current = measure(listRef.current);
        }}
        // The edge glow follows the pointer (`.edge-glow` in globals.css).
        // One listener for the whole list rather than one per card.
        onPointerMove={(e) => {
          const card = (e.target as HTMLElement).closest<HTMLElement>("[data-flip-id]");
          if (!card) return;
          const r = card.getBoundingClientRect();
          card.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
          card.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
        }}
        className={cn(
          "min-w-0",
          // On a phone the open cohort takes the screen; the list returns
          // through the "all cohorts" link at the top of the details.
          open && "max-lg:hidden lg:sticky lg:top-[4.875rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pb-2",
        )}
      >
        {list}
      </div>

      {open ? (
        <div key={detailKey ?? "none"} className="cohort-detail-in min-w-0">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
