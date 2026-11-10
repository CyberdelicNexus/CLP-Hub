import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { ApplicationStatusBadge } from "@/components/team/application-status-badge";
import { ClosingDialog } from "@/components/team/closing-dialog";
import { NoAccess } from "@/components/team/no-access";
import { ViewToggle } from "@/components/team/view-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { APPLICATION_STATUSES, isApplicationStatus, type ApplicationStatus } from "@/domain/recruitment";
import { SCREENING_STATUSES } from "@/domain/screening";
import { ELIGIBILITY_STATUSES } from "@/domain/participant-state";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listEligibilityReasons } from "@/services/participant-ops";
import { countApplicationsByStatus, listApplicationCards } from "@/services/recruitment";
import { getStudyFlowCounts } from "@/services/study-flow";
import { QualtricsIntakeForm } from "./intake-form";
import { ApplicationsKanban } from "./applications-kanban";
import { ApplicationCard, type ApplicationCardLabels } from "./application-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("applications") };
}

/**
 * Applications, and the screening that follows them, in one place
 * (2026-10-28 request: moving an application through its statuses, then going
 * to Participantes to book the screening and to Evaluación to record it, was
 * "a lot of places for what could be managed in one area").
 *
 * A gallery of cards by default, with kanban and list views; the KPI row on
 * top is the recruitment part of the study flow (`getStudyFlowCounts`), the
 * rest of which now sits on the Hub overview. Each card carries the status,
 * the screening date and the result (see `ApplicationCard`), and opens the
 * participant. Registering a Qualtrics response is a button and a modal.
 *
 * Contact columns are selected only when the viewer holds
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
  const view: View = vista === "kanban" ? "kanban" : vista === "lista" ? "list" : "gallery";
  const status = isApplicationStatus(estado) ? estado : undefined;
  const isKanban = view === "kanban";
  const includeContact = ctx.permissions.has("participants.contact.read");
  const canCreate = ctx.permissions.has("participants.manage");
  const canManage = ctx.permissions.has("applications.manage");
  // The KPI row carries eligibility counts, so it follows Evaluación's gate.
  const canReadScreening = ctx.permissions.has("screening.read");
  const canManageScreening = ctx.permissions.has("screening.manage");

  const [rows, counts, flow, reasons] = await Promise.all([
    // The kanban lays every status out as its own column, so a single-status
    // filter would just empty every column but one — fetch everything instead.
    listApplicationCards(ctx.study.id, { includeContact, status: isKanban ? undefined : status }),
    countApplicationsByStatus(ctx.study.id),
    canReadScreening ? getStudyFlowCounts(ctx.study.id) : Promise.resolve(null),
    canManageScreening ? listEligibilityReasons(ctx.study.id) : Promise.resolve([]),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const base = `${TEAM_BASE_PATH}/solicitudes`;
  const hrefWith = (params: { view?: View; status?: ApplicationStatus | null }) => {
    const q = new URLSearchParams();
    const v = params.view ?? view;
    const st = params.status === undefined ? status : params.status;
    if (VIEW_PARAM[v]) q.set("vista", VIEW_PARAM[v] as string);
    if (st && v !== "kanban") q.set("estado", st);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };

  // The recruitment half of the study flow, as one compact row (two at most).
  const kpis = flow
    ? [
        { key: "applicationsReceived", value: flow.applicationsReceived },
        { key: "pending", value: flow.determination.pending },
        { key: "assessed", value: flow.assessed },
        { key: "eligible", value: flow.determination.eligible },
        { key: "ineligible", value: flow.determination.ineligible },
        { key: "reviewRequired", value: flow.determination.reviewRequired },
        { key: "waitlist", value: flow.determination.waitlist },
        { key: "eligibleNotAllocated", value: flow.eligibleNotAllocated },
      ]
    : [];

  const statusLabels = Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, t(`applications.status.${s}`)]),
  ) as Record<ApplicationStatus, string>;
  const statusErrors = {
    forbidden: t("common.noAccess"),
    invalid: t("applications.error.invalid"),
    failed: t("applications.error.failed"),
  };
  const cardLabels: ApplicationCardLabels = {
    statusLabels,
    screeningStatusLabels: Object.fromEntries(
      SCREENING_STATUSES.map((s) => [s, t(`participants.screeningStatus.${s}`)]),
    ),
    eligibilityLabels: Object.fromEntries(
      ELIGIBILITY_STATUSES.map((s) => [s, t(`participants.eligibility.${s}`)]),
    ),
    statusLabel: t("applications.card.statusLabel"),
    noTransitions: t("applications.card.noTransitions"),
    screeningWhen: t("applications.card.screeningWhen"),
    schedule: t("applications.card.schedule"),
    // Placeholders filled per card on the client.
    screeningOn: t("applications.card.screeningOn", { date: "{date}" }),
    screeningResult: t("applications.card.screeningResult", { result: "{result}" }),
    recordResult: t("applications.card.recordResult"),
    recordResultTitle: t("applications.card.recordResultTitle", { code: "{code}" }),
    recordResultBoundary: t("applications.card.recordResultBoundary"),
    noResultTitle: t("applications.card.noResultTitle"),
    openParticipant: t("applications.card.openParticipant", { code: "{code}" }),
    submitting: t("common.loading"),
    statusErrors,
    screeningErrors: {
      forbidden: t("common.noAccess"),
      invalid: t("participants.error.invalid"),
      notFound: t("participants.error.notFound"),
      badReference: t("participants.error.badReference"),
      failed: t("participants.error.failed"),
      reasonRequired: t("participants.error.reasonRequired"),
      reasonNotAllowed: t("participants.error.reasonNotAllowed"),
      reasonNotApplicable: t("participants.error.reasonNotApplicable"),
      noteTooLong: t("participants.error.noteTooLong"),
    },
    completeForm: {
      submit: t("participants.recordResult"),
      submitting: t("common.loading"),
      result: t("participants.result"),
      reference: t("participants.externalRef"),
      referenceHelp: t("participants.externalRefHelp"),
      reason: t("participants.reason"),
      reasonRequiredHint: t("participants.reasonRequiredHint"),
      reasonNote: t("participants.reasonNote"),
      reasonNoteHelp: t("participants.reasonNoteHelp"),
      reasonNoneConfigured: t("participants.reasonNoneConfigured"),
    },
    closeOptions: ["NO_SHOW", "CANCELLED"].map((s) => ({
      value: s,
      label: t(`participants.screeningAction.${s}`),
    })),
    // The same four results Evaluación offers; staff pick, nothing is inferred.
    results: ["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED", "WAITLIST"].map((r) => ({
      value: r,
      label: t(`participants.eligibility.${r}`),
    })),
  };
  const reasonOptions = reasons
    .filter((r) => r.active)
    .map((r) => ({ id: r.id, label: r.labelEs, appliesTo: [...r.appliesTo] }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.applications")}</h1>
          <p className="text-sm text-muted-foreground">{t("applications.subtitle")}</p>
        </div>
        {canCreate ? (
          <ClosingDialog>
            <DialogTrigger render={<Button size="sm" className="gap-1.5 rounded-lg" />}>
              <Plus className="size-3.5" aria-hidden />
              {t("applications.intakeButton")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("applications.intakeTitle")}</DialogTitle>
              </DialogHeader>
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
            </DialogContent>
          </ClosingDialog>
        ) : null}
      </header>

      {kpis.length > 0 ? (
        <section
          aria-label={t("applications.kpiLabel")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8"
        >
          {kpis.map((kpi) => (
            <Card key={kpi.key} className="card-accent relative gap-1 overflow-hidden py-3">
              <CardHeader className="px-3">
                <CardTitle className="truncate text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                  {t(`flow.stage.${kpi.key}`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3">
                <p data-numeric className="text-2xl font-semibold">
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {/* Views, then the status filter (2026-10-28 order). Plain links, so
          the view is shareable and works without JS. The kanban already
          segments by status, so it shows no filter. */}
      <div className="space-y-3">
        <ViewToggle
          current={view}
          hrefFor={(v) => hrefWith({ view: v })}
          labels={{
            gallery: t("applications.viewGallery"),
            kanban: t("common.viewKanban"),
            list: t("common.viewList"),
          }}
        />
        {isKanban ? null : (
          <nav aria-label={t("applications.filterLabel")} className="flex flex-wrap gap-2">
            <FilterChip href={hrefWith({ status: null })} active={!status} label={t("applications.all")} count={total} />
            {APPLICATION_STATUSES.map((s) => (
              <FilterChip
                key={s}
                href={hrefWith({ status: s })}
                active={status === s}
                label={t(`applications.status.${s}`)}
                count={counts[s] ?? 0}
              />
            ))}
          </nav>
        )}
      </div>

      {!includeContact ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("applications.contactHidden")}
        </p>
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
          statusLabels={statusLabels}
          errorLabels={statusErrors}
          timeZone={ctx.study.timezone}
          canManageScreening={canManageScreening}
          reasons={reasonOptions}
          cardLabels={cardLabels}
        />
      ) : view === "gallery" ? (
        <div className="grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
          {rows.map((row) => (
            <ApplicationCard
              key={row.id}
              row={row}
              includeContact={includeContact}
              canManageApplication={canManage}
              canManageScreening={canManageScreening}
              reasons={reasonOptions}
              labels={cardLabels}
              timeZone={ctx.study.timezone}
            />
          ))}
        </div>
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
                  {/* `relative`: see contenido/page.tsx's identical <th> for why
                      this matters, not just styles — an un-anchored `.sr-only`
                      span here was escaping this table's overflow-x-auto
                      clipping and forcing the whole page to zoom out on mobile. */}
                  <th scope="col" className="relative px-4 py-3">
                    <span className="sr-only">{t("applications.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td data-numeric className="px-4 py-3 font-medium">
                      {/* The participant, like the cards (2026-10-28); the
                          chevron still opens the application itself. */}
                      <Link
                        href={`${TEAM_BASE_PATH}/participantes/${row.participantId}`}
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

type View = "gallery" | "kanban" | "list";

/** `?vista=` per view; the gallery is the default and needs none. */
const VIEW_PARAM: Record<View, string | null> = { gallery: null, kanban: "kanban", list: "lista" };

/** Dates are stored in UTC and displayed in the study timezone. */
function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
