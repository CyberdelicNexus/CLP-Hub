"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its children once they scroll into view.
 *
 * The hidden state lives in the `.reveal` utility in globals.css, which is
 * scoped to `@media (scripting: enabled)` — with JavaScript off the content is
 * simply visible — and neutralised under `prefers-reduced-motion`. State is only
 * ever set from the observer callback, which is the intended way to subscribe to
 * an external system from an effect.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Stagger in milliseconds. Keep under ~240ms so nothing feels sluggish. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Fires once immediately per observed element, so anything already on
    // screen at mount reveals without waiting for a scroll.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
