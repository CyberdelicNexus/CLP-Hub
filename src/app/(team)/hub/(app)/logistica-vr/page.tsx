import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Headset, MapPin, Pencil, X } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { ClosingDialog } from "@/components/team/closing-dialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NoAccess } from "@/components/team/no-access";
import { ViewToggle } from "@/components/team/view-toggle";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEVICE_STATUSES,
  DEVICE_TRANSITIONS,
  INCIDENT_KINDS,
  needsAttention,
  type DeviceStatus,
} from "@/domain/logistics";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { toStudyLocal } from "@/lib/study-time";
import {
  countLogistics,
  listAllocations,
  listAvailableDevices,
  listDevices,
  listIncidents,
  listOpenAssignments,
  type AllocationRow,
  type AssignmentRow,
} from "@/services/logistics";
import { listHandoffTemplates, listVisitsFor } from "@/services/visits";
import { CohortWorkspace } from "../cohortes/cohort-workspace";
import { setHandoffVisitAction } from "../cohortes/plan-actions";
import { VisitDateForm } from "../cohortes/plan-forms";
import { DeviceLocationForm } from "./device-location-form";
import { DeviceMap, type DevicePin } from "./device-map";
import { HeadsetBoard } from "./headset-board";
import {
  AssignDeviceForm,
  CloseAssignmentForm,
  CreateDeviceForm,
  DeviceStatusForm,
  EditDeviceForm,
  MilestoneForm,
  RemoveDeviceButton,
  ReportIncidentForm,
  ResolveIncidentForm,
} from "./logistics-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("logistics") };
}

/**
 * VR logistics (Phase 6).
 *
 * Four tabs (D-143): the inventory first, where a headset is renamed, removed
 * or located; who has which headset, as a grid of people that moves left when
 * one is opened, like the cohorts, or as a board of device statuses; what has
 * gone wrong; and a map of the headsets, for those who may see where they are.
 *
 * A date booked here IS the person's S0 or POST visit, the same row the cohort's
 * cards edit, so the two cannot disagree. Booking one still moves no headset:
 * the hand-over and return are milestones a person records.
 *
 * NOTE ON NAMES (temporary, D-065): participant names are now shown next to
 * their code when the viewer holds `participants.contact.read`, reversing
 * D-038's blanket "codes only, even for an entitled viewer" rule for this
 * demo build. That rule existed because an operations screen listing
 * everyone's name is a re-identification surface for anyone who walks past a
 * shared monitor — this reversal is explicitly not a final decision.
 */
export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; cohorte?: string; participante?: string; modo?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("logistics.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("logistics.manage");
  const showNames = ctx.permissions.has("participants.contact.read");

  // Out with a participant a headset's location is their home, so it follows
  // contact access, and a viewer without it gets neither the place nor the map.
  const canSeeLocation = showNames;

  const params = await searchParams;
  const { vista } = params;
  const tab: Tab =
    vista === "asignacion" || vista === "incidencias" || (vista === "mapa" && canSeeLocation)
      ? vista
      : "inventario";
  const isBoard = params.modo === "kanban";

  // Assigning now happens on each participant's row of the allocation table,
  // so the separate "any cohort member" dropdown is gone.
  const [assignments, allocations, devices, incidents, counts, available, handoffTemplates] =
    await Promise.all([
      listOpenAssignments(ctx.study.id),
      listAllocations(ctx.study.id),
      listDevices(ctx.study.id),
      listIncidents(ctx.study.id, { openOnly: true }),
      countLogistics(ctx.study.id),
      canManage ? listAvailableDevices(ctx.study.id) : Promise.resolve([]),
      listHandoffTemplates(ctx.study.id),
    ]);

  const visits = await listVisitsFor(
    ctx.study.id,
    allocations.map((a) => a.participantId),
  );
  // The planned hand-over and pickup per participant, from their visits.
  const plannedBy = (handoff: "DELIVERY" | "PICKUP") =>
    new Map(visits.filter((v) => v.deviceHandoff === handoff).map((v) => [v.participantId, v.scheduledAt]));
  const plannedDelivery = plannedBy("DELIVERY");
  const plannedPickup = plannedBy("PICKUP");

  const cohortOptions = [...new Map(allocations.map((r) => [r.cohortId, r])).values()];
  const cohortFilter = cohortOptions.some((c) => c.cohortId === params.cohorte) ? params.cohorte : undefined;
  const shown = allocations.filter((r) => !cohortFilter || r.cohortId === cohortFilter);
  const selected = isBoard ? undefined : shown.find((r) => r.participantId === params.participante);
  const open = Boolean(selected);

  const page = `${TEAM_BASE_PATH}/logistica-vr`;
  const allocationHref = (over: { cohorte?: string; participante?: string; modo?: string }) => {
    const next = new URLSearchParams({ vista: "asignacion" });
    for (const [k, v] of Object.entries(over)) if (v) next.set(k, v);
    return `${page}?${next}`;
  };
  const displayName = (row: { participantCode: string; participantName: string | null }) =>
    showNames && row.participantName ? row.participantName : row.participantCode;

  const pins: DevicePin[] = canSeeLocation
    ? devices.flatMap((d) =>
        d.locationLat !== null && d.locationLng !== null
          ? [
              {
                id: d.id,
                lat: d.locationLat,
                lng: d.locationLng,
                title: d.assignedToCode ? `${d.code} · ${d.assignedToCode}` : d.code,
                subtitle: d.locationLabel,
              },
            ]
          : [],
      )
    : [];
  const unpinned = canSeeLocation ? devices.filter((d) => d.locationLat === null) : [];
  const assignmentById = new Map(assignments.map((a) => [a.assignment.id, a]));
  const allocated = new Set(allocations.map((a) => a.assignment?.id).filter(Boolean));
  // An open assignment whose participant is in no live cohort with sessions
  // still needs its return recorded; it is listed under the table.
  const orphanAssignments = assignments.filter((a) => !allocated.has(a.assignment.id));

  const errors = {
    forbidden: t("common.noAccess"),
    invalidCode: t("logistics.error.invalidCode"),
    invalid: t("logistics.error.invalid"),
    notFound: t("logistics.error.notFound"),
    duplicateCode: t("logistics.error.duplicateCode"),
    deviceNotAvailable: t("logistics.error.deviceNotAvailable"),
    deviceAlreadyOut: t("logistics.error.deviceAlreadyOut"),
    participantHasDevice: t("logistics.error.participantHasDevice"),
    notReturned: t("logistics.error.notReturned"),
    openIncidents: t("logistics.error.openIncidents"),
    descriptionTooLong: t("logistics.error.descriptionTooLong"),
    failed: t("logistics.error.failed"),
    notIndividual: t("cohorts.visits.error.notIndividual"),
    notMember: t("cohorts.visits.error.notMember"),
    notConfigured: t("logistics.error.notHandoff"),
    hasRecord: t("cohorts.visits.error.hasRecord"),
  };
  const base = {
    submit: t("common.save"),
    submitting: t("common.loading"),
    errors,
  };

  const statusOptions = (from: DeviceStatus) =>
    DEVICE_TRANSITIONS[from].map((s) => ({
      value: s,
      label: t(`logistics.deviceStatus.${s}`),
    }));

  const locationLabels = {
    location: t("logistics.location"),
    help: t("logistics.locationHelp"),
    mapHint: t("logistics.locationMapHint"),
    search: t("logistics.locationSearch"),
    searchHelp: t("logistics.locationSearchHelp"),
    searchNone: t("logistics.locationSearchNone"),
    searchFailed: t("logistics.locationSearchFailed"),
    searchShort: t("logistics.locationSearchShort"),
    searchPick: t("logistics.locationSearchPick"),
    clearPin: t("logistics.locationClearPin"),
    save: t("common.save"),
    saving: t("common.loading"),
    errors,
  };

  // What can be recorded next on an assignment: the milestones in order,
  // and closing once it is back.
  const assignmentActions = (a: AssignmentRow) => (
    <div className="flex flex-wrap gap-4 rounded-xl bg-muted/50 p-3">
                            {!a.assignment.handedOverAt ? (
                              <MilestoneForm
                                assignmentId={a.assignment.id}
                                milestone="HANDED_OVER"
                                statuses={statusOptions(a.deviceStatus)}
                                labels={{
                                  ...base,
                                  submit: t("logistics.recordHandOver"),
                                  status: t("logistics.newDeviceStatus"),
                                }}
                              />
                            ) : null}
                            {a.assignment.handedOverAt &&
                            !a.assignment.receivedAt ? (
                              <MilestoneForm
                                assignmentId={a.assignment.id}
                                milestone="RECEIVED"
                                statuses={statusOptions(a.deviceStatus)}
                                labels={{
                                  ...base,
                                  submit: t("logistics.recordReceipt"),
                                  status: t("logistics.newDeviceStatus"),
                                }}
                              />
                            ) : null}
                            {a.assignment.receivedAt &&
                            !a.assignment.returnedAt ? (
                              <MilestoneForm
                                assignmentId={a.assignment.id}
                                milestone="RETURNED"
                                statuses={statusOptions(a.deviceStatus)}
                                labels={{
                                  ...base,
                                  submit: t("logistics.recordReturn"),
                                  status: t("logistics.newDeviceStatus"),
                                }}
                              />
                            ) : null}

                            {a.assignment.returnedAt ? (
                              <CloseAssignmentForm
                                assignmentId={a.assignment.id}
                                labels={{
                                  ...base,
                                  submit: t("logistics.close"),
                                }}
                              />
                            ) : null}
                          </div>
  );

  // The menus beside the grid once a person is opened.
  const allocationDetail = (row: AllocationRow, closeHref: string) => {
    const a = row.assignment ? assignmentById.get(row.assignment.id) : undefined;
    const planned = (handoff: string) => (handoff === "DELIVERY" ? plannedDelivery : plannedPickup);
    const bookedVisit = (templateId: string) =>
      visits.find((v) => v.participantId === row.participantId && v.templateId === templateId);

    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="truncate">
                <Link
                  href={`${TEAM_BASE_PATH}/participantes/${row.participantId}`}
                  className="rounded underline-offset-4 hover:underline"
                >
                  {displayName(row)}
                </Link>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                <span data-numeric>{row.participantCode}</span> · {row.cohortCode} · {row.cohortName}
              </p>
            </div>
            <Link
              href={closeHref}
              scroll={false}
              aria-label={t("logistics.allParticipants")}
              title={t("logistics.allParticipants")}
              className="inline-flex shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("logistics.device")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {row.deviceCode && row.deviceStatus ? (
                <>
                  <span data-numeric className="text-sm font-semibold">
                    {row.deviceCode}
                  </span>
                  <StatusBadge tone={deviceTone(row.deviceStatus)}>
                    {t(`logistics.deviceStatus.${row.deviceStatus}`)}
                  </StatusBadge>
                  {a ? (
                    <>
                      <StatusBadge tone={needsAttention(a.step) ? "warning" : "neutral"}>
                        {t(`logistics.step.${a.step}`)}
                      </StatusBadge>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t("logistics.noHeadset")}</span>
              )}
            </div>
            {canManage && a ? assignmentActions(a) : null}
            {canManage && !row.assignment ? (
              <AssignDeviceForm
                devices={available.map((d) => ({
                  id: d.id,
                  label: d.model ? `${d.code} · ${d.model}` : d.code,
                }))}
                participants={[{ id: row.participantId, label: row.participantCode }]}
                labels={{
                  ...base,
                  submit: t("logistics.assign"),
                  device: t("logistics.device"),
                  participant: t("logistics.participant"),
                  expectedReturn: t("logistics.expectedReturn"),
                  expectedReturnHelp: t("logistics.expectedReturnHelp"),
                  noDevices: t("logistics.noAvailableDevices"),
                }}
              />
            ) : null}
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("logistics.dates")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("logistics.datesHelp")}</p>
            </div>
            {handoffTemplates.map((tpl) => {
              const visit = bookedVisit(tpl.id);
              const label = tpl.deviceHandoff === "DELIVERY" ? t("logistics.delivery") : t("logistics.pickup");
              const done = tpl.deviceHandoff === "DELIVERY" ? row.assignment?.handedOverAt : row.assignment?.returnedAt;
              return (
                <div key={tpl.id} className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {label} <span className="font-normal text-muted-foreground">· {tpl.code.toUpperCase()}</span>
                  </p>
                  {canManage ? (
                    <VisitDateForm
                      key={visit ? visit.scheduledAt.toISOString() : "none"}
                      cohortId={row.cohortId}
                      participantId={row.participantId}
                      templateId={tpl.id}
                      value={visit ? toStudyLocal(visit.scheduledAt, ctx.study.timezone) : ""}
                      saveAction={setHandoffVisitAction}
                      labels={{
                        when: label,
                        save: t("common.save"),
                        saved: t("cohorts.visits.saved"),
                        errors,
                      }}
                    />
                  ) : (
                    <p data-numeric className="text-sm text-muted-foreground">
                      {fmt(planned(tpl.deviceHandoff).get(row.participantId) ?? null, ctx.study.timezone)}
                    </p>
                  )}
                  {done ? (
                    <p data-numeric className="text-xs text-[var(--status-success-fg)]">
                      {fmt(done, ctx.study.timezone)} · {t("logistics.done")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>

          {canSeeLocation && row.deviceId ? (
            <section className="space-y-2 border-t border-border pt-4">
              {canManage ? (
                <DeviceLocationForm
                  // Starts over when the saved place changes, as on a return.
                  key={`${row.deviceId}:${row.locationLabel}:${row.locationLat}:${row.locationLng}`}
                  deviceId={row.deviceId}
                  location={{ label: row.locationLabel, lat: row.locationLat, lng: row.locationLng }}
                  labels={locationLabels}
                />
              ) : (
                <>
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("logistics.location")}
                  </h3>
                  <p className="text-sm">{row.locationLabel ?? "—"}</p>
                </>
              )}
            </section>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("nav.logistics")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("logistics.subtitle")}
        </p>
      </header>

      <section
        aria-label={t("logistics.summary")}
        className="grid gap-4 sm:grid-cols-3"
      >
        <Tile label={t("logistics.available")} value={counts.available} />
        <Tile label={t("logistics.out")} value={counts.out} />
        <Tile
          label={t("logistics.openIncidents")}
          value={counts.openIncidents}
          alert
        />
      </section>

      <nav aria-label={t("nav.logistics")} className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
        {(
          [
            ["inventario", t("logistics.tabInventory"), devices.length],
            ["asignacion", t("logistics.tabAllocation"), allocations.length],
            ["incidencias", t("logistics.tabIncidents"), incidents.length],
            ...(canSeeLocation ? ([["mapa", t("logistics.tabMap"), pins.length]] as const) : []),
          ] as const
        ).map(([key, label, n]) => (
          <Link
            key={key}
            href={key === "inventario" ? page : `${page}?vista=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span data-numeric className="text-xs opacity-70">
              {n}
            </span>
          </Link>
        ))}
      </nav>

      {tab === "asignacion" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label={t("logistics.cohort")} className="flex flex-wrap gap-2">
              <FilterChip
                href={allocationHref({ modo: params.modo })}
                active={!cohortFilter}
                label={t("logistics.allCohorts")}
              />
              {cohortOptions.map((c) => (
                <FilterChip
                  key={c.cohortId}
                  href={allocationHref({ cohorte: c.cohortId, modo: params.modo })}
                  active={cohortFilter === c.cohortId}
                  label={c.cohortCode}
                  title={c.cohortName}
                />
              ))}
            </nav>
            <ViewToggle
              current={isBoard ? "kanban" : "gallery"}
              hrefFor={(v) => allocationHref({ cohorte: cohortFilter, modo: v === "kanban" ? "kanban" : undefined })}
              labels={{ gallery: t("logistics.viewCards"), kanban: t("common.viewKanban") }}
            />
          </div>

          {allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("logistics.noAllocations")}</p>
          ) : isBoard ? (
            <HeadsetBoard
              rows={shown.map((row) => ({
                participantId: row.participantId,
                participantCode: row.participantCode,
                participantName: showNames ? row.participantName : null,
                cohortCode: row.cohortCode,
                deviceId: row.deviceId,
                deviceCode: row.deviceCode,
                deviceStatus: row.deviceStatus,
                href: allocationHref({ cohorte: cohortFilter, participante: row.participantId }),
              }))}
              readOnly={!canManage}
              statusLabels={
                Object.fromEntries(
                  DEVICE_STATUSES.map((st) => [st, t(`logistics.deviceStatus.${st}`)]),
                ) as Record<DeviceStatus, string>
              }
              noHeadset={t("logistics.noHeadset")}
              errorLabels={errors}
            />
          ) : (
            <CohortWorkspace
              open={open}
              layoutKey={`${selected?.participantId ?? "grid"}|${cohortFilter ?? "all"}`}
              detailKey={selected?.participantId ?? null}
              list={
                <ul
                  className={
                    open
                      ? "grid min-w-0 gap-2"
                      : "grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]"
                  }
                >
                  {shown.map((row) => {
                    const active = row.participantId === selected?.participantId;
                    const delivery = row.assignment?.handedOverAt ?? plannedDelivery.get(row.participantId) ?? null;
                    return (
                      <li key={row.participantId} className="min-w-0">
                        <Link
                          data-flip-id={row.participantId}
                          href={allocationHref({ cohorte: cohortFilter, participante: row.participantId })}
                          scroll={false}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "edge-glow flex min-w-0 flex-col rounded-2xl",
                            open ? "gap-2 p-3" : "min-h-36 gap-3 p-5 hover:-translate-y-0.5",
                            active
                              ? "card-accent"
                              : "bg-card shadow-soft ring-1 ring-foreground/10 transition-colors hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                              {row.participantCode}
                            </span>
                            <span data-numeric className="text-xs text-muted-foreground" title={row.cohortName}>
                              {row.cohortCode}
                            </span>
                          </div>
                          <p className={cn("truncate font-semibold", open ? "text-sm" : "text-lg tracking-tight")}>
                            {displayName(row)}
                          </p>
                          <div className="mt-auto flex flex-wrap items-center gap-1.5">
                            {row.deviceCode && row.deviceStatus ? (
                              <StatusBadge tone={deviceTone(row.deviceStatus)}>
                                <Headset className="size-3" aria-hidden />
                                <span data-numeric>{row.deviceCode}</span>
                                {" · "}
                                {t(`logistics.deviceStatus.${row.deviceStatus}`)}
                              </StatusBadge>
                            ) : (
                              <StatusBadge tone="neutral">{t("logistics.noHeadset")}</StatusBadge>
                            )}
                            {delivery && !open ? (
                              <span data-numeric className="text-xs text-muted-foreground">
                                {fmt(delivery, ctx.study.timezone)}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              }
              detail={
                selected ? allocationDetail(selected, allocationHref({ cohorte: cohortFilter })) : null
              }
            />
          )}

          {orphanAssignments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("logistics.otherAssignments")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {orphanAssignments.map((a) => (
                    <li key={a.assignment.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span data-numeric className="font-medium">
                          {a.deviceCode}
                        </span>
                        <Link
                          href={`${TEAM_BASE_PATH}/participantes/${a.participantId}`}
                          data-numeric
                          className="underline-offset-4 hover:underline"
                        >
                          {a.participantCode}
                        </Link>
                        <StatusBadge tone={deviceTone(a.deviceStatus)}>
                          {t(`logistics.deviceStatus.${a.deviceStatus}`)}
                        </StatusBadge>
                      </div>
                      {canManage ? assignmentActions(a) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "incidencias" ? (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{t("logistics.incidentsBoundary")}</p>

            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("logistics.noIncidents")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {incidents.map((i) => (
                  <li key={i.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge tone="warning">{t(`logistics.incidentKind.${i.kind}`)}</StatusBadge>
                      <span data-numeric className="text-sm font-medium">
                        {i.deviceCode}
                      </span>
                      {i.participantCode ? (
                        <span data-numeric className="text-xs text-muted-foreground">
                          {i.participantCode}
                        </span>
                      ) : null}
                      <span data-numeric className="text-xs text-muted-foreground">
                        {fmt(i.reportedAt, ctx.study.timezone)}
                      </span>
                    </div>
                    {i.description ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">{i.description}</p>
                    ) : null}
                    {canManage ? (
                      <ResolveIncidentForm
                        incidentId={i.id}
                        labels={{
                          ...base,
                          submit: t("logistics.resolve"),
                          resolution: t("logistics.resolution"),
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <div className="border-t border-border pt-4">
                <ReportIncidentForm
                  devices={devices.map((d) => ({
                    id: d.id,
                    label: d.assignedToCode ? `${d.code} · ${d.assignedToCode}` : d.code,
                    assignmentId: null,
                  }))}
                  labels={{
                    ...base,
                    submit: t("logistics.reportIncident"),
                    device: t("logistics.device"),
                    kind: t("logistics.incidentKindLabel"),
                    description: t("logistics.incidentDescription"),
                    descriptionHelp: t("logistics.incidentDescriptionHelp"),
                    kinds: INCIDENT_KINDS.map((k) => ({
                      value: k,
                      label: t(`logistics.incidentKind.${k}`),
                    })),
                  }}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === "mapa" ? (
        <div className="space-y-3">
          <DeviceMap pins={pins} label={t("logistics.tabMap")} />
          <p className="text-xs text-muted-foreground">{t("logistics.mapHelp")}</p>
          {unpinned.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("logistics.noPinTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {unpinned.map((d) => (
                    <li key={d.id} className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                      <span data-numeric className="font-medium">
                        {d.code}
                      </span>
                      {d.locationLabel ? <span className="text-muted-foreground"> · {d.locationLabel}</span> : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "inventario" ? (
        <Card>
          <CardContent className="space-y-4">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("logistics.noDevices")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {devices.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <span data-numeric className="font-medium">
                      {d.code}
                    </span>
                    {d.model ? <span className="text-sm text-muted-foreground">{d.model}</span> : null}
                    <StatusBadge tone={deviceTone(d.status)}>{t(`logistics.deviceStatus.${d.status}`)}</StatusBadge>
                    {d.assignedToCode ? (
                      <span data-numeric className="text-xs text-muted-foreground">
                        {d.assignedToCode}
                      </span>
                    ) : null}
                    {d.openIncidents > 0 ? (
                      <StatusBadge tone="critical">
                        {t("logistics.incidentCount", { count: d.openIncidents })}
                      </StatusBadge>
                    ) : null}
                    {canSeeLocation && d.locationLabel ? (
                      <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{d.locationLabel}</span>
                      </span>
                    ) : null}
                    {canManage ? (
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <DeviceStatusForm
                          deviceId={d.id}
                          options={statusOptions(d.status)}
                          labels={{
                            ...base,
                            submit: t("logistics.move"),
                            status: t("logistics.newDeviceStatus"),
                          }}
                        />
                        {/* Rename / correct, and remove (2026-10-28). */}
                        <ClosingDialog>
                          <DialogTrigger
                            render={
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                aria-label={`${t("logistics.edit")} ${d.code}`}
                                title={t("logistics.edit")}
                              />
                            }
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </DialogTrigger>
                          <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{t("logistics.editTitle")}</DialogTitle>
                            </DialogHeader>
                            <EditDeviceForm
                              key={`${d.code}:${d.model}:${d.serial}`}
                              device={{ id: d.id, code: d.code, model: d.model, serial: d.serial }}
                              labels={{
                                ...base,
                                code: t("logistics.deviceCode"),
                                model: t("logistics.model"),
                                serial: t("logistics.serial"),
                              }}
                            />
                            {canSeeLocation ? (
                              <div className="border-t border-border pt-3">
                                <DeviceLocationForm
                                  deviceId={d.id}
                                  location={{ label: d.locationLabel, lat: d.locationLat, lng: d.locationLng }}
                                  labels={locationLabels}
                                />
                              </div>
                            ) : null}
                          </DialogContent>
                        </ClosingDialog>
                        {d.assignedToCode ? null : (
                          <RemoveDeviceButton
                            deviceId={d.id}
                            labels={{
                              remove: t("logistics.remove"),
                              confirm: t("logistics.removeConfirm"),
                              errors,
                            }}
                          />
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <div className="space-y-2 border-t border-border pt-4">
                <CreateDeviceForm
                  labels={{
                    ...base,
                    submit: t("logistics.addDevice"),
                    code: t("logistics.deviceCode"),
                    model: t("logistics.model"),
                    serial: t("logistics.serial"),
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("logistics.codeHelp")}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <Card className="card-accent relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          data-numeric
          className={
            alert && value > 0
              ? "text-3xl font-semibold text-[var(--status-warning-fg)]"
              : "text-3xl font-semibold"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Colour by what the status means operationally, not by where it sits in the
 * cycle. MAINTENANCE is critical because the device cannot be used; everything
 * out with a participant is simply "in flight".
 */
function deviceTone(status: DeviceStatus): StatusTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "MAINTENANCE":
      return "critical";
    case "RETURN_REQUESTED":
    case "RETURN_IN_TRANSIT":
      return "warning";
    case "ACTIVE":
    case "DELIVERED":
      return "info";
    default:
      return "neutral";
  }
}

function fmt(value: Date | null, timeZone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeZone,
  }).format(value);
}

type Tab = "inventario" | "asignacion" | "incidencias" | "mapa";

function FilterChip({
  href,
  active,
  label,
  title,
}: {
  href: string;
  active: boolean;
  label: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      scroll={false}
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
