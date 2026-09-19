import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import {
  EligibilityBadge,
  EnrollmentBadge,
} from "@/components/team/participant-status-badge";
import { ViewToggle } from "@/components/team/view-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { NextStepBadge } from "@/components/team/next-step-badge";
import { nextStep } from "@/domain/next-step";
import {
  ELIGIBILITY_STATUSES,
  ENROLLMENT_STATUSES,
  isEligibilityStatus,
  isEnrollmentStatus,
  type EligibilityStatus,
} from "@/domain/participant-state";
import { listParticipants, listOpenScreenings } from "@/services/participant-ops";
import { listCohorts, listStudyArms } from "@/services/cohorts";
import { listResponsibleCandidates } from "@/services/participant-care";
import { ParticipantsKanban } from "./participants-kanban";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("participants") };
}

/**
 * Participants list, filterable by eligibility. Contact columns are only
 * selected when the viewer holds participants.contact.read.
 */
export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    elegibilidad?: string;
    estado?: string;
    cohorte?: string;
    grupo?: string;
    responsable?: string;
    vista?: string;
  }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("participants.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const params = await searchParams;
  const eligibility = isEligibilityStatus(params.elegibilidad) ? params.elegibilidad : undefined;
  const enrollment = isEnrollmentStatus(params.estado) ? params.estado : undefined;
  const isKanban = params.vista === "kanban";
  const includeContact = ctx.permissions.has("participants.contact.read");
  const canManageScreening = ctx.permissions.has("screening.manage");

  const [rows, cohortOptions, armOptions, staffOptions, openScreenings] = await Promise.all([
    listParticipants(ctx.study.id, {
      includeContact,
      // The kanban lays every eligibility status out as its own column, same
      // reasoning as the solicitudes kanban: a single-status filter would just
      // empty every column but one.
      eligibility: isKanban ? undefined : eligibility,
      enrollment,
      cohortId: params.cohorte,
      armId: params.grupo,
      responsibleUserId: params.responsable,
    }),
    // Cohort options respect the caller's cohort scope, so a facilitator cannot
    // discover cohorts they do not staff through a filter dropdown (D-022).
    ctx.permissions.has("cohorts.read")
      ? listCohorts(ctx.study.id, { scope: ctx.cohortScope })
      : Promise.resolve([]),
    ctx.permissions.has("randomization.read")
      ? listStudyArms(ctx.study.id)
      : Promise.resolve([]),
    ctx.permissions.has("participants.manage")
      ? listResponsibleCandidates(ctx.study.id)
      : Promise.resolve([]),
    // Only fetched for the kanban, to know which participants have an open
    // screening a drag-to-ELIGIBLE/WAITLIST can complete.
    isKanban && canManageScreening
      ? listOpenScreenings(ctx.study.id, { includeContact: false })
      : Promise.resolve([]),
  ]);

  const openScreeningByParticipant = Object.fromEntries(
    openScreenings.map((s) => [s.participantId, s.id]),
  );

  const base = `${TEAM_BASE_PATH}/participantes`;
  const viewHref = (v: "list" | "kanban") => (v === "list" ? base : `${base}?vista=kanban`);

  /**
   * A next step is only shown when the viewer can see the whole picture.
   * Screening and consent are separately gated, and a step computed from a
   * partial view would be a confident, wrong instruction.
   */
  const canSeeWholePicture =
    ctx.permissions.has("screening.read") && ctx.permissions.has("consent.read");

  // Filter links keep whatever else is already selected, so the four filters
  // compose instead of each one clearing the others.
  const withParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      elegibilidad: eligibility,
      estado: enrollment,
      cohorte: params.cohorte,
      grupo: params.grupo,
      responsable: params.responsable,
    };
    current[key] = value;
    for (const [k, v] of Object.entries(current)) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.participants")}</h1>
          <p className="text-sm text-muted-foreground">{t("participants.subtitle")}</p>
        </div>
        <ViewToggle
          current={isKanban ? "kanban" : "list"}
          hrefFor={viewHref}
          labels={{ list: t("common.viewList"), kanban: t("common.viewKanban") }}
        />
      </header>

      <div className="space-y-3">
        {/* Hidden in kanban view, which already segments by eligibility visually. */}
        {isKanban ? null : (
          <nav aria-label={t("participants.filterLabel")} className="flex flex-wrap gap-2">
            <FilterChip href={base} active={!eligibility && !enrollment} label={t("participants.all")} />
            {ELIGIBILITY_STATUSES.map((st) => (
              <FilterChip
                key={st}
                href={withParam("elegibilidad", eligibility === st ? undefined : st)}
                active={eligibility === st}
                label={t(`participants.eligibility.${st}`)}
              />
            ))}
          </nav>
        )}

        <nav aria-label={t("participants.filterEnrollment")} className="flex flex-wrap gap-2">
          {ENROLLMENT_STATUSES.map((st) => (
            <FilterChip
              key={st}
              href={withParam("estado", enrollment === st ? undefined : st)}
              active={enrollment === st}
              label={t(`participants.enrollment.${st}`)}
            />
          ))}
        </nav>

        {/*
          Cohort, arm and responsible are dropdowns rather than chip rows: they
          are open-ended lists, and a row of thirty cohort chips would bury the
          status filters above.
        */}
        <div className="flex flex-wrap gap-4">
          {cohortOptions.length > 0 ? (
            <FilterSelect
              id="cohorte"
              label={t("participants.filterCohort")}
              anyLabel={t("participants.filterAny")}
              value={params.cohorte}
              options={cohortOptions.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
              hrefFor={(v) => withParam("cohorte", v)}
            />
          ) : null}
          {armOptions.length > 0 ? (
            <FilterSelect
              id="grupo"
              label={t("participants.filterArm")}
              anyLabel={t("participants.filterAny")}
              value={params.grupo}
              options={armOptions.map((a) => ({ value: a.id, label: `${a.code} · ${a.nameEs}` }))}
              hrefFor={(v) => withParam("grupo", v)}
            />
          ) : null}
          {staffOptions.length > 0 ? (
            <FilterSelect
              id="responsable"
              label={t("participants.filterResponsible")}
              anyLabel={t("participants.filterAny")}
              value={params.responsable}
              options={staffOptions.map((u) => ({ value: u.id, label: u.displayName }))}
              hrefFor={(v) => withParam("responsable", v)}
            />
          ) : null}
        </div>
      </div>

      {!includeContact ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("participants.contactHidden")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("participants.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("participants.emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : isKanban ? (
        <ParticipantsKanban
          rows={rows}
          includeContact={includeContact}
          readOnly={!canManageScreening}
          openScreeningByParticipant={openScreeningByParticipant}
          statusLabels={Object.fromEntries(
            ELIGIBILITY_STATUSES.map((s) => [s, t(`participants.eligibility.${s}`)]),
          ) as Record<EligibilityStatus, string>}
          errorLabels={{
            forbidden: t("common.noAccess"),
            invalid: t("participants.error.invalid"),
            notFound: t("participants.error.notFound"),
            failed: t("participants.error.failed"),
            reasonRequired: t("participants.error.reasonRequired"),
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3">{t("participants.table.code")}</th>
                  {includeContact ? (
                    <th scope="col" className="px-4 py-3">{t("participants.table.name")}</th>
                  ) : null}
                  <th scope="col" className="px-4 py-3">{t("participants.table.eligibility")}</th>
                  <th scope="col" className="px-4 py-3">{t("participants.table.enrollment")}</th>
                  <th scope="col" className="px-4 py-3">{t("participants.table.cohort")}</th>
                  {canSeeWholePicture ? (
                    <th scope="col" className="px-4 py-3">{t("participants.table.nextStep")}</th>
                  ) : null}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("participants.table.open")}</span>
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
                        {row.code}
                      </Link>
                    </td>
                    {includeContact ? <td className="px-4 py-3">{row.fullName ?? "—"}</td> : null}
                    <td className="px-4 py-3">
                      <EligibilityBadge
                        status={row.eligibilityStatus}
                        label={t(`participants.eligibility.${row.eligibilityStatus}`)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.enrollmentStatus ? (
                        <EnrollmentBadge
                          status={row.enrollmentStatus}
                          label={t(`participants.enrollment.${row.enrollmentStatus}`)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td data-numeric className="px-4 py-3 text-muted-foreground">
                      {row.cohortCode ?? "—"}
                    </td>
                    {canSeeWholePicture ? (
                      <td className="px-4 py-3">
                        <NextStepBadge
                          step={nextStep(row.snapshot)}
                          label={t(`nextStep.${nextStep(row.snapshot)}`)}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${base}/${row.id}`}
                        aria-label={`${t("participants.table.open")} ${row.code}`}
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

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          : "inline-flex items-center rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}

/**
 * A filter rendered as a list of links behind a `<details>`, not a `<select>`.
 *
 * The page is a server component with no client JavaScript, and a bare `<select>`
 * would need an onChange handler to navigate. Links keep the view shareable and
 * working without JS, which is the same reasoning behind the chip filters.
 */
function FilterSelect({
  id,
  label,
  anyLabel,
  value,
  options,
  hrefFor,
}: {
  id: string;
  label: string;
  anyLabel: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  hrefFor: (value: string | undefined) => string;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-xs font-medium ring-1 ring-foreground/10 transition-colors hover:text-foreground">
        <span className="text-muted-foreground">{label}</span>
        <span>{selected ? selected.label : anyLabel}</span>
      </summary>
      <ul
        aria-label={label}
        className="absolute z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl bg-card p-1 shadow-lift ring-1 ring-foreground/10"
      >
        <li>
          <Link
            href={hrefFor(undefined)}
            className="block rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {anyLabel}
          </Link>
        </li>
        {options.map((o) => (
          <li key={o.value}>
            <Link
              href={hrefFor(o.value)}
              aria-current={o.value === value ? "true" : undefined}
              className={
                o.value === value
                  ? "block rounded-lg bg-muted px-3 py-1.5 text-xs font-medium"
                  : "block rounded-lg px-3 py-1.5 text-xs hover:bg-muted"
              }
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
      <span className="sr-only" id={`${id}-help`} />
    </details>
  );
}
