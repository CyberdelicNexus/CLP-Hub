"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  ListChecks,
  MessageCircleQuestionMark,
  MessageSquare,
  Package,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "./sidebar-shell";

export interface NavItem {
  key: string;
  href: string;
  label: string;
}

/**
 * Presentation-only icon map, keyed by the nav section keys in
 * src/domain/navigation.ts. Sections stay defined by permissions in the domain
 * layer; this only decides how they look.
 */
const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  applications: Inbox,
  participants: Users,
  screening: ClipboardCheck,
  cohorts: Layers,
  sessions: CalendarDays,
  communications: MessageSquare,
  calendar: CalendarRange,
  logistics: Package,
  content: FileText,
  // Public questions (D-088). Not Inbox (Solicitudes) or MessageSquare: a
  // question mark tells it apart from applications at a glance.
  inquiries: MessageCircleQuestionMark,
  tasks: ListChecks,
  alerts: Bell,
  team: UserCog,
  settings: Settings,
};

/** The badge's slide-in/out distance and the rail's own icon-to-edge gap —
 * tuned together so the badge reads as continuing the icon's motion rather
 * than popping in from an arbitrary distance. */
const BADGE_OFFSET = 10;

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // False outside a SidebarShell (e.g. the mobile Sheet's full-width menu),
  // which is the right default: that menu is never collapsed.
  const collapsed = useSidebarCollapsed();

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active =
          item.href === TEAM_BASE_PATH ? pathname === TEAM_BASE_PATH : pathname.startsWith(item.href);
        const Icon = ICONS[item.key];

        const link = (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              collapsed && "justify-center px-0",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            {Icon ? (
              <Icon
                aria-hidden
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground",
                )}
              />
            ) : null}
            <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
          </Link>
        );

        // Collapsed: the label leaves the rail entirely and reappears as a
        // floating badge that slides out from behind the icon on hover/focus
        // (2026-09-19 request: "the name badge slides to the right smoothly
        // and hides on unhover to the left"). A plain `title` attribute (the
        // previous behaviour) gives an OS tooltip with its own timing and no
        // animation at all — this needs an element we can actually animate,
        // which is what `TooltipPrimitive` is for. It renders through a
        // portal (`TooltipPrimitive.Portal`), which is why this works at
        // all: the rail sits inside two nested `overflow-hidden` ancestors
        // (`sidebar-shell.tsx`'s glass panel and its scroll container) that
        // would clip a plain `position: absolute` badge before it ever
        // cleared the icon.
        if (!collapsed) return link;

        return (
          <TooltipPrimitive.Root key={item.key}>
            <TooltipPrimitive.Trigger render={link} />
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Positioner side="right" sideOffset={BADGE_OFFSET} className="z-50">
                <TooltipPrimitive.Popup
                  className={cn(
                    "rounded-lg bg-card px-3 py-1.5 text-sm font-medium whitespace-nowrap text-sidebar-foreground shadow-lift ring-1 ring-foreground/10",
                    // Slide-in and slide-out are mirrored (from-left / to-left)
                    // rather than the library's default fade+zoom, so the
                    // badge reads as sliding out from behind the icon and
                    // retreating the same way — "organic", not a snap.
                    "duration-200 ease-[var(--ease-out-soft)] data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:slide-in-from-left-2 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left-2",
                  )}
                >
                  {item.label}
                </TooltipPrimitive.Popup>
              </TooltipPrimitive.Positioner>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        );
      })}
    </nav>
  );

  // A shared delay group (2026-09-19): once one badge is showing, moving to
  // the next icon shows its badge instantly rather than re-running the open
  // delay — the same "sweep across the rail" feel a native menu bar has.
  return collapsed ? <TooltipPrimitive.Provider delay={150}>{nav}</TooltipPrimitive.Provider> : nav;
}
