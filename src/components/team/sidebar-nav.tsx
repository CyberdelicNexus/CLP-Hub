"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Package,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { cn } from "@/lib/utils";

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
  logistics: Package,
  content: FileText,
  tasks: ListChecks,
  alerts: Bell,
  team: UserCog,
  settings: Settings,
};

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active =
          item.href === TEAM_BASE_PATH ? pathname === TEAM_BASE_PATH : pathname.startsWith(item.href);
        const Icon = ICONS[item.key];
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
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
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
