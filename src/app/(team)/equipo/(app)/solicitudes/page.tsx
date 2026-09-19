import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { ApplicationStatusBadge } from "@/components/team/application-status-badge";
import { NoAccess } from "@/components/team/no-access";
import { ViewToggle } from "@/components/team/view-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATION_STATUSES, isApplicationStatus, type ApplicationStatus } from "@/domain/recruitment";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { countApplicationsByStatus, listApplications } from "@/services/recruitment";
import { QualtricsIntakeForm } from "./intake-form";
import { ApplicationsKanban } from "./applications-kanban";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("applications") };
}

/**
 * Applications list. Contact columns are selected only when the viewer holds
 * `participants.contact.read`; otherwise the query never fetches them, so
 * Category A data does not reach a page that may not display it.
 */
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vista?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("applications.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { estado, vista } = await searchParams;
  const status = isApplicationStatus(estado) ? estado : undefined;
  const isKanban = vista === "kanban";
  const includeContact = ctx.permissions.has("participants.contact.read");

  const [rows, counts] = await Promise.all([
    // The kanban lays every status out as its own column, so a single-status
    // filter would just empty every column but one — fetch everything instead.
    listApplications(ctx.study.id, { includeContact, status: isKanban ? undefined : status }),
    countApplicationsByStatus(ctx.study.id),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const base = `${TEAM_BASE_PATH}/solicitudes`;
  const canCreate = ctx.permissions.has("participants.manage");
  const canManage = ctx.permissions.has("applications.manage");
  const viewHref = (v: "list" | "kanban") => (v === "list" ? base : `${base}?vista=kanban`);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.applications")}</h1>
          <p className="text-sm text-muted-foreground">{t("applications.subtitle")}</p>
        </div>
        <ViewToggle current={isKanban ? "kanban" : "list"} hrefFor={viewHref} labels={{
          list: t("common.viewList"),
          kanban: t("common.viewKanban"),
        }} />
      </header>

      {/* Status filter. Plain links, so the view is shareable and works without JS.
          Hidden in kanban view, which already segments by status visually. */}
      {isKanban ? null : (
        <nav aria-label={t("applications.filterLabel")} className="flex flex-wrap gap-2">
          <FilterChip href={base} active={!status} label={t("applications.all")} count={total} />
          {APPLICATION_STATUSES.map((s) => (
            <FilterChip
              key={s}
              href={`${base}?estado=${s}`}
              active={status === s}
              label={t(`applications.status.${s}`)}
              count={counts[s] ?? 0}
            />
          ))}
        </nav>
      )}

      {!includeContact ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("applications.contactHidden")}
        </p>
      ) : null}

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("applications.intakeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("applications.intakeBoundary")}
            </p>
            <QualtricsIntakeForm
              labels={{
                reference: t("applications.intakeReference"),
                referenceHelp: t("applications.intakeReferenceHelp"),
                submit: t("applications.intakeSubmit"),
                submitting: t("common.loading"),
                created: t("applications.intakeCreated"),
                errors: {
                  forbidden: t("common.noAccess"),
                  invalid: t("applications.intakeError.invalid"),
                  duplicate: t("applications.intakeError.duplicate"),
                  failed: t("applications.intakeError.failed"),
                },
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("applications.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("applications.emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : isKanban ? (
        <ApplicationsKanban
          rows={rows}
          includeContact={includeContact}
          readOnly={!canManage}
          statusLabels={Object.fromEntries(
            APPLICATION_STATUSES.map((s) => [s, t(`applications.status.${s}`)]),
          ) as Record<ApplicationStatus, string>}
          errorLabels={{
            forbidden: t("common.noAccess"),
            invalid: t("applications.error.invalid"),
            failed: t("applications.error.failed"),
          }}
          timeZone={ctx.study.timezone}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3">{t("applications.table.code")}</th>
                  {includeContact ? (
                    <th scope="col" className="px-4 py-3">{t("applications.table.name")}</th>
                  ) : null}
                  <th scope="col" className="px-4 py-3">{t("applications.table.status")}</th>
                  <th scope="col" className="px-4 py-3">{t("applications.table.submitted")}</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("applications.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td data-numeric className="px-4 py-3 font-medium">
                      <Link
                        href={`${base}/${row.id}`}
                        className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {row.participantCode}
                      </Link>
                    </td>
                    {includeContact ? (
                      <td className="px-4 py-3">{row.fullName ?? "—"}</td>
                    ) : null}
                    <td className="px-4 py-3">
                      <ApplicationStatusBadge
                        status={row.status}
                        label={t(`applications.status.${row.status}`)}
                      />
                    </td>
                    <td data-numeric className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.submittedAt, ctx.study.timezone)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${base}/${row.id}`}
                        aria-label={`${t("applications.table.open")} ${row.participantCode}`}
                        className="inline-flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          : "inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground"
      }
    >
      {label}
      <span data-numeric className="opacity-70">
        {count}
      </span>
    </Link>
  );
}

/** Dates are stored in UTC and displayed in the study timezone. */
function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
