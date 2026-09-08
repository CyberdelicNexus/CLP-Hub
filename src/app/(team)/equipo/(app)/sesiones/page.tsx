import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { SESSION_MODALITIES } from "@/domain/session";
import { listAssignableCohorts } from "@/services/cohorts";
import { listSessionTemplates, listSessions } from "@/services/sessions";
import { ScheduleSessionForm } from "./session-forms";
import { sessionTone } from "./tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("sessions") };
}

/**
 * Sessions across the study, soonest first. Narrowed by cohort scope, so a
 * facilitator sees only the sessions of cohorts they run.
 */
export default async function SessionsPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("sessions.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("sessions.manage");
  const narrowed = ctx.cohortScope !== null;

  const [rows, cohorts, templates] = await Promise.all([
    listSessions(ctx.study.id, { scope: ctx.cohortScope }),
    canManage ? listAssignableCohorts(ctx.study.id, { scope: ctx.cohortScope }) : [],
    canManage ? listSessionTemplates(ctx.study.id) : [],
  ]);

  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("sessions.error.invalid"),
    notFound: t("sessions.error.notFound"),
    failed: t("sessions.error.failed"),
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.sessions")}</h1>
        <p className="text-sm text-muted-foreground">{t("sessions.subtitle")}</p>
      </header>

      {narrowed ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("sessions.scopedNotice")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("sessions.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("sessions.emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3">{t("sessions.table.when")}</th>
                  <th scope="col" className="px-4 py-3">{t("sessions.table.name")}</th>
                  <th scope="col" className="px-4 py-3">{t("sessions.table.cohort")}</th>
                  <th scope="col" className="px-4 py-3">{t("sessions.table.modality")}</th>
                  <th scope="col" className="px-4 py-3">{t("sessions.table.status")}</th>
                  <th scope="col" className="px-4 py-3">{t("sessions.table.expected")}</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("sessions.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = `${TEAM_BASE_PATH}/sesiones/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td data-numeric className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={href}
                          className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {formatDate(row.scheduledStart, ctx.study.timezone)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td data-numeric className="px-4 py-3 text-muted-foreground">
                        {row.cohortCode}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t(`sessions.modality.${row.modality}`)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={sessionTone(row.status)}>
                          {t(`sessions.status.${row.status}`)}
                        </StatusBadge>
                      </td>
                      <td data-numeric className="px-4 py-3 text-muted-foreground">
                        {row.expected}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={href}
                          aria-label={`${t("sessions.table.open")} ${row.name}`}
                          className="inline-flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("sessions.scheduleTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleSessionForm
              cohorts={cohorts.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))}
              templates={templates.map((tpl) => ({ id: tpl.id, label: tpl.nameEs }))}
              modalities={SESSION_MODALITIES.map((m) => ({
                value: m,
                label: t(`sessions.modality.${m}`),
              }))}
              labels={{
                submit: t("sessions.schedule"),
                submitting: t("common.loading"),
                cohort: t("nav.cohorts"),
                name: t("sessions.field.name"),
                modality: t("sessions.field.modality"),
                when: t("sessions.field.when"),
                duration: t("sessions.field.duration"),
                location: t("sessions.field.location"),
                template: t("sessions.field.template"),
                templateHelp: t("sessions.field.templateHelp"),
                none: t("sessions.noCohorts"),
                errors,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    value,
  );
}
