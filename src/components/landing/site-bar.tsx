"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Single-line recruitment navigation. Transparent over the hero, gains a dark
 * translucent ground once the page has scrolled. The scrolled state comes from
 * an IntersectionObserver on a sentinel at the top of the document, not from a
 * scroll listener. The language switch (D-063) sits between the links and the
 * call to action.
 */
export function SiteBar({
  brand,
  links,
  cta,
  language,
}: {
  brand: string;
  links: readonly { href: string; label: string }[];
  cta: { href: string; label: string };
  language: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      rootMargin: "-12px 0px 0px 0px",
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }} />
      <header className={clsx("bar", scrolled && "is-scrolled")}>
        <a href="#inicio" className="bar__brand">
          {brand}
        </a>
        <nav aria-label={brand}>
          <ul className="bar__links">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="bar__link">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {language}
        <a href={cta.href} className="cl-link bar__cta">
          {cta.label}
        </a>
      </header>
    </>
  );
}
