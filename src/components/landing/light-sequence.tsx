"use client";

import { useEffect, useRef } from "react";

/**
 * The opening sequence's clip and its controller.
 *
 * Scroll does not scrub the clip. The act's progress picks a destination (the
 * hero, "El porqué" or "El qué") and the clip PLAYS, at its own rate, to that
 * destination's rest frame. Each rest is a frame where the light is still:
 *
 *   0      seven bodies, identical to the hero still
 *   5.25s  one light, sunk to the bottom
 *   7.92s  one light, risen to the top
 *
 * The stage's `data-state` follows the playhead, so the copy appears when the
 * light arrives rather than when the wheel does. Moving forward always stops
 * at the next rest and dwells there before continuing, so a reader who keeps
 * scrolling still gets "El porqué". Going back, or navigating to an anchor,
 * does not rewind: it dips to dark and cuts to the destination's rest.
 *
 * Only runs while the pinned stage is the variant showing (same media query as
 * `.cl-pinned`); otherwise the stacked flow sections are the page and nothing
 * here requests the clip.
 */
const PINNED = "(min-width: 861px) and (prefers-reduced-motion: no-preference) and (scripting: enabled)";
const NAMES = ["inicio", "porque", "que"] as const;
const REST = [0, 126 / 24, 190 / 24];
/** Act progress at which the destination becomes "El porqué", then "El qué". */
const ENTER = [0.02, 0.4];
const HERO_OUT = 1.5;
const WHY_IN = 4.85;
const WHY_OUT = 5.4;
const WHAT_IN = 7.05;
/**
 * The threshold hold (D-062, replacing D-061's scroll lock).
 *
 * D-061 froze scroll from the moment a transition began, so the scroll that
 * started the clip was followed by seconds of dead input, which visitors read
 * as the site failing to render. Now scroll stays free while the clip plays.
 * The hold is a wall at the scroll position where the NEXT sequence would
 * begin (`ENTER[1]` for "El qué", the end of the pin for the rest of the
 * page), and it only stands while the current transition is still in flight
 * or its copy is still wiping in. A reader who never reaches the wall never
 * feels it.
 *
 * Two refinements keep the wall from reading as lag:
 * - Pushing against it is not ignored: while the reader pushes, the clip
 *   plays faster (up to PUSH_RATE) and eases back when they stop.
 * - It lifts exactly when the next scroll can start the next transition:
 *   DWELL_MS is both the hold after arrival and the gate on the next play, so
 *   the push that follows the release begins the next event at once.
 *
 * Every exit stays open: scrolling up is never held, Escape, focus leaving the
 * stage, any in-page link, a jump larger than half a viewport (navigation,
 * find in page, the scrollbar), "Pausar animación", leaving the stage, and
 * HOLD_SAFETY_MS whatever the clip does. The wall's listeners exist only while
 * it stands, so the rest of the page scrolls without waiting on script.
 */
/** Hold after a rest is reached, and the gate before the next transition. */
const DWELL_MS = 1100;
/** Clip rate while the reader pushes against the wall. 1 turns it off. */
const PUSH_RATE = 2;
const PUSH_WINDOW_MS = 300;
const RATE_STEP = 0.1;
const HOLD_SAFETY_MS = 6000;
const DIP_MS = 320;
const EPS = 0.03;

type Name = (typeof NAMES)[number];

function stateAt(t: number): string {
  if (t < HERO_OUT) return "inicio";
  if (t < WHY_IN) return "bajada";
  if (t < WHY_OUT) return "porque";
  if (t < WHAT_IN) return "subida";
  return "que";
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function LightSequence({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const stage = video?.closest<HTMLElement>("[data-sc-stage]");
    const act = video?.closest<HTMLElement>("[data-sc-act]");
    const opening = video?.closest<HTMLElement>("[data-opening]");
    if (!video || !stage || !act || !opening) return;

    const mq = window.matchMedia(PINNED);
    let stop: (() => void) | null = null;

    // Exactly one element carries each id: the stacked section in the server
    // markup (so no-JS and mobile anchors work), the pinned track anchor while
    // the pinned stage is showing.
    const setAnchors = (pinned: boolean) => {
      for (const name of NAMES) {
        const stacked = opening.querySelector(`[data-anchor-stacked="${name}"]`);
        const pin = opening.querySelector(`[data-anchor-pinned="${name}"]`);
        if (!stacked || !pin) continue;
        if (pinned) {
          stacked.removeAttribute("id");
          pin.id = name;
        } else {
          pin.removeAttribute("id");
          stacked.id = name;
        }
      }
    };

    const start = () => {
      const root = stage.closest<HTMLElement>(".cl");
      const anchor = (k: number) => act.querySelector<HTMLElement>(`[data-anchor-pinned="${NAMES[k]}"]`);
      let raf = 0;
      let busy = false;
      let snap = true;
      let heading: number | null = null;
      let arrivedAt = performance.now();
      let pending: number | null = null;
      let forced: { k: number; until: number } | null = null;

      // --- threshold hold ----------------------------------------------
      let wall: { k: number; until: number; safety: number } | null = null;
      let lastPush = -Infinity;
      let baseRate = 1;
      let touchY = 0;

      /** Scroll position where the transition after rest k would begin. */
      const wallY = (k: number) => {
        const top = act.getBoundingClientRect().top + window.scrollY;
        const travel = Math.max(act.offsetHeight - window.innerHeight, 1);
        return top + travel * (k === 1 ? ENTER[1] - 0.005 : 1);
      };

      const hold = (y: number) => {
        lastPush = performance.now();
        if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" });
      };

      const onWheel = (e: WheelEvent) => {
        if (!wall || e.deltaY <= 0 || e.ctrlKey) return;
        const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
        const y = wallY(wall.k);
        if (window.scrollY + px < y) return;
        e.preventDefault();
        hold(y);
      };
      const onTouchStart = (e: TouchEvent) => {
        touchY = e.touches[0]?.clientY ?? 0;
      };
      const onTouchMove = (e: TouchEvent) => {
        const at = e.touches[0]?.clientY ?? touchY;
        const down = touchY - at;
        touchY = at;
        if (!wall || down <= 0) return;
        const y = wallY(wall.k);
        if (window.scrollY + down < y) return;
        if (e.cancelable) e.preventDefault();
        hold(y);
      };
      const onKey = (e: KeyboardEvent) => {
        if (!wall) return;
        if (e.key === "Escape") return release();
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        const el = e.target as Element | null;
        if (el?.closest?.("input, textarea, select, button, [contenteditable]")) return;
        const step =
          e.key === "ArrowDown"
            ? 40
            : e.key === "PageDown" || ((e.key === " " || e.key === "Spacebar") && !e.shiftKey)
              ? window.innerHeight * 0.875
              : e.key === "End"
                ? Infinity
                : 0;
        if (!step) return;
        const y = wallY(wall.k);
        if (window.scrollY + step < y) return;
        e.preventDefault();
        hold(y);
      };
      const onScroll = () => {
        if (!wall) return;
        const y = wallY(wall.k);
        const over = window.scrollY - y;
        if (over <= 1) return;
        // Momentum and smooth scrolling overshoot a little and are held. A jump
        // this large in one step is navigation, never a gesture: let it go.
        if (over > window.innerHeight * 0.5) return release();
        hold(y);
      };
      const onFocusIn = (e: FocusEvent) => {
        if (!stage.contains(e.target as Node)) release();
      };

      const release = () => {
        if (!wall) return;
        wall = null;
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("focusin", onFocusIn);
      };

      const arm = (k: number) => {
        const still = root?.hasAttribute("data-still") ?? false;
        if (wall || k < 1 || still || !mq.matches) return;
        // A reader already past the wall (a flick that beat the first frame, an
        // anchor) is never pulled back to it.
        if (window.scrollY > wallY(k) + 1) return;
        wall = { k, until: Infinity, safety: performance.now() + HOLD_SAFETY_MS };
        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("focusin", onFocusIn);
      };

      const initial = NAMES.indexOf(window.location.hash.slice(1) as Name);
      if (initial > 0) {
        anchor(initial)?.scrollIntoView({ behavior: "instant" });
        forced = { k: initial, until: performance.now() + 1500 };
      }

      video.muted = true;
      video.preload = "auto";
      if (video.readyState === 0) video.load();

      const paint = (t: number) => {
        stage.dataset.state = stateAt(t);
        stage.toggleAttribute("data-moved", t > 0.04);
      };

      const seek = (t: number) =>
        new Promise<void>((resolve) => {
          if (Math.abs(video.currentTime - t) < 0.001) return resolve();
          const done = () => {
            window.clearTimeout(timer);
            video.removeEventListener("seeked", done);
            resolve();
          };
          const timer = window.setTimeout(done, 600);
          video.addEventListener("seeked", done);
          video.currentTime = t;
        });

      const jump = async (k: number, dip: boolean) => {
        busy = true;
        heading = null;
        // A jump is a cut (going back, an anchor, leaving): nothing to hold.
        release();
        video.pause();
        if (dip) {
          stage.setAttribute("data-dip", "");
          stage.dataset.state = "transito";
          await wait(DIP_MS);
        }
        await seek(REST[k]);
        arrivedAt = performance.now();
        paint(REST[k]);
        stage.removeAttribute("data-dip");
        busy = false;
      };

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (busy) return;
        const now = performance.now();
        const p = parseFloat(act.style.getPropertyValue("--sc-p")) || 0;
        const leaving = stage.getBoundingClientRect().top < -2;
        const still = root?.hasAttribute("data-still") ?? false;
        if (wall && (now >= wall.until || now >= wall.safety || leaving || still)) release();
        let target = leaving ? 2 : p < ENTER[0] ? 0 : p < ENTER[1] ? 1 : 2;
        if (forced) {
          if (now < forced.until) target = forced.k;
          else forced = null;
        }

        if (video.readyState < 2) {
          stage.dataset.state = stateAt(REST[target]);
          stage.toggleAttribute("data-moved", target > 0);
          return;
        }

        const t = video.currentTime;
        if (snap) {
          snap = false;
          void jump(target, false);
          return;
        }
        if (pending !== null) {
          const k = pending;
          pending = null;
          forced = { k, until: now + 1500 };
          if (Math.abs(t - REST[k]) > EPS) void jump(k, true);
          return;
        }

        // Playing toward a rest: stop on its frame.
        if (heading !== null && !video.paused && t >= REST[heading] - 1 / 48) {
          const k = heading;
          video.pause();
          video.currentTime = REST[k];
          heading = null;
          arrivedAt = now;
          paint(REST[k]);
          // The wall stands while the copy wipes in, then lifts exactly when
          // the next transition may start.
          if (wall?.k === k) wall.until = now + DWELL_MS;
          return;
        }

        // Pushing against the wall plays the clip faster; letting go eases back.
        if (heading !== null && !video.paused) {
          const want = now - lastPush < PUSH_WINDOW_MS ? PUSH_RATE : baseRate;
          const rate = video.playbackRate;
          if (Math.abs(want - rate) > 0.01) {
            video.playbackRate = rate + Math.sign(want - rate) * Math.min(Math.abs(want - rate), RATE_STEP);
          }
        }

        const goal = REST[target];
        if (goal < t - EPS) {
          void jump(target, true);
          return;
        }
        if (goal > t + EPS) {
          const next = REST.findIndex((r) => r > t + EPS);
          if (still || leaving) {
            void jump(still ? next : 2, true);
            return;
          }
          if (video.paused) {
            const resting = t > EPS && REST.some((r) => Math.abs(r - t) <= EPS);
            if (!resting || now - arrivedAt >= DWELL_MS) {
              heading = next;
              baseRate = target > next ? 1.25 : 1;
              video.playbackRate = baseRate;
              arm(next);
              video.play().catch(() => {
                heading = null;
                release();
              });
            }
          }
        } else if (!video.paused) {
          // The other way to reach a rest: within EPS of it but short of the
          // frame check above, which a fast rate makes common. It must start
          // the wall's release too, or the hold stands until HOLD_SAFETY_MS.
          video.pause();
          video.currentTime = goal;
          heading = null;
          arrivedAt = now;
          if (wall?.k === target) wall.until = now + DWELL_MS;
        }
        paint(t);
      };

      const onClick = (e: MouseEvent) => {
        const link = (e.target as Element | null)?.closest?.("a[href^='#']");
        if (!(link instanceof HTMLAnchorElement)) return;
        release();
        const k = NAMES.indexOf(link.hash.slice(1) as Name);
        if (k >= 0) pending = k;
      };

      // A keyboard user reaching a control in a panel that is not showing is
      // taken to that panel's state, so focus never sits on an invisible control.
      const onFocus = (e: FocusEvent) => {
        const el = e.target as Element;
        const panel = el.closest<HTMLElement>("[data-panel]");
        const k = panel ? NAMES.indexOf(panel.dataset.panel as Name) : -1;
        if (k < 0 || stage.dataset.state === NAMES[k]) return;
        const a = anchor(k);
        if (!a) return;
        pending = k;
        release();
        window.scrollTo({ top: a.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
      };

      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!raf) raf = requestAnimationFrame(tick);
          } else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            video.pause();
            heading = null;
            release();
            // Wherever the reader comes back from, show that state without replaying.
            snap = true;
          }
        },
        { threshold: 0 },
      );
      io.observe(stage);
      document.addEventListener("click", onClick);
      stage.addEventListener("focusin", onFocus);

      return () => {
        io.disconnect();
        if (raf) cancelAnimationFrame(raf);
        document.removeEventListener("click", onClick);
        stage.removeEventListener("focusin", onFocus);
        release();
        video.pause();
      };
    };

    const sync = () => {
      stop?.();
      stop = null;
      const on = mq.matches && !opening.hasAttribute("data-fallback");
      setAnchors(on);
      if (on) stop = start();
    };

    // A clip that cannot load must not leave an empty pinned stage: fall back
    // to the stacked sections and let the engine measure the page again.
    const onError = () => {
      opening.setAttribute("data-fallback", "");
      sync();
      window.dispatchEvent(new Event("resize"));
    };

    video.addEventListener("error", onError);
    mq.addEventListener("change", sync);
    sync();

    return () => {
      video.removeEventListener("error", onError);
      mq.removeEventListener("change", sync);
      stop?.();
      setAnchors(false);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="op__video"
      src={src}
      muted
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
    />
  );
}
