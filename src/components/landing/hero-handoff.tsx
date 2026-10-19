"use client";

import { useEffect } from "react";

/**
 * The hero → "El porqué" handoff (D-121). Scrolling down from the hero used to
 * slide the pinned stage up through a full viewport while "El porqué" was
 * still at opacity 0 (why-what.tsx FADE_IN), so the visitor scrolled through
 * an empty screen. Now the first downward gesture in the hero (wheel,
 * trackpad, swipe or a scrolling key) takes over: the page glides on its own
 * to where the stage has landed and "El porqué" is fully faded in, and the
 * panel fades in with the glide instead of waiting for it.
 *
 * Only this one seam, only while the pinned variant is showing (wide
 * viewport, motion allowed, scripting on) and the animation is not paused.
 * Upward scrolling and every other section scroll as before.
 */
const DURATION = 1100;
/** Past the pin's 10% fade-in (span 2 = 100vh of travel); same as `.porque-que`'s scroll-margin. */
const LANDING_OFFSET = 0.12;
const KEYS = new Set(["ArrowDown", "PageDown", " ", "Spacebar"]);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function HeroHandoff({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    const host = root?.querySelector<HTMLElement>("#porque");
    const act = host?.querySelector<HTMLElement>(":scope > .cl-pinned");
    if (!root || !host || !act) return;

    let running = false;
    let touchY: number | null = null;
    let settle = 0;

    /** Still in the hero: the pinned stage has not reached the top yet. */
    const armed = () =>
      !running &&
      !root.hasAttribute("data-still") &&
      getComputedStyle(act).display !== "none" &&
      act.getBoundingClientRect().top > 1;

    const go = () => {
      running = true;
      window.clearTimeout(settle);
      host.setAttribute("data-handoff", "");
      const from = window.scrollY;
      const to = act.getBoundingClientRect().top + from + LANDING_OFFSET * window.innerHeight;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        window.scrollTo({ top: from + (to - from) * ease(t), behavior: "instant" });
        if (t < 1) {
          requestAnimationFrame(step);
          return;
        }
        running = false;
        // The engine eases its own progress towards the new position; hold the
        // panel visible until it has caught up, then hand opacity back to it.
        settle = window.setTimeout(() => host.removeAttribute("data-handoff"), 600);
      };
      requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (running) return e.preventDefault();
      if (e.deltaY > 0 && !e.ctrlKey && armed()) {
        e.preventDefault();
        go();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, button, [contenteditable], dialog")) return;
      if (running) return e.preventDefault();
      if (armed()) {
        e.preventDefault();
        go();
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (running) return e.preventDefault();
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined || touchY - y < 8 || !armed()) return;
      e.preventDefault();
      touchY = null;
      go();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.clearTimeout(settle);
      host.removeAttribute("data-handoff");
    };
  }, [rootId]);
  return null;
}
