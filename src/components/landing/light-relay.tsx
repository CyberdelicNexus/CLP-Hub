"use client";

import { useEffect, useRef } from "react";
import { Signal } from "@/components/landing/signal";

/**
 * The light after the programme stages (D-102), driven by scroll and reversed
 * by scrolling back. It picks up where split-stage.tsx leaves it, on the
 * stages timeline, and carries it through three more stretches:
 *
 * 1. Into the steps. When the stages pin ends, this light takes over from the
 *    timeline light at S6 and travels to the left of step 1, arriving as the
 *    "how to join" pin starts.
 * 2. Down the steps. While that section is pinned, it moves down beside step
 *    2 and then step 3 as each becomes active (the same windows as join.tsx).
 * 3. Into the photograph. When that pin ends, it grows back to the medium size
 *    and comes down onto the eligibility photograph's light, which then
 *    descends into the heart only after the arrival (`data-journey` / `--jt`).
 *
 * It is one fixed-position light placed in viewport pixels, and every
 * endpoint is read live from the element it hands over to or from, so both
 * hand-overs are exact. It runs only where both pinned sections are shown
 * (wide viewport, motion allowed) and the sections sit in this order; under
 * reduced motion or "Pausar animación" every section keeps its own light.
 */
/** Arrival: the eligibility grid's top edge at this share of the viewport. */
const MEET_TOP = 0.28;
/** Heart: scroll after the arrival before the descent starts, and its length (shares of the viewport). */
const HEART_GAP = 0.04;
const HEART_RANGE = 0.6;
/** Join progress at which the light moves from step 1 to 2, and from 2 to 3 (join.tsx windows). */
const STEP_MOVES = [
  [0.27, 0.37],
  [0.61, 0.71],
] as const;
/** Gap between the light's centre and the step number's left edge, as a share of its diameter. */
const BESIDE = 0.55;
/** Blur as a share of the diameter: the timeline light's, and the signal's own (landing.css). */
const BLUR_SMALL = 0.06;
const BLUR_LARGE = 0.028;

type Pt = { x: number; y: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const centre = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export function LightRelay({ rootId }: { rootId: string }) {
  const lightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const light = lightRef.current;
    const root = document.getElementById(rootId);
    const stages = root?.querySelector<HTMLElement>(".etapas");
    const join = stages?.nextElementSibling;
    const elig = join?.nextElementSibling;
    // Reordering the page must never send the light across unrelated sections.
    if (!light || !root || !stages || !(join instanceof HTMLElement) || !join.matches(".join")) return;
    if (!(elig instanceof HTMLElement) || !elig.matches(".elegibilidad")) return;
    const stagesAct = stages.querySelector<HTMLElement>("[data-sc-act]");
    const joinAct = join.querySelector<HTMLElement>("[data-sc-act]");
    const timelineLight = stages.querySelector<HTMLElement>(".timeline__light");
    const nums = Array.from(join.querySelectorAll<HTMLElement>(".stage--join .step__num"));
    const grid = elig.querySelector<HTMLElement>(".elegibilidad__grid");
    const photoLight = elig.querySelector<HTMLElement>(".participant__light");
    if (!stagesAct || !joinAct || !timelineLight || nums.length < 3 || !grid || !photoLight) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => reduced.matches || root.hasAttribute("data-still");
    // The pinned variants are display:none on narrow or very short viewports (landing.css).
    const shown = () => stagesAct.offsetParent !== null && joinAct.offsetParent !== null;

    const release = () => {
      delete light.dataset.on;
      delete stages.dataset.relay;
      delete elig.dataset.journey;
      elig.style.removeProperty("--jt");
    };

    /** Beside step k's number, at the travelling size d. */
    const beside = (k: number, d: number): Pt => {
      const r = nums[k].getBoundingClientRect();
      return { x: Math.max(r.left - d * BESIDE, d / 2 + 4), y: r.top + r.height / 2 };
    };

    const draw = () => {
      if (still() || !shown()) {
        release();
        return;
      }
      const vh = window.innerHeight;
      const y = window.scrollY;
      // Page offsets of each boundary, from the live layout.
      const stagesEnd = stagesAct.getBoundingClientRect().bottom + y - vh;
      const joinRect = joinAct.getBoundingClientRect();
      const joinStart = joinRect.top + y;
      const joinEnd = joinRect.bottom + y - vh;
      const arriveAt = Math.max(grid.getBoundingClientRect().top + y - vh * MEET_TOP, joinEnd + vh * 0.3);

      const small = timelineLight.offsetWidth;
      const large = photoLight.offsetWidth;
      let at: Pt;
      let d = small;
      let blur = BLUR_SMALL;

      if (y <= stagesEnd) {
        // Still the timeline's light.
        release();
        elig.dataset.journey = "waiting";
        elig.style.setProperty("--jt", "0");
        return;
      } else if (y < joinStart) {
        // 1. From S6, moving up with the stages, to step 1, rising with the steps.
        const t = smooth(clamp01((y - stagesEnd) / (joinStart - stagesEnd)));
        at = mix(centre(timelineLight), beside(0, d), t);
      } else if (y <= joinEnd) {
        // 2. Down the steps, timed to the engine's own progress for the section.
        const p = parseFloat(joinAct.style.getPropertyValue("--sc-p")) || clamp01((y - joinStart) / (joinEnd - joinStart));
        at = beside(0, d);
        STEP_MOVES.forEach(([from, to], i) => {
          at = mix(at, beside(i + 1, d), smooth(clamp01((p - from) / (to - from))));
        });
      } else if (y < arriveAt) {
        // 3. From step 3, rising with the steps, down onto the photograph's light.
        const t = smooth(clamp01((y - joinEnd) / (arriveAt - joinEnd)));
        d = small + (large - small) * t;
        blur = BLUR_SMALL + (BLUR_LARGE - BLUR_SMALL) * t;
        const from = beside(2, small);
        const to = centre(photoLight);
        // Leave sideways and arrive from above, like the reunion's curve.
        at = { x: from.x + (to.x - from.x) * smooth(clamp01(t * 1.4)), y: from.y + (to.y - from.y) * t };
      } else {
        // Arrived: the photograph's light carries on into the heart.
        delete light.dataset.on;
        stages.dataset.relay = "away";
        elig.dataset.journey = "met";
        elig.style.setProperty("--jt", clamp01((y - arriveAt - vh * HEART_GAP) / (vh * HEART_RANGE)).toFixed(4));
        return;
      }

      light.dataset.on = "";
      stages.dataset.relay = "away";
      elig.dataset.journey = "waiting";
      elig.style.setProperty("--jt", "0");
      light.style.setProperty("--d", `${d.toFixed(2)}px`);
      light.style.filter = `blur(${(d * blur).toFixed(2)}px)`;
      light.style.translate = `${(at.x - d / 2).toFixed(2)}px ${(at.y - d / 2).toFixed(2)}px`;
    };

    // Run the loop only while one of the three sections is near the viewport.
    let frame = 0;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      draw();
    };
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        if (visible.size && !frame) frame = window.requestAnimationFrame(tick);
        else if (!visible.size && frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "25% 0px" },
    );
    [stages, join, elig].forEach((s) => io.observe(s));
    draw();

    return () => {
      io.disconnect();
      window.cancelAnimationFrame(frame);
      release();
    };
  }, [rootId]);

  return <Signal ref={lightRef} className="relay-light" size="var(--cl-light-sm)" />;
}
