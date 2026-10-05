"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Signal } from "@/components/landing/signal";

/**
 * The light's journey from the trial section into the programme stages, driven
 * by scroll and reversed by scrolling back (D-049, D-050, D-051, D-101). Three
 * stretches:
 *
 * 1. Split. The lights wait at the fork until the whole diagram has risen clear
 *    of the bottom of the viewport, then divide along their lines as it
 *    scrolls up. The group text fades in over the last stretch (`--k`).
 * 2. Reunion. After a pause for reading, both lights leave their lines (which
 *    fade out) at full size, travel down level along D-051's curve and meet at
 *    one point centred under the diagram, where they become one.
 * 3. Descent. The one light travels down with the reader, shrinking to the
 *    timeline light's size over the final stretch, and lands on the S0 node at
 *    the moment the stages pin starts. There it hands over to the timeline light, which is the same
 *    component, and the timeline runs as usual.
 *
 * Everything reads one smoothed scroll position, so the stretches cannot drift
 * apart, and positions are measured in pixels from the real layout, so a light
 * always sits on its line during the split. Both branches come from the same
 * map over the direction token.
 *
 * The merge and descent run only where the pinned timeline is shown (wide
 * viewport, motion allowed); elsewhere the lights stay at the split's ends.
 * Reduced motion and "Pausar animación" show the split's end state and leave
 * the timeline light alone. Without JavaScript the CSS places both lights at
 * their ends and the lines are absent.
 *
 * On a phone (D-103) light-journey.tsx owns the light before and after this
 * section and marks it `data-journey="narrow"`. There the lights still split,
 * then, after the reading pause, come together at a point under the group
 * card and hand over to that light. The two groups share one card that flips
 * (`--face`), because two columns are too narrow to read at that width.
 */
const DIRS = [-1, 1] as const;
const SAMPLES = 64;
/** Split: starts once the diagram's bottom edge is above this share of the viewport. */
const START_BOTTOM = 0.84;
/** Split: ends when the diagram's top edge reaches this share. */
const END_TOP = 0.14;
/** A floor on the split's scroll distance, for short viewports. */
const MIN_TRAVEL_PX = 220;
/** Scroll, as a share of the viewport, spent reading the groups before the lights leave. */
const READ_HOLD = 0.22;
/** Where the two lights meet, as a share of the viewport's height when they arrive. */
const MERGE_Y = 0.42;
/** Share of the scroll between leaving and landing spent on the reunion; the rest is the descent. */
const MERGE_SHARE = 0.38;
/** Share of the descent after which the light starts shrinking to the timeline's size. */
const SHRINK_FROM = 0.5;
/** Blur as a share of the diameter: the signal's own, and the timeline light's (landing.css). */
const BLUR_FROM = 0.028;
const BLUR_TO = 0.06;
/** Share of the remaining scroll distance covered each frame. */
const FOLLOW = 0.16;
/** Phone: scroll spent reading before the lights leave, and on the reunion (shares of the viewport). */
const NARROW_HOLD = 0.2;
const NARROW_MERGE = 0.3;
/** Phone: the reunion point, below the stage's bottom edge, as a share of the light's diameter. */
const NARROW_MEET_BELOW = 0.3;

type Pt = { x: number; y: number };
type Curve = { p: [Pt, Pt, Pt, Pt]; lengths: number[]; total: number };

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function curve(p: [Pt, Pt, Pt, Pt]): Curve {
  const lengths = [0];
  let prev = p[0];
  for (let i = 1; i <= SAMPLES; i++) {
    const q = sub(p, i / SAMPLES)[3];
    lengths.push(lengths[i - 1] + Math.hypot(q.x - prev.x, q.y - prev.y));
    prev = q;
  }
  return { p, lengths, total: lengths[SAMPLES] };
}

/** The cubic from 0 to t, as its own four control points (de Casteljau). */
function sub([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): [Pt, Pt, Pt, Pt] {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  return [p0, a, d, lerp(d, e, t)];
}

/** Curve parameter at a distance along the curve. */
function tAt(c: Curve, s: number): number {
  if (s <= 0) return 0;
  if (s >= c.total) return 1;
  let i = 1;
  while (c.lengths[i] < s) i++;
  const span = c.lengths[i] - c.lengths[i - 1] || 1;
  return (i - 1 + (s - c.lengths[i - 1]) / span) / SAMPLES;
}

/**
 * A viewport height that holds still while a phone's address bar hides and
 * shows. `innerHeight` changes with the bar, mid-scroll, and every position
 * derived from it moved with it: the lights jittered, most of all scrolling
 * up, which is when the bar comes back. `100svh` is the height with the bar
 * showing and does not change until the device is rotated.
 */
let probe: HTMLElement | null = null;
export function steadyViewportHeight(): number {
  if (!probe || !probe.isConnected) {
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  return probe.offsetHeight || window.innerHeight;
}

/**
 * Where the split starts and ends, as viewport positions of the diagram's top
 * edge. Shared with light-journey.tsx so its light arrives at the fork on the
 * frame the split begins.
 */
export function splitWindow(diagram: HTMLElement, vh: number) {
  const endTop = vh * END_TOP;
  const startTop = Math.max(vh * START_BOTTOM - diagram.offsetHeight, endTop + MIN_TRAVEL_PX);
  return { startTop, endTop };
}

/**
 * The phone reunion: scroll after the split's end at which the lights leave
 * and meet, and the meeting point's height in diagram pixels (the diagram is
 * the stage's first child, so the stage's height is measured from its top).
 */
export function narrowReunion(stage: HTMLElement, vh: number, diameter: number) {
  const leaveAt = vh * NARROW_HOLD;
  return { leaveAt, mergeAt: leaveAt + vh * NARROW_MERGE, meetY: stage.offsetHeight + diameter * NARROW_MEET_BELOW };
}

export function SplitStage({ children, flipLabel }: { children: ReactNode; flipLabel: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  // Which group the phone card shows; wide viewports show both and ignore it.
  const [face, setFace] = useState(0);
  const flip = () => setFace((f) => 1 - f);

  useEffect(() => {
    const stage = stageRef.current;
    const section = stage?.closest<HTMLElement>(".azar");
    const diagram = stage?.querySelector<HTMLElement>(".azar__diagram");
    const svg = stage?.querySelector<SVGSVGElement>(".azar__paths");
    // Reordering the page must never send the lights across unrelated sections.
    const sibling = section?.nextElementSibling;
    const next = sibling instanceof HTMLElement && sibling.matches(".etapas") ? sibling : null;
    const act = next?.querySelector<HTMLElement>("[data-sc-act]") ?? null;
    const target = act?.querySelector<HTMLElement>(".timeline__light") ?? null;
    if (!stage || !section || !diagram || !svg) return;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>(".azar__path"));
    const grads = Array.from(svg.querySelectorAll<SVGLinearGradientElement>("linearGradient"));
    const lights = Array.from(diagram.querySelectorAll<HTMLElement>(".azar__light"));
    // The size token Signal writes inline (--cl-light-md); the descent overrides
    // it with pixels and must put it back, never remove it.
    const baseD = lights.map((l) => l.style.getPropertyValue("--d"));
    const resetSize = () => lights.forEach((l, i) => l.style.setProperty("--d", baseD[i]));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => reduced.matches || stage.closest("[data-still]") !== null;

    let curves: Curve[] = [];
    let diameter = 0;

    const layout = () => {
      const w = diagram.clientWidth;
      const h = diagram.clientHeight;
      // Measured at the token size, so the descent's shrinking never feeds back.
      resetSize();
      diameter = lights[0]?.offsetWidth ?? 0;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const fork: Pt = { x: w / 2, y: diameter / 2 };
      curves = DIRS.map((dir, i) => {
        const end: Pt = { x: w / 2 + (dir * w) / 4, y: h - diameter / 2 };
        const dy = end.y - fork.y;
        const g = grads[i];
        g?.setAttribute("x1", String(fork.x));
        g?.setAttribute("y1", String(fork.y));
        g?.setAttribute("x2", String(end.x));
        g?.setAttribute("y2", String(end.y));
        return curve([fork, { x: fork.x, y: fork.y + dy * 0.48 }, { x: end.x, y: fork.y + dy * 0.5 }, end]);
      });
    };

    const place = (light: HTMLElement | undefined, at: Pt, d = diameter) => {
      // The `translate` property, not `transform`: CSS applies `scale` (the
      // hover) before `translate`, so the light grows about its own centre.
      if (light) light.style.translate = `${at.x - d / 2}px ${at.y - d / 2}px`;
    };

    /** From a to b, leaving and arriving vertically; smoothstep so it moves promptly. */
    const glide = (a: Pt, b: Pt, u: number): Pt => {
      const dy = b.y - a.y;
      return sub([a, { x: a.x, y: a.y + dy * 0.45 }, { x: b.x, y: b.y - dy * 0.45 }, b], u * u * (3 - 2 * u))[3];
    };

    const clearJourney = () => {
      resetSize();
      for (const l of lights) {
        l.style.removeProperty("filter");
        l.style.removeProperty("opacity");
      }
    };

    /**
     * Split progress k, reunion progress m, descent progress n; meetY is the
     * reunion point's height in diagram pixels; journey: the timeline takes
     * the light; narrow: the phone's light takes it at the reunion point.
     */
    const draw = (k: number, m: number, n: number, meetY: number, journey: boolean, narrow: boolean) => {
      // The line stops inside the light's haze, so its end never shows through the core.
      const trim = diameter * 0.15;
      const descends = journey && act !== null && target !== null;
      const away = m > 0 && (descends || narrow);
      curves.forEach((c, i) => {
        const s = ease(k) * c.total;
        const lineT = tAt(c, s - trim);
        const [p0, a, b, e] = sub(c.p, lineT);
        paths[i]?.setAttribute("d", lineT > 0 ? `M${p0.x} ${p0.y}C${a.x} ${a.y} ${b.x} ${b.y} ${e.x} ${e.y}` : "");
        if (!away) place(lights[i], sub(c.p, tAt(c, s))[3]);
      });

      if (away) {
        const d = diagram.getBoundingClientRect();
        // The reunion point is fixed on the page, centred under the diagram.
        const meet: Pt = { x: d.width / 2, y: meetY };
        let size = diameter;
        let blur = diameter * BLUR_FROM;
        let start = meet;
        let land: Pt | null = null;
        if (journey && act !== null && target !== null) {
          // Where S0's light will sit once the stages pin: the stage is sticky at
          // the act's top, so that point is fixed in the viewport while the
          // timeline rises to meet the light.
          const tr = target.getBoundingClientRect();
          land = {
            x: tr.left + tr.width / 2,
            y: tr.top + tr.height / 2 - Math.max(0, act.getBoundingClientRect().top),
          };
          // Full size through the reunion and most of the descent; it shrinks
          // to the timeline light's size over the final stretch.
          const u = ease(clamp01((n - SHRINK_FROM) / (1 - SHRINK_FROM)));
          size = diameter + ((target.offsetWidth || diameter) - diameter) * u;
          blur = size * (BLUR_FROM + (BLUR_TO - BLUR_FROM) * u);
          // The descent starts where the reunion ended (fixed on the page) and
          // settles onto a point held in the viewport, so the light comes down
          // with the reader instead of riding up with the page.
          const held: Pt = { x: d.left + meet.x, y: window.innerHeight * MERGE_Y };
          const w = clamp01(n / 0.2);
          start = lerp({ x: d.left + meet.x, y: d.top + meet.y }, held, w * w * (3 - 2 * w));
        }
        curves.forEach((c, i) => {
          const light = lights[i];
          if (!light) return;
          let at: Pt;
          if (n > 0 && land) {
            const v = glide(start, land, n);
            at = { x: v.x - d.left, y: v.y - d.top };
          } else {
            // The reunion as before (D-051): straight down, in towards each
            // other, then down onto the point together. By curve parameter, so
            // both lights descend level.
            const from = c.p[3];
            const dy = meet.y - from.y;
            const p: [Pt, Pt, Pt, Pt] = [from, { x: from.x, y: from.y + dy * 0.45 }, { x: meet.x, y: meet.y - dy * 0.45 }, meet];
            at = sub(p, m * m * (3 - 2 * m))[3];
          }
          light.style.setProperty("--d", `${size.toFixed(2)}px`);
          light.style.filter = `blur(${blur.toFixed(2)}px)`;
          // Both lights are on one point once they meet; the second one hands over.
          if (i > 0) light.style.opacity = m >= 1 ? "0" : "";
          place(light, at, size);
        });
      } else {
        clearJourney();
      }

      stage.style.setProperty("--k", k.toFixed(4));
      // Lines fade over the first third of the merge.
      stage.style.setProperty("--line", (1 - clamp01(m / 0.35)).toFixed(4));
      // On a phone the hand-over is at the reunion point; otherwise on landing.
      stage.dataset.away = away ? ((descends ? n : m) >= 1 ? "met" : "moving") : "";
      if (next) {
        // Until the light lands, the timeline's own light waits unseen.
        if (journey) next.dataset.journey = away && n >= 1 ? "met" : "waiting";
        else delete next.dataset.journey;
      }
    };

    let y = window.scrollY;
    let frame = 0;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      if (still()) {
        y = window.scrollY;
        draw(1, 0, 0, 0, false, false);
        return;
      }
      // The pinned timeline is display:none on narrow viewports (landing.css):
      // there the lights stay at the split's ends.
      const journey = target !== null && act !== null && act.offsetParent !== null;
      // light-journey.tsx marks the section while its light is travelling the page.
      const narrow = !journey && section.dataset.journey === "narrow";
      // One smoothed scroll position drives every stretch, with a little inertia.
      // Not on a phone: touch scrolling has its own, and both scripts must
      // agree on the frame the light changes hands.
      const goal = window.scrollY;
      y = narrow || Math.abs(goal - y) < 0.5 ? goal : y + (goal - y) * FOLLOW;
      const vh = narrow ? steadyViewportHeight() : window.innerHeight;
      const lag = goal - y;

      // Viewport positions as they will be once the smoothing catches up.
      const diagramTop = diagram.getBoundingClientRect().top + lag;
      const { startTop, endTop } = splitWindow(diagram, vh);
      const k = clamp01((startTop - diagramTop) / (startTop - endTop));

      let m = 0;
      let n = 0;
      let meetY = 0;
      if (journey) {
        // One axis: pixels scrolled since the split ended (negative before).
        const scrolled = endTop - diagramTop;
        const leaveAt = vh * READ_HOLD;
        // The act is in normal flow, so its distance below the diagram is
        // fixed: its pin starts (top at 0) after this much scroll.
        const gap = act.getBoundingClientRect().top + lag - diagramTop;
        const landAt = Math.max(endTop + gap, leaveAt + vh * 0.5);
        const mergeAt = leaveAt + (landAt - leaveAt) * MERGE_SHARE;
        m = clamp01((scrolled - leaveAt) / (mergeAt - leaveAt));
        n = clamp01((scrolled - mergeAt) / (landAt - mergeAt));
        // Diagram pixels: the point that sits at MERGE_Y of the viewport when the reunion ends.
        meetY = vh * MERGE_Y - (endTop - mergeAt);
      } else if (narrow) {
        const r = narrowReunion(stage, vh, diameter);
        m = clamp01((endTop - diagramTop - r.leaveAt) / (r.mergeAt - r.leaveAt));
        meetY = r.meetY;
      }
      draw(k, m, n, meetY, journey, narrow);
    };

    // Run the loop only while the trial section or the stages are near the viewport.
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        if (visible.size && !frame) {
          y = window.scrollY;
          frame = window.requestAnimationFrame(tick);
        } else if (!visible.size && frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "25% 0px" },
    );

    stage.dataset.split = "live";
    layout();
    tick();
    window.cancelAnimationFrame(frame);
    frame = 0;
    const ro = new ResizeObserver(layout);
    ro.observe(diagram);
    io.observe(section);
    if (next) io.observe(next);

    return () => {
      ro.disconnect();
      io.disconnect();
      window.cancelAnimationFrame(frame);
      clearJourney();
      if (next) delete next.dataset.journey;
    };
  }, []);

  return (
    <div ref={stageRef} className="azar__stage">
      <div className="azar__diagram">
        <svg className="azar__paths" aria-hidden>
          <defs>
            {DIRS.map((dir) => (
              <linearGradient key={dir} id={`azar-line-${dir}`} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="rgb(96 58 190)" stopOpacity="0" />
                <stop offset="0.3" stopColor="rgb(112 70 206)" stopOpacity="0.5" />
                <stop offset="0.72" stopColor="rgb(178 128 236)" stopOpacity="0.85" />
                <stop offset="1" stopColor="rgb(240 214 226)" stopOpacity="0.95" />
              </linearGradient>
            ))}
          </defs>
          {DIRS.map((dir) => (
            <path key={dir} className="azar__path" stroke={`url(#azar-line-${dir})`} />
          ))}
        </svg>
        {DIRS.map((dir) => (
          <Signal key={dir} className="azar__light" size="var(--cl-light-md)" style={{ "--dir": dir } as CSSProperties} />
        ))}
      </div>
      {/* Phone only (landing.css): one card, a tap turns it to the other group. */}
      <div className="azar__card" style={{ "--face": face } as CSSProperties} onClick={flip}>
        {children}
      </div>
      <button type="button" className="cl-ghost azar__flip" onClick={flip}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 9a8 8 0 0 1 14.2-3.6M20 4v4.5h-4.5M20 15a8 8 0 0 1-14.2 3.6M4 20v-4.5h4.5" />
        </svg>
        {flipLabel}
        <span className="azar__flip-dots" data-face={face} aria-hidden>
          <i />
          <i />
        </span>
      </button>
    </div>
  );
}
