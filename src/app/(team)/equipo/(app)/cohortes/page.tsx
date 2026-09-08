import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listCohorts } from "@/services/cohorts";
import { CreateCohortForm } from "./cohort-forms";
import { cohortTone } from "./tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("cohorts") };
}

/**
 * Cohorts list. Facilitators see only the cohorts they staff — the narrowing
 * comes from ctx.cohortScope, which is resolved from cohort_staff for any caller
 * without `cohorts.read.all`.
 */
export default async function CohortsPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("cohorts.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("cohorts.manage");
  const narrowed = ctx.cohortScope !== null;
  const rows = await listCohorts(ctx.study.id, { scope: ctx.cohortScope });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.cohorts")}</h1>
        <p className="text-sm text-muted-foreground">{t("cohorts.subtitle")}</p>
      </header>

      {narrowed ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("cohorts.scopedNotice")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("cohorts.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {narrowed ? t("cohorts.emptyScoped") : t("cohorts.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3">{t("cohorts.table.code")}</th>
                  <th scope="col" className="px-4 py-3">{t("cohorts.table.name")}</th>
                  <th scope="col" className="px-4 py-3">{t("cohorts.table.status")}</th>
                  <th scope="col" className="px-4 py-3">{t("cohorts.table.members")}</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("cohorts.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = `${TEAM_BASE_PATH}/cohortes/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td data-numeric className="px-4 py-3 font-medium">
                        <Link
                          href={href}
                          className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={cohortTone(row.status)}>
                          {t(`cohorts.status.${row.status}`)}
                        </StatusBadge>
                      </td>
                      <td data-numeric className="px-4 py-3 text-muted-foreground">
                        {row.capacity ? `${row.memberCount} / ${row.capacity}` : row.memberCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={href}
                          aria-label={`${t("cohorts.table.open")} ${row.code}`}
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
            <CardTitle>{t("cohorts.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCohortForm
              labels={{
                submit: t("cohorts.create"),
                submitting: t("common.loading"),
                code: t("cohorts.field.code"),
                name: t("cohorts.field.name"),
                start: t("cohorts.field.start"),
                end: t("cohorts.field.end"),
                capacity: t("cohorts.field.capacity"),
                capacityHelp: t("cohorts.field.capacityHelp"),
                errors: {
                  forbidden: t("common.noAccess"),
                  invalid: t("cohorts.error.invalid"),
                  duplicateCode: t("cohorts.error.duplicateCode"),
                  failed: t("cohorts.error.failed"),
                },
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
