"use client";

import { useEffect, useRef } from "react";

/**
 * A quiet starfield behind the whole page (D-078), offered in place of the
 * travelling reading light the team asked removed: stars twinkle in place and
 * drift a few pixels with the pointer, like depth rather than a scrubbed
 * animation. Canvas, not DOM nodes, since there can be a few hundred of them
 * and only pixels change frame to frame.
 *
 * Respects the same two motion switches as the rest of the page:
 * - `prefers-reduced-motion`: stars are placed once and never move or twinkle.
 * - "Pausar animación" (`data-still` on the landing root, still-toggle.tsx):
 *   checked every frame rather than via a listener, since a plain attribute
 *   read is cheaper than wiring a MutationObserver for something read 60
 *   times a second anyway.
 */
const DENSITY = 1 / 9000;
const MAX_STARS = 220;
const PARALLAX = 14;

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  phase: number;
  speed: number;
}

export function StarField({ rootId }: { rootId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.getElementById(rootId);

    let stars: Star[] = [];
    let dpr = 1;
    let w = 0;
    let h = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;

    const seed = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const count = Math.min(MAX_STARS, Math.round(w * h * DENSITY));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.3,
        base: Math.random() * 0.5 + 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.25,
      }));
    };

    const paint = (t: number, still: boolean) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!still) {
        pointerX += (targetX - pointerX) * 0.04;
        pointerY += (targetY - pointerY) * 0.04;
      }
      ctx.fillStyle = "#f2f5ef";
      for (const s of stars) {
        const twinkle = still ? s.base : s.base + Math.sin(t * 0.001 * s.speed + s.phase) * 0.28;
        ctx.globalAlpha = Math.max(0, Math.min(1, twinkle));
        ctx.beginPath();
        ctx.arc(s.x + pointerX * (s.r / 1.4), s.y + pointerY * (s.r / 1.4), s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    seed();

    if (reduced) {
      paint(0, true);
      const onResize = () => {
        seed();
        paint(0, true);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    let raf = 0;
    const onPointerMove = (e: PointerEvent) => {
      targetX = ((e.clientX / w) * 2 - 1) * PARALLAX;
      targetY = ((e.clientY / h) * 2 - 1) * PARALLAX;
    };
    const onResize = () => seed();
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      paint(t, root?.hasAttribute("data-still") ?? false);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [rootId]);

  return <canvas ref={ref} className="star-field" aria-hidden />;
}
