"use client";

import { useState } from "react";

/**
 * "Pausar animación": stops the breathing lights, the fire and the stage
 * clips by setting `data-still` on the landing root. Required by the design
 * system for any continuous movement (docs/02, section 17).
 */
export function StillToggle({ rootId, labels }: { rootId: string; labels: { pause: string; resume: string } }) {
  const [still, setStill] = useState(false);
  return (
    <button
      type="button"
      className="foot__still"
      aria-pressed={still}
      onClick={() => {
        const root = document.getElementById(rootId);
        const next = !still;
        if (root) {
          if (next) root.setAttribute("data-still", "");
          else root.removeAttribute("data-still");
        }
        setStill(next);
      }}
    >
      {still ? labels.resume : labels.pause}
    </button>
  );
}
