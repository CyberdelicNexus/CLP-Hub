"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The reading light of the stacked variant (D-061): a small lavender light that
 * starts above "El porqué" and travels down the page with the reader, lighting
 * each block of copy as it reaches it, on into "El qué".
 *
 * This is the stacked variant's answer to the desktop opening sequence, which
 * reveals the same two sections through the clip's wipes: on a phone there is
 * no pinned stage, so the copy would otherwise arrive all at once.
 *
 * Rules it keeps:
 * - Nothing hides until the script is running. The blocks only take their
 *   pre-reveal state under `[data-reading="live"]`, which this component sets
 *   on mount, so no-JS and pre-hydration readers see finished copy.
 * - Lit is one way. A block that has been reached stays lit on the way back up
 *   (the vendored engine's rule: copy that re-hides on scroll-up is a defect).
 * - Reduced motion and "Pausar animación" opt out entirely: the copy is shown
 *   and the light parks at the top.
 */
/** Where on screen the light reads: the upper third, where the eye already is. */
const FOCUS = 0.38;
/** A block lights when this much of it has risen past the light. */
const ENTER = 0.18;

export function ReadingLight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => reduced.matches || root.closest("[data-still]") !== null;
    if (still()) return;

    const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-reading-block]"));
    root.dataset.reading = "live";

    let frame = 0;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const focus = vh * FOCUS;
      // The light's own position inside the track, clamped to its ends, so it
      // arrives with the section and leaves with it instead of floating on.
      const y = Math.min(Math.max(focus - rect.top, 0), rect.height);
      root.style.setProperty("--ly", `${y.toFixed(1)}px`);
      // It fades in as the track arrives and out as the last copy leaves.
      const lit = rect.top < focus && rect.bottom > focus;
      root.style.setProperty("--lo", lit ? "1" : "0");

      for (const block of blocks) {
        if (block.dataset.lit !== undefined) continue;
        const b = block.getBoundingClientRect();
        if (b.top + b.height * ENTER <= focus) block.dataset.lit = "";
      }
    };

    // Only while the two sections are near the viewport.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (!frame) frame = window.requestAnimationFrame(tick);
        } else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "20% 0px" },
    );
    io.observe(root);
    tick();
    window.cancelAnimationFrame(frame);
    frame = 0;

    return () => {
      io.disconnect();
      window.cancelAnimationFrame(frame);
      delete root.dataset.reading;
    };
  }, []);

  return (
    <div ref={ref} className="reading">
      <span className="reading__light" aria-hidden />
      {children}
    </div>
  );
}
