"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SELECTOR = "details[data-popover][open]";

/**
 * Makes every `<details data-popover>` behave like a dropdown (2026-11-10:
 * "filters need to close after selecting one option or clicking outside").
 * A `<details>` filter is a server-rendered list of links, so it works without
 * JavaScript; with it, this closes the open one when:
 *
 *   - an option (a link inside it) is chosen: a soft navigation keeps the same
 *     element, so without this it would stay open over the new results;
 *   - the pointer goes down anywhere outside it;
 *   - Escape is pressed (focus returns to its summary);
 *   - the route changes some other way.
 *
 * Mounted once in the team shell. Plain `<details>` (collapsible sections) are
 * untouched: the behaviour is opt-in through `data-popover`.
 */
export function PopoverDetails() {
  const pathname = usePathname();

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>(SELECTOR).forEach((d) => (d.open = false));
  }, [pathname]);

  useEffect(() => {
    const closeAllExcept = (keep: Element | null) => {
      document.querySelectorAll<HTMLDetailsElement>(SELECTOR).forEach((d) => {
        if (d !== keep) d.open = false;
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      const inside = (e.target as Element | null)?.closest?.("details[data-popover]") ?? null;
      closeAllExcept(inside);
    };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const details = link?.closest<HTMLDetailsElement>("details[data-popover]");
      if (details) details.open = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const open = document.querySelector<HTMLDetailsElement>(SELECTOR);
      if (!open) return;
      open.open = false;
      open.querySelector<HTMLElement>("summary")?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
