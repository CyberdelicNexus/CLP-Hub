"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fades in a page's content on navigation (2026-09-29 request).
 *
 * The browser's View Transitions API, via React's <ViewTransition>
 * component, would be the native Next 16 App Router way to do this (works
 * with no configuration) — but that component only exists on a React canary
 * build, and this app pins a stable React 19 with no `ViewTransition` export
 * (verified against the installed package, not assumed). Swapping the whole
 * app onto a canary React for one fade effect is a much bigger, riskier
 * change than this warrants, so this is the classic `usePathname` +
 * CSS-opacity approach instead.
 *
 * On a real route change — not an in-page anchor, not a search-param-only
 * update like `?cohorte=<id>`; `usePathname()` ignores both — this briefly
 * adds `.page-fade--out`, then removes it on the next animation frame so the
 * CSS transition in globals.css carries the fade in. The `previous` ref is
 * what stops that from also firing on first render: without it, every cold
 * load would flash invisible before fading in, not just navigations.
 *
 * Deliberately placed at each app's own content slot (TeamShell's `<main>`,
 * /estudio's layout, the public route group) rather than the root layout, so
 * persistent chrome — the staff sidebar and header, /estudio's back-link bar
 * — never re-fades on every click; only the content that actually changed
 * does.
 */
export function PageFade({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    setFadingOut(true);
    const frame = requestAnimationFrame(() => setFadingOut(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return <div className={cn("page-fade", fadingOut && "page-fade--out", className)}>{children}</div>;
}
