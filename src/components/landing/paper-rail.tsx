"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * The home page's research as one row that scrolls sideways (D-106). The row
 * is a plain scrolling list, so touch, a trackpad, the keyboard (each card is
 * a link) and the scrollbar all work without this script; the two buttons are
 * for a mouse with no sideways wheel, and move one card at a time.
 */
export function PaperRail({
  heading,
  labels,
  children,
}: {
  /** The section's heading block, laid out beside the buttons. */
  heading: React.ReactNode;
  labels: { previous: string; next: string };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const read = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      setEdge({ start: rail.scrollLeft <= 1, end: rail.scrollLeft >= max - 1 });
    };
    // Fires once on observe, so the buttons start in the right state.
    const observer = new ResizeObserver(read);
    observer.observe(rail);
    rail.addEventListener("scroll", read, { passive: true });
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", read);
    };
  }, []);

  const move = (direction: 1 | -1) => {
    const rail = ref.current;
    const card = rail?.querySelector("li");
    if (!rail || !card) return;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <>
      <div className="home__research-head cl-wrap">
        <header>{heading}</header>
        <div className="home__rail-buttons">
          <button type="button" className="home__rail-button" aria-label={labels.previous} title={labels.previous} disabled={edge.start} onClick={() => move(-1)}>
            <ArrowLeft size={18} aria-hidden />
          </button>
          <button type="button" className="home__rail-button" aria-label={labels.next} title={labels.next} disabled={edge.end} onClick={() => move(1)}>
            <ArrowRight size={18} aria-hidden />
          </button>
        </div>
      </div>
      <ol ref={ref} className="home__rail">
        {children}
      </ol>
    </>
  );
}
