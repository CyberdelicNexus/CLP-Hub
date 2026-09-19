"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "clp-sidebar-collapsed";

/**
 * Collapsed state, read by `SidebarNav` inside. A function can't cross the
 * server/client boundary as a prop (children built by the server component
 * shell.tsx must stay plain JSX), so the collapsed flag is threaded through
 * context instead of a render-prop.
 */
const SidebarCollapsedContext = createContext(false);
export function useSidebarCollapsed(): boolean {
  return useContext(SidebarCollapsedContext);
}

/** Never-changing store: the server snapshot is false, the client snapshot true. */
const noopSubscribe = () => () => {};

/**
 * Tiny external store over localStorage, read via useSyncExternalStore rather
 * than set from a mount effect — the same hydration-boundary pattern
 * ThemeToggle uses (docs/design-system.md, "Theming"), so this never trips
 * react-hooks/set-state-in-effect and never mismatches during hydration: the
 * server snapshot is always "expanded", and the client corrects it after
 * mount the same sanctioned way the theme does.
 */
let cachedCollapsed: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): boolean {
  if (cachedCollapsed === null) {
    cachedCollapsed = window.localStorage.getItem(STORAGE_KEY) === "1";
  }
  return cachedCollapsed;
}
function getServerSnapshot(): boolean {
  return false;
}
function setStoredCollapsed(next: boolean) {
  cachedCollapsed = next;
  window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  listeners.forEach((l) => l());
}

/**
 * Desktop sidebar frame: glass chrome over the aurora wash, and a collapse
 * toggle that leaves only the icon rail. Collapsed state is per-browser
 * (localStorage), not per-account — it is a viewport preference, not data.
 */
export function SidebarShell({
  appName,
  collapseLabel,
  expandLabel,
  children,
}: {
  appName: string;
  collapseLabel: string;
  expandLabel: string;
  children: React.ReactNode;
}) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function toggle() {
    setStoredCollapsed(!collapsed);
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 p-3 transition-[width] duration-300 ease-[var(--ease-out-soft)] lg:block",
        collapsed ? "w-[4.75rem]" : "w-64",
        // Suppress the width transition until the stored preference is read,
        // so a returning collapsed visitor never sees the full-width flash.
        !hydrated && "transition-none",
      )}
    >
      <div className="glass-panel sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl">
        <div
          className={cn(
            "flex items-center gap-2",
            // Row (logo, name, trailing toggle) when expanded; a centred column
            // when collapsed, because the two icons plus the padding of the
            // expanded row don't fit the 4.75rem rail — that's why the toggle
            // used to be clipped off the edge with no way to expand again.
            collapsed ? "flex-col justify-center gap-1.5 px-0 py-3" : "h-14 px-4",
          )}
        >
          <Image src="/brand/logo.png" alt="" width={28} height={28} className="size-7 shrink-0" priority />
          {collapsed ? null : (
            <span className="min-w-0 truncate text-sm font-semibold tracking-tight">{appName}</span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? expandLabel : collapseLabel}
            aria-pressed={collapsed}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              !collapsed && "ml-auto",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <SidebarCollapsedContext.Provider value={collapsed}>{children}</SidebarCollapsedContext.Provider>
        </div>
      </div>
    </aside>
  );
}
