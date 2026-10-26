import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { ScreeningBadge } from "@/components/team/participant-status-badge";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import {
  countParticipantOps,
  listEligibilityReasons,
  listOpenScreenings,
} from "@/services/participant-ops";
import { CloseScreeningForm, CompleteScreeningForm } from "../participantes/participant-forms";
import { StudyFlowSummary } from "./flow-summary";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("screening") };
}

/**
 * The evaluation dashboard: at-a-glance counts, the queue of appointments
 * still to happen, and — new here — recording an outcome inline instead of
 * only linking out to the participant page. The result is always RECORDED
 * here, never DECIDED here: the determination itself happens in Qualtrics or
 * wherever the study's approved evaluation system lives, and a staff member
 * types what it decided (`completeScreening`, the same call and audit row
 * the participant page's own form already used — this page reuses that form
 * component rather than duplicating it).
 */
export default async function ScreeningQueuePage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("screening.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const includeContact = ctx.permissions.has("participants.contact.read");
  const canManageScreening = ctx.permissions.has("screening.manage");

  const [rows, opsCounts, reasons] = await Promise.all([
    listOpenScreenings(ctx.study.id, { includeContact }),
    countParticipantOps(ctx.study.id),
    canManageScreening ? listEligibilityReasons(ctx.study.id) : Promise.resolve([]),
  ]);

  const reasonOptions = reasons
    .filter((r) => r.active)
    .map((r) => ({ id: r.id, label: r.labelEs, appliesTo: [...r.appliesTo] }));

  const errorLabels = {
    forbidden: t("common.noAccess"),
    invalid: t("participants.error.invalid"),
    notFound: t("participants.error.notFound"),
    badReference: t("participants.error.badReference"),
    failed: t("participants.error.failed"),
    reasonRequired: t("participants.error.reasonRequired"),
    reasonNotAllowed: t("participants.error.reasonNotAllowed"),
    reasonNotApplicable: t("participants.error.reasonNotApplicable"),
    noteTooLong: t("participants.error.noteTooLong"),
  };
  const formBase = { submit: t("common.save"), submitting: t("common.loading"), errors: errorLabels };

  const tiles: { key: string; label: string; value: number }[] = [
    { key: "screeningPending", label: t("team.overview.stats.screeningPending"), value: opsCounts.screeningPending },
    { key: "eligible", label: t("participants.eligibility.ELIGIBLE"), value: opsCounts.eligible },
    { key: "reviewRequired", label: t("participants.eligibility.REVIEW_REQUIRED"), value: opsCounts.reviewRequired },
    { key: "waitingForAllocation", label: t("screening.waitingForAllocation"), value: opsCounts.waitingForAllocation },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.screening")}</h1>
        <p className="text-sm text-muted-foreground">{t("screening.subtitle")}</p>
      </header>

      <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
        {t("screening.boundary")}
      </p>

      {/* The queue is the one actionable thing on this page — everything
          below it is informational — so it leads (2026-09-19 request:
          "move the pending evaluations to the top"). */}
      <Card>
        <CardHeader>
          <CardTitle>{t("screening.queueTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t("screening.emptyDescription")}</p>
          ) : canManageScreening ? (
            <Accordion className="px-4">
              {rows.map((row) => (
                <AccordionItem key={row.id} value={row.id}>
                  <AccordionTrigger>
                    <span className="flex flex-1 flex-wrap items-center gap-3 text-left font-normal">
                      <span data-numeric className="font-medium">
                        {row.participantCode}
                      </span>
                      {includeContact && row.fullName ? (
                        <span className="text-muted-foreground">{row.fullName}</span>
                      ) : null}
                      <span data-numeric className="text-xs text-muted-foreground">
                        {row.scheduledAt ? formatDate(row.scheduledAt, ctx.study.timezone) : "—"}
                      </span>
                      <ScreeningBadge
                        status={row.status}
                        label={t(`participants.screeningStatus.${row.status}`)}
                      />
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel>
                    <div className="space-y-4 rounded-xl bg-muted/50 p-4">
                      <CompleteScreeningForm
                        participantId={row.participantId}
                        screeningId={row.id}
                        results={["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED", "WAITLIST"].map((r) => ({
                          value: r,
                          label: t(`participants.eligibility.${r}`),
                        }))}
                        reasons={reasonOptions}
                        labels={{
                          ...formBase,
                          submit: t("participants.recordResult"),
                          result: t("participants.result"),
                          reference: t("participants.externalRef"),
                          referenceHelp: t("participants.externalRefHelp"),
                          reason: t("participants.reason"),
                          reasonRequiredHint: t("participants.reasonRequiredHint"),
                          reasonNote: t("participants.reasonNote"),
                          reasonNoteHelp: t("participants.reasonNoteHelp"),
                          reasonNoneConfigured: t("participants.reasonNoneConfigured"),
                        }}
                      />
                      <CloseScreeningForm
                        participantId={row.participantId}
                        screeningId={row.id}
                        options={["NO_SHOW", "CANCELLED"].map((s) => ({
                          value: s,
                          label: t(`participants.screeningAction.${s}`),
                        }))}
                        labels={formBase}
                      />
                      <Link
                        href={`${TEAM_BASE_PATH}/participantes/${row.participantId}`}
                        className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {t("participants.table.open")}
                        <ChevronRight className="size-3" aria-hidden />
                      </Link>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <ul className="divide-y divide-border px-4">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link
                    href={`${TEAM_BASE_PATH}/participantes/${row.participantId}`}
                    data-numeric
                    className="rounded font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {row.participantCode}
                  </Link>
                  {includeContact && row.fullName ? (
                    <span className="text-sm text-muted-foreground">{row.fullName}</span>
                  ) : null}
                  <span data-numeric className="text-xs text-muted-foreground">
                    {row.scheduledAt ? formatDate(row.scheduledAt, ctx.study.timezone) : "—"}
                  </span>
                  <ScreeningBadge status={row.status} label={t(`participants.screeningStatus.${row.status}`)} />
                  <Link
                    href={`${TEAM_BASE_PATH}/participantes/${row.participantId}`}
                    aria-label={`${t("participants.table.open")} ${row.participantCode}`}
                    className="ml-auto inline-flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section aria-label={t("nav.screening")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ key, label, value }) => (
          <Card key={key} className="card-accent relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p data-numeric className="text-3xl font-semibold">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <StudyFlowSummary studyId={ctx.study.id} />
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    value,
  );
}
