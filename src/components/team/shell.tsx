import { getTranslations } from "next-intl/server";
import type { StudyContext } from "@/auth/study-context";
import { TEAM_NAV, TEAM_BASE_PATH } from "@/domain/navigation";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { Header } from "./header";

/**
 * Dashboard frame: fixed sidebar on desktop, sheet on smaller screens.
 * Navigation items are filtered by permission on the server so the client
 * never sees sections the user cannot open.
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
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        {t("common.skipToContent")}
      </a>

      <aside className="hidden w-60 shrink-0 border-r bg-sidebar lg:block">
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-sm font-semibold tracking-tight">{t("common.appName")}</span>
        </div>
        <SidebarNav items={items} />
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
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
