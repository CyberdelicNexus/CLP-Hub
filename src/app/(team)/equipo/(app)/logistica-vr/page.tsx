import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEVICE_TRANSITIONS,
  INCIDENT_KINDS,
  needsAttention,
  readinessNeedsAction,
  type DeviceStatus,
  type VrReadiness,
} from "@/domain/logistics";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listParticipants } from "@/services/participant-ops";
import {
  countLogistics,
  listAvailableDevices,
  listDevices,
  listIncidents,
  listOpenAssignments,
} from "@/services/logistics";
import {
  AssignDeviceForm,
  CloseAssignmentForm,
  CreateDeviceForm,
  DeviceStatusForm,
  MilestoneForm,
  ReadinessForm,
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
 * Three sections, in the order the work actually happens: what is out right now
 * and what it needs, what has gone wrong, and the inventory behind both.
 *
 * NOTE ON NAMES (temporary, D-065): participant names are now shown next to
 * their code when the viewer holds `participants.contact.read`, reversing
 * D-038's blanket "codes only, even for an entitled viewer" rule for this
 * demo build. That rule existed because an operations screen listing
 * everyone's name is a re-identification surface for anyone who walks past a
 * shared monitor — this reversal is explicitly not a final decision.
 */
export default async function LogisticsPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("logistics.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("logistics.manage");
  const showNames = ctx.permissions.has("participants.contact.read");

  const [assignments, devices, incidents, counts, available, participantRows] =
    await Promise.all([
      listOpenAssignments(ctx.study.id),
      listDevices(ctx.study.id),
      listIncidents(ctx.study.id, { openOnly: true }),
      countLogistics(ctx.study.id),
      canManage ? listAvailableDevices(ctx.study.id) : Promise.resolve([]),
      canManage
        ? // Codes only: `includeContact: false` regardless of permission, so no
          // name is fetched for a dropdown that does not need one.
          listParticipants(ctx.study.id, {
            includeContact: false,
            enrollment: "COHORT_ASSIGNED",
          })
        : Promise.resolve([]),
    ]);

  const errors = {
    forbidden: t("common.noAccess"),
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

      <Card>
        <CardContent className="p-0">
          <Accordion
            defaultValue={["out", "incidents", "inventory"]}
            multiple
            className="px-4"
          >
            {/* What is out, and what each one needs --------------------------- */}
            <AccordionItem value="out">
              <AccordionTrigger>
                <span className="flex flex-1 items-center gap-2">
                  {t("logistics.outTitle")}
                  <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-[oklch(0.2_0.02_265)]">
                    {assignments.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("logistics.noAssignments")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {assignments.map((a) => (
                      <li key={a.assignment.id} className="space-y-3 py-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span data-numeric className="font-medium">
                            {a.deviceCode}
                          </span>
                          <Link
                            href={`${TEAM_BASE_PATH}/participantes/${a.participantId}`}
                            className="rounded text-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {showNames && a.participantName ? (
                              <>
                                {a.participantName}{" "}
                                <span
                                  data-numeric
                                  className="text-muted-foreground"
                                >
                                  ({a.participantCode})
                                </span>
                              </>
                            ) : (
                              <span data-numeric>{a.participantCode}</span>
                            )}
                          </Link>
                          {a.cohortCode ? (
                            <span className="text-xs text-muted-foreground">
                              {a.cohortCode}
                            </span>
                          ) : null}
                          <StatusBadge tone={deviceTone(a.deviceStatus)}>
                            {t(`logistics.deviceStatus.${a.deviceStatus}`)}
                          </StatusBadge>
                          <StatusBadge
                            tone={readinessTone(a.assignment.readiness)}
                          >
                            {t(`logistics.readiness.${a.assignment.readiness}`)}
                          </StatusBadge>
                          <StatusBadge
                            tone={
                              needsAttention(a.step) ? "warning" : "neutral"
                            }
                          >
                            {t(`logistics.step.${a.step}`)}
                          </StatusBadge>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {t("logistics.responsible")}:{" "}
                            {a.responsibleName ?? t("care.unassigned")}
                          </span>
                          <span>
                            {t("logistics.handedOver")}:{" "}
                            {fmt(a.assignment.handedOverAt, ctx.study.timezone)}
                          </span>
                          <span>
                            {t("logistics.received")}:{" "}
                            {fmt(a.assignment.receivedAt, ctx.study.timezone)}
                          </span>
                          <span>
                            {t("logistics.expectedReturn")}:{" "}
                            {fmt(
                              a.assignment.expectedReturnAt,
                              ctx.study.timezone,
                            )}
                          </span>
                          <span>
                            {t("logistics.returned")}:{" "}
                            {fmt(a.assignment.returnedAt, ctx.study.timezone)}
                          </span>
                        </div>

                        {canManage ? (
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

                            <ReadinessForm
                              assignmentId={a.assignment.id}
                              options={[
                                "READY",
                                "NOT_READY",
                                "NEEDS_SUPPORT",
                              ].map((r) => ({
                                value: r,
                                label: t(`logistics.readiness.${r}`),
                              }))}
                              labels={{
                                ...base,
                                submit: t("logistics.reportReadiness"),
                                readiness: t("logistics.setupStatus"),
                              }}
                            />

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
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage ? (
                  <div className="border-t border-border pt-4">
                    <AssignDeviceForm
                      devices={available.map((d) => ({
                        id: d.id,
                        label: d.model ? `${d.code} · ${d.model}` : d.code,
                      }))}
                      participants={participantRows.map((p) => ({
                        id: p.id,
                        label: p.code,
                      }))}
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
                  </div>
                ) : null}
              </AccordionPanel>
            </AccordionItem>

            {/* Incidents ------------------------------------------------------ */}
            <AccordionItem value="incidents">
              <AccordionTrigger>
                <span className="flex flex-1 items-center gap-2">
                  {t("logistics.incidents")}
                  {incidents.length > 0 ? (
                    <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-[oklch(0.2_0.02_265)]">
                      {incidents.length}
                    </span>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("logistics.incidentsBoundary")}
                </p>

                {incidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("logistics.noIncidents")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {incidents.map((i) => (
                      <li key={i.id} className="space-y-2 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <StatusBadge tone="warning">
                            {t(`logistics.incidentKind.${i.kind}`)}
                          </StatusBadge>
                          <span data-numeric className="text-sm font-medium">
                            {i.deviceCode}
                          </span>
                          {i.participantCode ? (
                            <span
                              data-numeric
                              className="text-xs text-muted-foreground"
                            >
                              {i.participantCode}
                            </span>
                          ) : null}
                          <span
                            data-numeric
                            className="text-xs text-muted-foreground"
                          >
                            {fmt(i.reportedAt, ctx.study.timezone)}
                          </span>
                        </div>
                        {i.description ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {i.description}
                          </p>
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
                        label: d.assignedToCode
                          ? `${d.code} · ${d.assignedToCode}`
                          : d.code,
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
              </AccordionPanel>
            </AccordionItem>

            {/* Inventory ------------------------------------------------------ */}
            <AccordionItem value="inventory">
              <AccordionTrigger>
                <span className="flex flex-1 items-center gap-2">
                  {t("logistics.inventory")}
                  <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-[oklch(0.2_0.02_265)]">
                    {devices.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionPanel>
                {devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("logistics.noDevices")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {devices.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                      >
                        <span data-numeric className="font-medium">
                          {d.code}
                        </span>
                        {d.model ? (
                          <span className="text-sm text-muted-foreground">
                            {d.model}
                          </span>
                        ) : null}
                        <StatusBadge tone={deviceTone(d.status)}>
                          {t(`logistics.deviceStatus.${d.status}`)}
                        </StatusBadge>
                        {d.assignedToCode ? (
                          <span
                            data-numeric
                            className="text-xs text-muted-foreground"
                          >
                            {d.assignedToCode}
                          </span>
                        ) : null}
                        {d.openIncidents > 0 ? (
                          <StatusBadge tone="critical">
                            {t("logistics.incidentCount", {
                              count: d.openIncidents,
                            })}
                          </StatusBadge>
                        ) : null}
                        {canManage ? (
                          <div className="ml-auto">
                            <DeviceStatusForm
                              deviceId={d.id}
                              options={statusOptions(d.status)}
                              labels={{
                                ...base,
                                submit: t("logistics.move"),
                                status: t("logistics.newDeviceStatus"),
                              }}
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage ? (
                  <div className="border-t border-border pt-4">
                    <CreateDeviceForm
                      labels={{
                        ...base,
                        submit: t("logistics.addDevice"),
                        code: t("logistics.deviceCode"),
                        model: t("logistics.model"),
                        serial: t("logistics.serial"),
                      }}
                    />
                  </div>
                ) : null}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
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

function readinessTone(readiness: VrReadiness): StatusTone {
  if (readiness === "READY") return "success";
  // NEEDS_SUPPORT is a warning rather than an error: someone asked for help,
  // which is the system working, not failing.
  return readinessNeedsAction(readiness) ? "warning" : "neutral";
}

function fmt(value: Date | null, timeZone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeZone,
  }).format(value);
}
