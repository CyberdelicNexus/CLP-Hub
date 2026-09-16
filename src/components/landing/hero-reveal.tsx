"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The hero's feathered human reveal.
 *
 * Two registered layers (luminous over physical) are rendered by the server;
 * this component drives the CSS custom properties that position and size the
 * feathered mask on the physical layer and its haze copy (landing.css,
 * `.hero__layer--physical`). The mask is a radial gradient: there is no edge,
 * lens or clip to draw.
 *
 * - Fine pointer: the window follows the pointer with interpolation. Scroll
 *   never writes here; a standalone rAF loop walks toward the target and stops
 *   when it arrives.
 * - Touch: press-and-hold opens the window at the touch point; lifting or
 *   scrolling closes it (pointercancel fires when a scroll begins).
 * - Coalescence gate: once the media frame is less than ~65% visible the
 *   reveal closes and stays closed, so the bodies gather without a photograph
 *   underneath them. The frame, not the section: on a phone the frame sits
 *   below the copy and is fully in view while the section is mostly above.
 *
 * There is no explicit toggle (D-054, founder request): keyboard-only and
 * reduced-motion visitors do not see the physical layer at all, only the
 * light bodies. That is a real gap against the original brief's "touch or an
 * explicit button" / "reduced motion: toggle only" requirement, kept because
 * the founder asked for the control removed rather than relocated.
 */
export function HeroReveal({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let enabled = true;
    let raf = 0;
    const target = { x: 0, y: 0, d: 0 };
    const cur = { x: 0, y: 0, d: 0 };

    // Generous: a torso, the headset and both controllers of at least one
    // person, usually two. Capped so a wide monitor does not reveal the room.
    const diameter = () => Math.min(el.clientWidth * 0.55, 780);

    const paint = () => {
      el.style.setProperty("--reveal-x", `${cur.x.toFixed(1)}px`);
      el.style.setProperty("--reveal-y", `${cur.y.toFixed(1)}px`);
      el.style.setProperty("--reveal-d", `${cur.d.toFixed(1)}px`);
    };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.16;
      cur.y += (target.y - cur.y) * 0.16;
      cur.d += (target.d - cur.d) * 0.11;
      const settled =
        Math.abs(target.x - cur.x) < 0.3 && Math.abs(target.y - cur.y) < 0.3 && Math.abs(target.d - cur.d) < 0.5;
      if (settled) {
        cur.x = target.x;
        cur.y = target.y;
        cur.d = target.d;
        paint();
        raf = 0;
        return;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const open = (e: PointerEvent) => {
      if (!enabled) return;
      const r = el.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      if (cur.d < 1) {
        // A closed window opens where the pointer is, not where it last was.
        cur.x = target.x;
        cur.y = target.y;
      }
      target.d = diameter();
      kick();
    };
    const close = () => {
      target.d = 0;
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      open(e);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      open(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") close();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", close, { passive: true });
    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", close, { passive: true });

    const io = new IntersectionObserver(
      ([entry]) => {
        enabled = entry.intersectionRatio > 0.65;
        if (!enabled) close();
      },
      { threshold: [0.5, 0.65, 0.8] },
    );
    io.observe(el);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", close);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", close);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={box} className="hero__media">
      {children}
    </div>
  );
}
