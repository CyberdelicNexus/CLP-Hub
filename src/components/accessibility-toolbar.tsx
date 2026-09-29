"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, RotateCcw, Type } from "lucide-react";
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
 * Floating accessibility controls for the public study pages (2026-09-19
 * request; muted-colour and text-spacing controls removed 2026-09-29 —
 * text size is the one the founder wanted kept) — this audience skews older
 * adult (see the `text-lg` note on both public page templates), so a
 * three-step text-size control is the tool that reader actually benefits
 * from. Preference is per-browser (localStorage), the same "viewport
 * preference, not data" reasoning as the sidebar's collapsed state —
 * nothing here is participant data.
 */
export function AccessibilityToolbar() {
  const t = useTranslations("public.a11y");
  const prefs = useA11yPrefs();
  const isDefault = prefs.text === "md";

  function cycleText() {
    const i = TEXT_STEPS.indexOf(prefs.text);
    setPrefs({ ...prefs, text: TEXT_STEPS[Math.min(i + 1, TEXT_STEPS.length - 1)] });
  }
  function shrinkText() {
    const i = TEXT_STEPS.indexOf(prefs.text);
    setPrefs({ ...prefs, text: TEXT_STEPS[Math.max(i - 1, 0)] });
  }

  return (
    <div
      className="glass-panel fixed top-1/2 right-3 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl p-1.5 sm:right-4"
      role="group"
      aria-label={t("label")}
    >
      <ToolButton
        onClick={cycleText}
        disabled={prefs.text === "xl"}
        active={prefs.text !== "md"}
        label={t("increaseText")}
        icon={<Plus className="size-4" aria-hidden />}
      />
      <span aria-hidden className="flex size-8 items-center justify-center text-muted-foreground">
        <Type className="size-4" />
      </span>
      <ToolButton
        onClick={shrinkText}
        disabled={prefs.text === "md"}
        active={false}
        label={t("decreaseText")}
        icon={<Minus className="size-4" aria-hidden />}
      />

      {isDefault ? null : (
        <>
          <div aria-hidden className="my-0.5 h-px w-6 bg-border" />
          <ToolButton
            onClick={() => setPrefs(DEFAULT_PREFS)}
            active={false}
            label={t("reset")}
            icon={<RotateCcw className="size-4" aria-hidden />}
          />
        </>
      )}
    </div>
  );
}

/**
 * Applies the current text-size preference to whatever it
 * wraps. Split out from `AccessibilityToolbar` itself so the server
 * component layout can wrap just the readable content in it while the
 * toolbar floats separately — both read the same store, so a change in one
 * is reflected in the other without any prop plumbing between them.
 */
export function A11yContentWrapper({ children }: { children: React.ReactNode }) {
  const prefs = useA11yPrefs();
  return <div className={a11yContentClassName(prefs)}>{children}</div>;
}

function ToolButton({
  onClick,
  active,
  disabled,
  label,
  icon,
}: {
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
