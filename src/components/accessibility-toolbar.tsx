"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "clp-a11y-prefs";
const TEXT_STEPS = ["md", "lg", "xl"] as const;
type TextStep = (typeof TEXT_STEPS)[number];

interface A11yPrefs {
  text: TextStep;
}

const DEFAULT_PREFS: A11yPrefs = { text: "md" };

function isA11yPrefs(value: unknown): value is A11yPrefs {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.text === "string" && (TEXT_STEPS as readonly string[]).includes(v.text);
}

/**
 * Same module-level localStorage store as `sidebar-shell.tsx`'s collapsed
 * flag: read via `useSyncExternalStore` rather than set from a mount effect,
 * so the server snapshot (always the defaults) never mismatches what the
 * client paints before hydration corrects it.
 */
let cached: A11yPrefs | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): A11yPrefs {
  if (cached === null) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      // The `as A11yPrefs` cast (not just letting the ternary's `any` branch
      // flow through) matters here: TS only narrows `cached` to non-null
      // after this block when the assigned expression has a concrete type —
      // assigning `any` re-widens it back to the declared `A11yPrefs | null`.
      cached = (isA11yPrefs(parsed) ? parsed : DEFAULT_PREFS) as A11yPrefs;
    } catch {
      cached = DEFAULT_PREFS;
    }
  }
  return cached;
}
function getServerSnapshot(): A11yPrefs {
  return DEFAULT_PREFS;
}
function setPrefs(next: A11yPrefs) {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing or a full quota — the setting just won't persist
    // across visits, which is a fine degradation for a display preference.
  }
  listeners.forEach((l) => l());
}

export function useA11yPrefs(): A11yPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const TEXT_SCALE: Record<TextStep, string> = { md: "", lg: "text-[1.0625em]", xl: "text-[1.1875em]" };

/** Applied by the caller to whatever element wraps the page's readable
 * content — never global, so this can never bleed into the staff app. */
export function a11yContentClassName(prefs: A11yPrefs): string {
  return cn(TEXT_SCALE[prefs.text]);
}

/**
 * Text-size control for the public study pages. Originally a floating
 * vertical panel pinned to the right edge (2026-09-19); moved into the
 * header's own nav bar as a single compact dropdown, same trigger pattern as
 * the adjacent `ThemeToggle` (2026-09-29 request — on a phone the floating
 * panel sat right next to the reading column, cramped and easy to mistake
 * for part of the article). A direct 3-way size picker also gets a reader to
 * "muy grande" in one tap instead of several presses of "+".
 */
export function AccessibilityToolbar({ className }: { className?: string }) {
  const t = useTranslations("public.a11y");
  const prefs = useA11yPrefs();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className={className} aria-label={t("label")} />}
      >
        <Type aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={prefs.text}
          onValueChange={(value) => setPrefs({ text: value as TextStep })}
        >
          {TEXT_STEPS.map((step) => (
            <DropdownMenuRadioItem key={step} value={step}>
              {t(`textStep.${step}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Applies the current text-size preference to whatever it wraps. Split out
 * from `AccessibilityToolbar` itself so the server component layout can wrap
 * just the readable content in it while the toolbar lives in the header —
 * both read the same store, so a change in one is reflected in the other
 * without any prop plumbing between them.
 */
export function A11yContentWrapper({ children }: { children: React.ReactNode }) {
  const prefs = useA11yPrefs();
  return <div className={a11yContentClassName(prefs)}>{children}</div>;
}
