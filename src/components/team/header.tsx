"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Bell, LogOut, Menu } from "lucide-react";
import { setActiveStudy, setLocale, signOut } from "@/app/(team)/equipo/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LOCALES } from "@/domain/locale";
import { SidebarNav, type NavItem } from "./sidebar-nav";

interface HeaderLabels {
  appName: string;
  study: string;
  switchStudy: string;
  openMenu: string;
  account: string;
  language: string;
  es: string;
  en: string;
  logout: string;
  yourRoles: string;
}

/** Shared classes for the two inline selects, so they read as one control set. */
const SELECT_CLASS =
  "h-8 rounded-lg border border-border bg-card px-2 text-sm shadow-soft transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

export function Header({
  items,
  alerts,
  studies,
  activeStudyId,
  user,
  roles,
  labels,
}: {
  items: NavItem[];
  /** Alerts moved out of the vertical sidebar into this bell (2026-09-19
   * request) — null when the viewer lacks `alerts.read` entirely. */
  alerts: { href: string; label: string; count: number } | null;
  studies: { id: string; code: string; title: string }[];
  activeStudyId: string;
  user: { name: string; email: string };
  roles: string[];
  labels: HeaderLabels;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = studies.find((s) => s.id === activeStudyId);

  return (
    <header className="glass-panel sticky top-0 z-30 mx-3 mt-3 flex h-14 items-center gap-2 rounded-2xl px-4 sm:px-5 lg:mr-6 lg:ml-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.openMenu} />}
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="flex h-14 items-center gap-2 px-5 text-sm font-semibold">
            <Image src="/brand/logo.png" alt="" width={28} height={28} className="size-7 shrink-0" />
            {labels.appName}
          </SheetTitle>
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">{labels.study}</span>
        {studies.length > 1 ? (
          <select
            aria-label={labels.switchStudy}
            className={`${SELECT_CLASS} max-w-64 truncate`}
            value={activeStudyId}
            disabled={pending}
            onChange={(e) => startTransition(() => setActiveStudy(e.target.value))}
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.title}
              </option>
            ))}
          </select>
        ) : active ? (
          <span className="truncate rounded-lg bg-card px-2.5 py-1 text-sm font-medium ring-1 ring-foreground/10">
            {active.code} · {active.title}
          </span>
        ) : null}
      </div>

      {alerts ? (
        <Link
          href={alerts.href}
          aria-label={alerts.count > 0 ? `${alerts.label} (${alerts.count})` : alerts.label}
          className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Bell className="size-4" aria-hidden />
          {alerts.count > 0 ? (
            <span
              aria-hidden
              data-numeric
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.6rem] font-semibold text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.5 0.19 25), oklch(0.34 0.15 20))",
              }}
            >
              {alerts.count > 99 ? "99+" : alerts.count}
            </span>
          ) : null}
        </Link>
      ) : null}

      <ThemeToggle />

      <select
        aria-label={labels.language}
        className={SELECT_CLASS}
        value={locale}
        disabled={pending}
        onChange={(e) => startTransition(() => setLocale(e.target.value))}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {labels[l]}
          </option>
        ))}
      </select>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-2 rounded-lg pl-1" aria-label={labels.account} />
          }
        >
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md bg-surface-lilac text-[0.65rem] font-semibold text-surface-lilac-ink"
          >
            {initials(user.name)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="space-y-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {labels.yourRoles}: {roles.join(", ")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
              <LogOut /> {labels.logout}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/**
 * First letters of the first two name-shaped words, e.g. "Cathy (SINTÉTICO)"
 * -> "C" and "Demo STUDY MANAGER" -> "DS". A trailing "(SINTÉTICO)" marker is
 * not a word here — it does not start with a letter — so it never eats the
 * second initial's slot.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
