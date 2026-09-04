"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LandingNavLink {
  href: string;
  label: string;
}

/**
 * Floating pill navigation. It gains a solid backdrop once the page scrolls so
 * the links stay legible over the hero wash. Purely presentational: the links
 * are plain anchors and work with JavaScript disabled.
 */
export function LandingNav({
  brand,
  links,
  teamHref,
  teamLabel,
}: {
  brand: string;
  links: LandingNavLink[];
  teamHref: string;
  teamLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6">
      <nav
        aria-label={brand}
        className={cn(
          "pointer-events-auto mx-auto flex h-14 w-full max-w-5xl items-center gap-2 rounded-2xl px-3 transition-all duration-300 sm:px-4",
          scrolled
            ? "border border-border/80 bg-card/85 shadow-soft backdrop-blur-xl"
            : "border border-transparent bg-transparent",
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="size-6 rounded-[7px] bg-primary ring-1 ring-foreground/10"
          />
          {brand}
        </Link>

        <ul className="ml-2 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button render={<Link href={teamHref} />} nativeButton={false} size="sm" className="rounded-lg">
            {teamLabel}
          </Button>
        </div>
      </nav>
    </header>
  );
}
