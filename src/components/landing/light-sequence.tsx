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
 * How long a rest is held before the next one may start. The scroll lock now
 * does the anti-skip work this number used to do alone (D-061), so it is the
 * length of the pause the reader gets on each rest rather than a guard.
 */
const DWELL_MS = 1600;
const DIP_MS = 320;
const EPS = 0.03;
/**
 * Scroll lock (D-061). While the clip plays toward the next rest, scrolling
 * DOWN is held so the sequence cannot be skipped; it releases DWELL_MS after
 * the clip arrives, by which time the copy's 1300ms wipe has finished. Scroll
 * up, Escape, moving focus, leaving the stage or "Pausar animación" all
 * release it at once, and it can never outlast LOCK_MAX_MS whatever happens
 * to the clip.
 */
const LOCK_MAX_MS = 9000;
const DOWN_KEYS = new Set(["ArrowDown", "PageDown", "End", " ", "Spacebar"]);
const UP_KEYS = new Set(["ArrowUp", "PageUp", "Home", "Escape"]);

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

      // --- scroll lock ---------------------------------------------------
      let locked = false;
      let lockY = 0;
      let lockUntil = 0;
      let hardUntil = 0;
      let touchY = 0;

      const onWheel = (e: WheelEvent) => {
        if (e.deltaY > 0) e.preventDefault();
        else if (e.deltaY < 0) release();
      };
      const onTouchStart = (e: TouchEvent) => {
        touchY = e.touches[0]?.clientY ?? 0;
      };
      const onTouchMove = (e: TouchEvent) => {
        const y = e.touches[0]?.clientY ?? 0;
        if (touchY - y > 0) e.preventDefault();
        else release();
      };
      const onKey = (e: KeyboardEvent) => {
        if (UP_KEYS.has(e.key)) return release();
        // Shift+Space pages up, so it is an exit too.
        if (DOWN_KEYS.has(e.key) && !e.shiftKey) e.preventDefault();
        else release();
      };
      const onScroll = () => {
        if (window.scrollY > lockY) window.scrollTo({ top: lockY, behavior: "instant" });
      };
      // Never trap a keyboard reader: reaching any control lets the page go.
      const onFocusIn = () => release();

      const release = () => {
        if (!locked) return;
        locked = false;
        delete stage.dataset.locked;
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("focusin", onFocusIn);
      };

      const engage = () => {
        const still = root?.hasAttribute("data-still") ?? false;
        if (locked || still || !mq.matches) return;
        locked = true;
        lockY = window.scrollY;
        hardUntil = performance.now() + LOCK_MAX_MS;
        lockUntil = hardUntil;
        stage.dataset.locked = "";
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
        // A jump is a cut, not the played sequence: going back, an anchor, or
        // leaving. Nothing to hold the reader for.
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
        if (locked && (now >= lockUntil || leaving || still)) release();
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
          const rest = REST[heading];
          video.pause();
          video.currentTime = rest;
          heading = null;
          arrivedAt = now;
          paint(rest);
          // Hold until the copy has wiped in and the next rest may start, so
          // the scroll that follows begins the next event instead of falling
          // into the dwell.
          if (locked) lockUntil = Math.min(hardUntil, now + DWELL_MS);
          return;
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
              // Downward, played, skippable: this is the one case the lock is for.
              engage();
              video.playbackRate = target > next ? 1.25 : 1;
              video.play().catch(() => {
                heading = null;
                release();
              });
            }
          }
        } else if (!video.paused) {
          video.pause();
          video.currentTime = goal;
          heading = null;
          arrivedAt = now;
        }
        paint(t);
      };

      const onClick = (e: MouseEvent) => {
        const link = (e.target as Element | null)?.closest?.("a[href^='#']");
        if (!(link instanceof HTMLAnchorElement)) return;
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
