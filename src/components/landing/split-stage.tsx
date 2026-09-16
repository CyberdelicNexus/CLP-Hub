"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Signal } from "@/components/landing/signal";

/**
 * The light's journey from section 6 into section 7, driven by scroll and
 * reversed by scrolling back (D-049, D-050, D-051). Three stretches:
 *
 * 1. Split. The lights wait at the fork until the whole diagram has risen clear
 *    of the bottom of the viewport, then divide along their lines as it
 *    scrolls up. The group text fades in over the last stretch (`--k`).
 * 2. Reunion. After a pause for reading, both lights leave their lines (which
 *    fade out), travel down and meet at the section 7 light's starting point
 *    at the top of the participant photograph. There they hand over to that
 *    light, which is the same component at the same size.
 * 3. Heart. The section 7 light descends into the participant's heart and
 *    shrinks; this script drives its `--t` instead of the section's flow
 *    progress, so it starts only after the reunion.
 *
 * Everything reads one smoothed scroll position, so the three stretches cannot
 * drift apart, and positions are measured in pixels from the real layout, so a
 * light always sits on its line during the split. Both branches come from the
 * same map over the direction token.
 *
 * Reduced motion and "Pausar animación" show the split's end state and hand
 * section 7 back to its CSS. Without JavaScript the CSS places both lights at
 * their ends and the lines are absent.
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
/** Reunion: ends when the section 7 grid's top edge reaches this share of the viewport. */
const MEET_TOP = 0.28;
/** The section 7 light's resting point, as a share of the photograph's height (landing.css). */
const PARTICIPANT_LIGHT_Y = 0.16;
/** Heart: scroll after the reunion before the descent starts, and its length (shares of the viewport). */
const HEART_GAP = 0.04;
const HEART_RANGE = 0.6;
/** Share of the remaining scroll distance covered each frame. */
const FOLLOW = 0.16;

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

export function SplitStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const section = stage?.closest<HTMLElement>(".azar");
    const diagram = stage?.querySelector<HTMLElement>(".azar__diagram");
    const svg = stage?.querySelector<SVGSVGElement>(".azar__paths");
    const root = stage?.closest<HTMLElement>(".cl");
    const next = root?.querySelector<HTMLElement>(".elegibilidad");
    const grid = next?.querySelector<HTMLElement>(".elegibilidad__grid");
    const photo = next?.querySelector<HTMLElement>(".participant");
    if (!stage || !section || !diagram || !svg) return;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>(".azar__path"));
    const grads = Array.from(svg.querySelectorAll<SVGLinearGradientElement>("linearGradient"));
    const lights = Array.from(diagram.querySelectorAll<HTMLElement>(".azar__light"));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const still = () => reduced.matches || stage.closest("[data-still]") !== null;

    let curves: Curve[] = [];
    let diameter = 0;

    const layout = () => {
      const w = diagram.clientWidth;
      const h = diagram.clientHeight;
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

    const place = (light: HTMLElement | undefined, at: Pt) => {
      // The `translate` property, not `transform`: CSS applies `scale` (the
      // hover) before `translate`, so the light grows about its own centre.
      if (light) light.style.translate = `${at.x - diameter / 2}px ${at.y - diameter / 2}px`;
    };

    /** Split progress k, reunion progress m, heart progress t. */
    const draw = (k: number, m: number, t: number | null) => {
      // The line stops inside the light's haze, so its end never shows through the core.
      const trim = diameter * 0.15;
      const away = m > 0;
      curves.forEach((c, i) => {
        const s = ease(k) * c.total;
        const lineT = tAt(c, s - trim);
        const [p0, a, b, e] = sub(c.p, lineT);
        paths[i]?.setAttribute("d", lineT > 0 ? `M${p0.x} ${p0.y}C${a.x} ${a.y} ${b.x} ${b.y} ${e.x} ${e.y}` : "");
        if (!away) place(lights[i], sub(c.p, tAt(c, s))[3]);
      });

      // Reunion: from each line's end down to the section 7 light, in diagram pixels.
      if (away && photo && grid) {
        const d = diagram.getBoundingClientRect();
        const ph = photo.getBoundingClientRect();
        const meet: Pt = {
          x: ph.left + ph.width / 2 - d.left,
          y: grid.getBoundingClientRect().top + ph.height * PARTICIPANT_LIGHT_Y - d.top,
        };
        curves.forEach((c, i) => {
          const from = c.p[3];
          const dy = meet.y - from.y;
          // Straight down first, then in towards each other, then down onto the point together.
          // By curve parameter, not distance: both curves share their heights, so
          // the two lights descend level even though one travels further across.
          // Smoothstep rather than cubic, so the lights start moving down sooner
          // instead of first riding up the screen with the page.
          const p: [Pt, Pt, Pt, Pt] = [from, { x: from.x, y: from.y + dy * 0.45 }, { x: meet.x, y: meet.y - dy * 0.45 }, meet];
          place(lights[i], sub(p, m * m * (3 - 2 * m))[3]);
        });
      }

      stage.style.setProperty("--k", k.toFixed(4));
      // Lines fade over the first third of the reunion; the lights hand over on arrival.
      stage.style.setProperty("--line", (1 - clamp01(m / 0.35)).toFixed(4));
      stage.dataset.away = away ? (m >= 1 ? "met" : "moving") : "";
      if (next) {
        if (t === null) {
          delete next.dataset.journey;
          next.style.removeProperty("--jt");
        } else {
          next.dataset.journey = m >= 1 ? "met" : "waiting";
          next.style.setProperty("--jt", t.toFixed(4));
        }
      }
    };

    let y = window.scrollY;
    let frame = 0;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      if (still()) {
        y = window.scrollY;
        draw(1, 0, null);
        return;
      }
      // One smoothed scroll position drives every stretch, with a little inertia.
      const goal = window.scrollY;
      y = Math.abs(goal - y) < 0.5 ? goal : y + (goal - y) * FOLLOW;
      const vh = window.innerHeight;
      const lag = goal - y;

      // Viewport positions as they will be once the smoothing catches up.
      const diagramTop = diagram.getBoundingClientRect().top + lag;
      const endTop = vh * END_TOP;
      const startTop = Math.max(vh * START_BOTTOM - diagram.offsetHeight, endTop + MIN_TRAVEL_PX);
      const k = clamp01((startTop - diagramTop) / (startTop - endTop));

      let m = 0;
      let t = 0;
      if (grid && photo) {
        // One axis: pixels scrolled since the split ended (negative before).
        const scrolled = endTop - diagramTop;
        const leaveAt = vh * READ_HOLD;
        // The grid is in normal flow, so its distance below the diagram is fixed:
        // it reaches MEET_TOP after this much scroll.
        const gap = grid.getBoundingClientRect().top + lag - diagramTop;
        const meetAt = Math.max(endTop - vh * MEET_TOP + gap, leaveAt + vh * 0.3);
        m = clamp01((scrolled - leaveAt) / (meetAt - leaveAt));
        t = clamp01((scrolled - meetAt - vh * HEART_GAP) / (vh * HEART_RANGE));
      }
      draw(k, m, grid && photo ? t : null);
    };

    // Run the loop only while section 6 or 7 is near the viewport.
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
      if (next) {
        delete next.dataset.journey;
        next.style.removeProperty("--jt");
      }
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
      {children}
    </div>
  );
}
