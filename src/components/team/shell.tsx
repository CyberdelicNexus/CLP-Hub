import { getTranslations } from "next-intl/server";
import type { StudyContext } from "@/auth/study-context";
import { TEAM_NAV, TEAM_BASE_PATH } from "@/domain/navigation";
import { countUnresolvedAlerts } from "@/services/automation";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { SidebarShell } from "./sidebar-shell";
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

  // Alerts moved into the horizontal nav bar as its own bell icon
  // (2026-09-19 request), so it's pulled out of the vertical sidebar list
  // rather than appearing in both places.
  const alertsItem = items.find((i) => i.key === "alerts") ?? null;
  const sidebarItems = items.filter((i) => i.key !== "alerts");
  // "Unresolved" (OPEN + ACKNOWLEDGED), the same definition the alerts page's
  // own attention tile uses — an acknowledged-but-not-resolved alert is still
  // something the badge should count, not just a brand-new OPEN one.
  const openAlertCount = alertsItem ? await countUnresolvedAlerts(ctx.study.id) : null;

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

      <SidebarShell
        appName={t("common.appName")}
        collapseLabel={t("team.sidebar.collapse")}
        expandLabel={t("team.sidebar.expand")}
      >
        <SidebarNav items={sidebarItems} />
      </SidebarShell>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          items={sidebarItems}
          alerts={alertsItem ? { href: alertsItem.href, label: alertsItem.label, count: openAlertCount ?? 0 } : null}
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
