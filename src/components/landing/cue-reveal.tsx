"use client";

import { useEffect, useRef } from "react";

/**
 * Starts a pinned panel's entrance once the stage has landed (D-123). The
 * scroll engine writes each cue panel's `opacity` as the page scrolls but
 * announces nothing, so this watches that inline style: when the panel is
 * clearly showing (the pin has begun and it has faded in) it marks the panel
 * `data-reveal="go"`, and CSS plays the entrance; when the panel is back to
 * nothing (scrolled up past the start) it marks it `"wait"` again, so the
 * entrance plays each time the section lands.
 *
 * It does nothing until the engine has written an opacity, so with the
 * engine missing, or reduced motion, the text simply stays visible.
 */
const SHOW = 0.6;
const RESET = 0.02;

export function CueReveal() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const panel = ref.current?.closest<HTMLElement>("[data-sc-cue]");
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const check = () => {
      const raw = panel.style.opacity;
      if (raw === "") return;
      const opacity = parseFloat(raw);
      const state = panel.dataset.reveal;
      if (opacity >= SHOW) {
        if (state !== "go") panel.dataset.reveal = "go";
      } else if (state !== "go" || opacity <= RESET) {
        panel.dataset.reveal = "wait";
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(panel, { attributes: true, attributeFilter: ["style"] });
    check();
    return () => {
      observer.disconnect();
      delete panel.dataset.reveal;
    };
  }, []);

  return <span ref={ref} hidden />;
}
