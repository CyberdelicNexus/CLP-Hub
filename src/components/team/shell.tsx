import { getTranslations } from "next-intl/server";
import type { StudyContext } from "@/auth/study-context";
import { TEAM_NAV, TEAM_BASE_PATH } from "@/domain/navigation";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { Header } from "./header";

/**
 * Dashboard frame: a floating sidebar panel on desktop, a sheet on smaller
 * screens. Navigation items are filtered by permission on the server so the
 * client never sees sections the user cannot open.
 */
export async function TeamShell({ ctx, children }: { ctx: StudyContext; children: React.ReactNode }) {
  const t = await getTranslations();

  const items: NavItem[] = TEAM_NAV.filter(
    (s) => s.permissions.length === 0 || s.permissions.some((p) => ctx.permissions.has(p)),
  ).map((s) => ({
    key: s.key,
    href: s.path ? `${TEAM_BASE_PATH}/${s.path}` : TEAM_BASE_PATH,
    label: t(`nav.${s.key}`),
  }));

  const studies = uniqueStudies(ctx);

  return (
    <div className="relative flex min-h-screen">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 opacity-40 dark:opacity-25"
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lift"
      >
        {t("common.skipToContent")}
      </a>

      <aside className="hidden w-64 shrink-0 p-3 lg:block">
        <div className="sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl bg-sidebar ring-1 ring-foreground/10">
          <div className="flex h-14 items-center gap-2 px-5">
            <span aria-hidden className="size-6 rounded-[7px] bg-primary ring-1 ring-foreground/10" />
            <span className="text-sm font-semibold tracking-tight">{t("common.appName")}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav items={items} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          items={items}
          studies={studies}
          activeStudyId={ctx.study.id}
          user={{ name: ctx.session.displayName, email: ctx.session.email }}
          roles={ctx.roles.map((r) => t(`roles.${r}`))}
          labels={{
            appName: t("common.appName"),
            study: t("team.header.study"),
            switchStudy: t("team.header.switchStudy"),
            openMenu: t("team.header.openMenu"),
            account: t("team.header.account"),
            language: t("locale.label"),
            es: t("locale.es"),
            en: t("locale.en"),
            logout: t("auth.logout"),
            yourRoles: t("team.yourRoles"),
          }}
        />
        <main id="main" className="flex-1 px-4 pt-2 pb-8 sm:px-6 lg:pr-6 lg:pl-0">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function uniqueStudies(ctx: StudyContext) {
  const seen = new Map<string, { id: string; code: string; title: string }>();
  for (const m of ctx.session.memberships) {
    if (!seen.has(m.studyId)) seen.set(m.studyId, { id: m.studyId, code: m.studyCode, title: m.studyTitle });
  }
  return [...seen.values()];
}
