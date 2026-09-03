"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  key: string;
  href: string;
  label: string;
}

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const active =
          item.href === TEAM_BASE_PATH ? pathname === TEAM_BASE_PATH : pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
