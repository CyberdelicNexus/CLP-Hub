"use client";

import { useState } from "react";

/**
 * Pause control for the continuous movement (breathing lights, fire, closing
 * shimmer): sets `data-still` on the landing root. Required by the design
 * system (docs/02, section 17) and WCAG 2.2.2. Since D-052 it is a small icon
 * button in the footer rather than a text link; its accessible name says what
 * it does.
 */
export function StillToggle({ rootId, labels }: { rootId: string; labels: { pause: string; resume: string } }) {
  const [still, setStill] = useState(false);
  const label = still ? labels.resume : labels.pause;
  return (
    <button
      type="button"
      className="foot__still"
      aria-pressed={still}
      aria-label={label}
      title={label}
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
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        {still ? <path d="M4 2.5v11l9-5.5z" fill="currentColor" /> : <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />}
      </svg>
    </button>
  );
}
