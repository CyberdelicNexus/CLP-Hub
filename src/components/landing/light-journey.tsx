"use client";

import { useEffect, useRef } from "react";
import { Signal } from "@/components/landing/signal";
import { narrowReunion, splitWindow, steadyViewportHeight } from "@/components/landing/split-stage";

/**
 * The light's journey on a phone (D-103), driven by scroll and reversed by
 * scrolling back. The stacked layout has no pinned stages for the light to
 * ride, so this one fixed light visits a list of stops down the page:
 *
 * 1. It appears at the centre of the hero's circle of light bodies.
 * 2. It comes straight down to rest above "El porqué". When that nears the
 *    top of the screen the light is released: it glides straight down to the
 *    film's play button in its own time, slowly, whatever the reader's scroll
 *    is doing (and back up if they scroll back past that point). It goes
 *    all the way, off the bottom of the screen if the button is still below
 *    it, so it is already there when the reader arrives. There it hands over to a pulsing halo under the
 *    button (film-player.tsx), so the button is never covered and the halo
 *    goes with it when the film starts.
 * 3. It leaves the film and comes down through the trial section's text, which
 *    appears from the top behind the light as it passes, and arrives on the fork
 *    on the frame the split begins. split-stage.tsx divides it in two and
 *    brings the two back together under the group card.
 * 4. From there it curves from one stage illustration to the next, resting on
 *    a meaningful point of each (`data-light`, stages.tsx), goes small and
 *    straight down the left of the three joining steps' numbers, and comes
 *    down the middle of the eligibility photograph to rest on the heart.
 *
 * The light is positioned in the document, not fixed to the screen: a phone
 * scrolls on its compositor, ahead of script, so a fixed light that script
 * moves to follow the page trails it by a frame and visibly jitters. In the
 * document it scrolls with the page for free, and at rest nothing is written
 * at all. For the same reason every position uses a viewport height that
 * ignores the address bar (`steadyViewportHeight`).
 *
 * Every stop is a point on the page, read live from the element it belongs
 * to, with the scroll positions at which the light arrives and leaves. At
 * rest the light is fixed to the page; between stops it travels along a
 * curve tied to scroll, except the glide to the play button, which is
 * triggered by scroll but runs on the clock. Both hand-overs with the split are exact because both scripts share
 * split-stage.tsx's geometry and read the same scroll position.
 *
 * It runs only on the stacked layout with motion allowed. Under reduced
 * motion or "Pausar animación" it releases everything, and every section
 * shows its own static state.
 */
/** The centre of the circle in the hero's phone crop, as shares of the media box. */
const HERO_SPOT = { x: 0.5, y: 0.4 };
/** Hero: the light appears as the circle's centre rises between these shares of the viewport. */
const APPEAR = [0.94, 0.72] as const;
/** Sizes as shares of the medium light. */
const SIZE_STAGE = 0.6;
const SIZE_STEP = 0.37;
const SIZE_PHOTO = 0.8;
const SIZE_HEART = 0.5;
/** Blur as a share of the diameter: the small light's, and the signal's own (landing.css). */
const BLUR_SMALL = 0.06;
const BLUR_LARGE = 0.028;
/** Gap between the light's centre and a step number's left edge, as a share of its diameter. */
const BESIDE = 0.75;
/** The glide from "El porqué" to the play button: slow, and on the clock, not the scroll. */
const GLIDE_MS = 3200;
/** Time over which the light and the play button's halo change places. */
const DOCK_FADE_MS = 320;
/** The trial text is revealed this far above the light's centre, in diameters, so it appears behind it. */
const LIT_TRAIL = 0.6;
/** Least scroll between leaving one stop and reaching the next. */
const MIN_TRAVEL_PX = 70;
/** How much of the vertical travel is eased; the rest is linear, so the light never rides off the top. */
const Y_EASE = 0.35;
/** Sideways swing of a curved stretch, as a share of the viewport's width. */
const BOW = 0.16;
/** Frames drawn after the last scroll or resize, to follow the engine's reveals as they settle. */
const SETTLE_FRAMES = 50;

type Stop = {
  x: number;
  y: number;
  d: number;
  /** Scroll positions at which the light arrives and leaves. */
  in: number;
  out: number;
  /** Fixed by another script; neighbours give way. */
  fixed?: boolean;
  /** Sideways swing on the way to the next stop, in pixels. */
  bow?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Slower at both ends than `smooth`, for a movement that runs on the clock. */
const glideEase = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function LightJourney({ rootId }: { rootId: string }) {
  const lightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const light = lightRef.current;
    const root = document.getElementById(rootId);
    if (!light || !root) return;
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
    const heroMedia = q(".hero__media");
    const whyTitle = q(".cl-stacked .porque h2");
    const film = q(".cl-stacked .film");
    const filmFrame = film?.querySelector<HTMLElement>(".film__frame");
    const azar = q(".azar");
    const azarHead = azar?.querySelector<HTMLElement>(".azar__head");
    const azarStage = azar?.querySelector<HTMLElement>(".azar__stage");
    const diagram = azar?.querySelector<HTMLElement>(".azar__diagram");
    const azarLight = azar?.querySelector<HTMLElement>(".azar__light");
    const figures = Array.from(root.querySelectorAll<HTMLElement>(".etapas-list__figure[data-light]"));
    const nums = Array.from(root.querySelectorAll<HTMLElement>(".join-list .step__num"));
    const elig = q(".elegibilidad");
    const photo = elig?.querySelector<HTMLElement>(".participant");
    const heart = elig?.querySelector<HTMLElement>(".participant__heart");
    if (!heroMedia || !whyTitle || !film || !filmFrame || !azar || !azarHead || !azarStage || !diagram || !azarLight) return;
    if (!figures.length || !nums.length || !elig || !photo || !heart) return;

    const narrow = window.matchMedia("(max-width: 860px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const active = () =>
      narrow.matches && !reduced.matches && !root.hasAttribute("data-still") && whyTitle.offsetParent !== null;

    // What was last written, so a light at rest costs no style work.
    let drawn = "";
    // The trial text never hides again once the light has passed it.
    let lit = 0;
    // The glide to the play button and the hand-over to its halo, both 0 to 1 on the clock.
    let glide = 0;
    let dock = 0;
    let stamp = performance.now();

    const release = () => {
      drawn = "";
      light.style.opacity = "0";
      delete light.dataset.rest;
      delete azar.dataset.journey;
      delete azarStage.dataset.wait;
      delete film.dataset.halo;
      delete elig.dataset.journey;
      elig.style.removeProperty("--jt");
      azarHead.style.removeProperty("--lit");
    };

    /** Every stop, in page coordinates, from the live layout. */
    const stops = (sy: number, vw: number, vh: number): { list: Stop[]; fork: number; meet: number } => {
      const page = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top + sy, width: r.width, height: r.height };
      };
      const md = azarLight.offsetWidth;
      const bow = vw * BOW;
      const list: Stop[] = [];
      /** Arrives when the point is at `from` of the viewport's height and leaves at `to`. */
      const add = (x: number, y: number, d: number, from: number, to: number, extra?: Partial<Stop>) =>
        list.push({ x, y, d, in: y - vh * from, out: y - vh * to, ...extra });

      const h = page(heroMedia);
      // Straight down from the circle; no swing.
      add(h.left + h.width * HERO_SPOT.x, h.top + h.height * HERO_SPOT.y, md, 9, 0.42);
      const w = page(whyTitle);
      add(h.left + h.width * HERO_SPOT.x, w.top - md * 0.42, md, 0.5, 0.2);
      const f = page(filmFrame);
      add(f.left + f.width / 2, f.top + f.height / 2, md, 0.56, 0.3, { bow: -bow });

      const dg = page(diagram);
      const { startTop, endTop } = splitWindow(diagram, vh);
      const fork = list.length;
      const forkAt = dg.top - startTop;
      list.push({ x: dg.left + dg.width / 2, y: dg.top + md / 2, d: md, in: forkAt, out: forkAt, fixed: true });
      const r = narrowReunion(azarStage, vh, md);
      const meet = list.length;
      const meetAt = dg.top - endTop + r.mergeAt;
      list.push({ x: dg.left + dg.width / 2, y: dg.top + r.meetY, d: md, in: meetAt, out: meetAt, fixed: true, bow });

      figures.forEach((fig, i) => {
        const g = page(fig.querySelector("img") ?? fig);
        const [fx, fy] = (fig.dataset.light ?? "50 50").split(" ").map(Number);
        add(g.left + (g.width * fx) / 100, g.top + (g.height * fy) / 100, md * SIZE_STAGE, 0.5, 0.26, {
          // Swing to alternate sides, and out wide on the way to the steps.
          bow: (i % 2 ? 1 : -1) * bow,
        });
      });
      const sm = md * SIZE_STEP;
      nums.forEach((num, i) => {
        const n = page(num);
        add(Math.max(n.left - sm * BESIDE, sm / 2 + 4), n.top + n.height / 2, sm, 0.5, 0.3, {
          bow: i === nums.length - 1 ? bow : 0,
        });
      });
      // Down the middle of the photograph: in at its top, then onto the heart.
      const p = page(photo);
      const c = page(heart);
      const cx = c.left + c.width / 2;
      add(cx, p.top + p.height * 0.1, md * SIZE_PHOTO, 0.34, 0.34);
      add(cx, c.top + c.height / 2, md * SIZE_HEART, 0.4, -9);

      // Keep the order: a stop is never reached before the one above is left.
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        if (b.in >= a.out + MIN_TRAVEL_PX) continue;
        if (b.fixed) {
          a.out = b.in - MIN_TRAVEL_PX;
          a.in = Math.min(a.in, a.out);
        } else {
          b.in = a.out + MIN_TRAVEL_PX;
          b.out = Math.max(b.out, b.in);
        }
      }
      return { list, fork, meet };
    };

    /** Draws one frame; true while something is still moving on the clock. */
    const draw = (): boolean => {
      const now = performance.now();
      const dt = Math.min(now - stamp, 64);
      stamp = now;
      if (!active()) {
        release();
        return false;
      }
      const sy = window.scrollY;
      const vw = window.innerWidth;
      const vh = steadyViewportHeight();
      const { list, fork, meet } = stops(sy, vw, vh);

      // The stop the light is on or has last left.
      let i = 0;
      while (i < list.length - 1 && sy >= list[i + 1].in) i++;
      const a = list[i];
      const b = list[i + 1];
      const resting = !b || sy <= a.out;
      let x = a.x;
      let y = a.y;
      let d = a.d;
      let t = 0;
      if (!resting) {
        t = clamp01((sy - a.out) / (b.in - a.out));
        const e = smooth(t);
        x = a.x + (b.x - a.x) * e + (a.bow ?? 0) * Math.sin(Math.PI * t);
        y = a.y + (b.y - a.y) * (t + (e - t) * Y_EASE);
        d = a.d + (b.d - a.d) * e;
      }
      // The glide: leaving "El porqué" releases the light towards the play
      // button, straight and at its own pace; scrolling back above that point
      // sends it back the same way.
      const why = list[fork - 2];
      const play = list[fork - 1];
      const released = sy > why.out;
      glide = released ? Math.min(1, glide + dt / GLIDE_MS) : Math.max(0, glide - dt / GLIDE_MS);
      const between = sy >= why.in && sy <= play.out;
      if (between) {
        const e = glideEase(glide);
        x = why.x + (play.x - why.x) * e;
        d = why.d + (play.d - why.d) * e;
        // All the way to the button, even when that is below the screen: it
        // does not wait at the edge for the reader to catch up.
        y = why.y + (play.y - why.y) * e;
      }
      x = Math.min(Math.max(x, d / 2 + 2), vw - d / 2 - 2);

      let opacity = 1;
      if (i === 0 && resting) {
        // Appears, growing a little, as the circle comes into view.
        opacity = smooth(clamp01((vh * APPEAR[0] - (y - sy)) / (vh * (APPEAR[0] - APPEAR[1]))));
        d *= 0.55 + 0.45 * opacity;
      }
      // On the play button the halo under it takes over.
      const docked = between && glide >= 1;
      dock = docked ? Math.min(1, dock + dt / DOCK_FADE_MS) : Math.max(0, dock - dt / DOCK_FADE_MS);
      opacity = Math.min(opacity, 1 - dock);
      // Between the fork and the reunion the two lights of the split have it.
      const split = sy >= list[fork].in && sy < list[meet].in;
      if (split) opacity = 0;

      const md = list[fork].d;
      const sm = md * SIZE_STEP;
      const blur = BLUR_SMALL + (BLUR_LARGE - BLUR_SMALL) * clamp01((d - sm) / (md - sm));
      // In the root's own coordinates, so the page carries it while it rests.
      const origin = root.getBoundingClientRect();
      const next = [
        `${d.toFixed(2)}px`,
        // The warm core grows as the light shrinks (landing.css).
        clamp01((md - d) / (md - md * SIZE_STAGE)).toFixed(3),
        `blur(${(d * blur).toFixed(2)}px)`,
        `${(x - origin.left - d / 2).toFixed(1)}px ${(y - sy - origin.top - d / 2).toFixed(1)}px`,
        opacity.toFixed(3),
      ];
      if (next.join("|") !== drawn) {
        drawn = next.join("|");
        light.style.setProperty("--d", next[0]);
        light.style.setProperty("--core", next[1]);
        light.style.filter = next[2];
        light.style.translate = next[3];
        light.style.opacity = next[4];
      }
      if (i === list.length - 1) light.dataset.rest = "heart";
      else delete light.dataset.rest;

      azar.dataset.journey = "narrow";
      // Until the light reaches the fork, the split's own lights wait unseen.
      if (sy < list[fork].in) azarStage.dataset.wait = "";
      else delete azarStage.dataset.wait;
      if (docked) film.dataset.halo = "";
      else delete film.dataset.halo;

      // The trial text appears from the top as the light comes down past it.
      const head = azarHead.getBoundingClientRect();
      const reach = sy >= list[fork].in ? 1 : clamp01((y - sy - d * LIT_TRAIL - head.top) / head.height);
      lit = Math.max(lit, reach);
      azarHead.style.setProperty("--lit", lit.toFixed(4));

      // The photograph's own light stays out; its heart glows as this one arrives.
      const last = list.length - 1;
      elig.dataset.journey = "waiting";
      elig.style.setProperty("--jt", (i === last ? 1 : i === last - 1 && !resting ? t : 0).toFixed(4));

      return glide !== (released ? 1 : 0) || dock !== (docked ? 1 : 0);
    };

    // Drawn on demand, not on every frame: a phone's battery matters more
    // than a loop that mostly finds nothing changed.
    let frame = 0;
    let left = 0;
    const tick = () => {
      // Keep going while the glide or the halo hand-over is under way.
      if (draw()) left = Math.max(left, 2);
      frame = --left > 0 ? window.requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      left = SETTLE_FRAMES;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    narrow.addEventListener("change", kick);
    reduced.addEventListener("change", kick);
    // Layout changes without a scroll: images arriving, a question opening.
    const ro = new ResizeObserver(kick);
    ro.observe(root);
    // "Pausar animación".
    const mo = new MutationObserver(kick);
    mo.observe(root, { attributes: true, attributeFilter: ["data-still"] });
    kick();

    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      narrow.removeEventListener("change", kick);
      reduced.removeEventListener("change", kick);
      ro.disconnect();
      mo.disconnect();
      window.cancelAnimationFrame(frame);
      release();
    };
  }, [rootId]);

  return <Signal ref={lightRef} className="journey-light" size="var(--cl-light-md)" />;
}
