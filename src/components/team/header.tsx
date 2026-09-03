"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { LogOut, Menu } from "lucide-react";
import { setActiveStudy, setLocale, signOut } from "@/app/(team)/equipo/actions";
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
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.openMenu} />}
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="flex h-14 items-center border-b px-5 text-sm font-semibold">{labels.appName}</SheetTitle>
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">{labels.study}</span>
        {studies.length > 1 ? (
          <select
            aria-label={labels.switchStudy}
            className="h-8 max-w-64 truncate rounded-md border bg-background px-2 text-sm"
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
        ) : (
          <span className="truncate text-sm font-medium">{active ? `${active.code} · ${active.title}` : null}</span>
        )}
      </div>

      <select
        aria-label={labels.language}
        className="h-8 rounded-md border bg-background px-2 text-sm"
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
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label={labels.account} />}>
          <span className="max-w-32 truncate">{user.name}</span>
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
