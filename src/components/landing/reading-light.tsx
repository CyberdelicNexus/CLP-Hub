"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The reading light of the stacked variant (D-061, extended for the mobile
 * hero-to-seam handoff): a small lavender light that starts on the hero
 * photograph, at the body facing away from camera, and travels down with the
 * reader through "El porqué" until it reaches the seam light shared with
 * "El qué" (`.porque__light`, why-what.tsx) and comes to rest at its centre.
 * The seam light itself starts breathing (`.signal--breath`, landing.css)
 * only once the travelling light has arrived, instead of always.
 *
 * This is the stacked variant's answer to the desktop opening sequence, which
 * reveals "El porqué" and "El qué" through the clip's wipes, and whose hero
 * still is the same frame the travelling light starts from here: on a phone
 * there is no pinned stage, so the copy would otherwise arrive all at once.
 *
 * Rules it keeps:
 * - Nothing hides until the script is running. The blocks only take their
 *   pre-reveal state under `[data-reading="live"]`, which this component sets
 *   on mount, so no-JS and pre-hydration readers see finished copy, and the
 *   hero (which carries no `[data-reading-block]`) is never affected.
 * - Lit is one way. A block that has been reached stays lit on the way back up
 *   (the vendored engine's rule: copy that re-hides on scroll-up is a defect).
 *   Arrival at the seam light is the same: once reached, the seam keeps
 *   breathing even if the reader scrolls back up past it.
 * - Reduced motion and "Pausar animación" opt out entirely: the copy is shown,
 *   the light never appears, and the seam light stays still.
 *
 * DOM order matters here beyond the usual reason: the light span sits between
 * `hero` and `children` so it paints over the hero photograph (later in
 * document order than the hero's own stacking context) but still under the
 * "El porqué" / "El qué" copy (earlier than theirs), exactly as it did when
 * it only ever travelled behind those two sections.
 */
/** Where on screen the light reads: the upper third, where the eye already is. */
const FOCUS = 0.38;
/** A block lights when this much of it has risen past the light. */
const ENTER = 0.18;
/** Where in the hero photograph the light originates: the body facing away
 *  from camera, as a fraction of `.hero__media`'s box (measured against
 *  hero-physical-v3.webp — centred horizontally, so no --lx is needed). */
const HERO_ANCHOR_Y = 0.6;

export function ReadingLight({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => reduced.matches || root.closest("[data-still]") !== null;
    if (still()) return;

    const heroMedia = root.querySelector<HTMLElement>(".hero__media");
    const orb = root.querySelector<HTMLElement>(".porque__light");
    const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-reading-block]"));
    root.dataset.reading = "live";

    let frame = 0;
    let arrived = false;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const focus = vh * FOCUS;

      const heroRect = heroMedia?.getBoundingClientRect();
      const start = heroRect ? heroRect.top - rect.top + heroRect.height * HERO_ANCHOR_Y : 0;
      const orbRect = orb?.getBoundingClientRect();
      const end = orbRect ? orbRect.top - rect.top + orbRect.height / 2 : rect.height;

      // The light's own position inside the track, clamped between the hero
      // anchor and the seam light, so it arrives with the reader and parks at
      // the seam instead of floating past it.
      const raw = focus - rect.top;
      const y = Math.min(Math.max(raw, start), end);
      root.style.setProperty("--ly", `${y.toFixed(1)}px`);
      // It fades in once the focus line reaches the hero anchor and out once
      // the whole track leaves the viewport.
      const lit = raw >= start && rect.bottom > focus;
      root.style.setProperty("--lo", lit ? "1" : "0");

      if (!arrived && orb && raw >= end - 0.5) {
        arrived = true;
        orb.setAttribute("data-arrived", "");
      }

      for (const block of blocks) {
        if (block.dataset.lit !== undefined) continue;
        const b = block.getBoundingClientRect();
        if (b.top + b.height * ENTER <= focus) block.dataset.lit = "";
      }
    };

    // Only while the track is near the viewport.
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
      {hero}
      <span className="reading__light" aria-hidden />
      {children}
    </div>
  );
}
