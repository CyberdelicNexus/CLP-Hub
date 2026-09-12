"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Plays the clip of the active stage inside a pinned act and pauses the rest.
 *
 * The engine publishes the act's progress as `--sc-p`; the active stage is
 * simply which seventh of the act the reader is in. Polled at ~6 Hz only while
 * the stage is on screen, which is enough for play/pause and far below the
 * cost of a per-frame observer. Videos are muted loops with `preload="none"`,
 * so nothing downloads until its stage is reached.
 *
 * A `data-still` attribute on the landing root ("Pausar animación") pauses
 * everything.
 */
export function StageMedia({
  children,
  className,
  stageCount,
}: {
  children: ReactNode;
  className: string;
  stageCount: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const act = stage.closest<HTMLElement>("[data-sc-act]");
    const root = stage.closest<HTMLElement>(".cl");
    if (!act) return;
    const videos = Array.from(stage.querySelectorAll<HTMLVideoElement>("video[data-stage-index]"));
    if (videos.length === 0) return;
    for (const v of videos) {
      v.muted = true;
      v.defaultMuted = true;
    }

    let timer = 0;
    const pauseAll = () => {
      for (const v of videos) if (!v.paused) v.pause();
    };
    const update = () => {
      const still = root?.hasAttribute("data-still") ?? false;
      const p = parseFloat(getComputedStyle(act).getPropertyValue("--sc-p")) || 0;
      const active = Math.min(stageCount - 1, Math.floor(p * stageCount));
      for (const v of videos) {
        const shouldPlay = !still && Number(v.dataset.stageIndex) === active;
        if (shouldPlay) {
          if (v.paused) v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!timer) timer = window.setInterval(update, 160);
          update();
        } else {
          if (timer) window.clearInterval(timer);
          timer = 0;
          pauseAll();
        }
      },
      { threshold: 0 },
    );
    io.observe(stage);

    return () => {
      io.disconnect();
      if (timer) window.clearInterval(timer);
      pauseAll();
    };
  }, [stageCount]);

  return (
    <div ref={ref} data-sc-stage className={className}>
      {children}
    </div>
  );
}
