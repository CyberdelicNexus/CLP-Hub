"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { LogOut, Menu } from "lucide-react";
import { setActiveStudy, setLocale, signOut } from "@/app/(team)/equipo/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  studies,
  activeStudyId,
  user,
  roles,
  labels,
}: {
  items: NavItem[];
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
    <header className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:pl-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.openMenu} />}
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="flex h-14 items-center gap-2 px-5 text-sm font-semibold">
            <span aria-hidden className="size-6 rounded-[7px] bg-primary ring-1 ring-foreground/10" />
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
          <DropdownMenuLabel className="space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {labels.yourRoles}: {roles.join(", ")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
            <LogOut /> {labels.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/** First letters of the first two words, e.g. "Demo ADMIN" -> "DA". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
