import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Headset, HousePlus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DeviceHandoff } from "@/domain/session";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { toStudyLocal } from "@/lib/study-time";
import type { Consent, InitialVisit, ParticipantVisit } from "@/db/schema";
import type { AllocationRow } from "@/services/logistics";
import type { ResponsibleRow } from "@/services/participant-care";
import { PhysicalConsentCheck, type ScopeOption } from "../participantes/participant-forms";
import { CareDetails } from "../participantes/[id]/care-panel";
import { VisitDateForm, VisitQuestionnaireCheck } from "./plan-forms";

/**
 * An INDIVIDUAL session's schedule (D-136, cards from D-139): one card per
 * member with their own date and time — S0's home visit, the POST pickup — and
 * the checklist this session is configured to collect there. The session that
 * is the initial visit also opens its responsible, place, notes and outcome in
 * a modal (D-140); the date on the card is that visit's date.
 *
 * When the session hands the headset over or back, each card also shows which
 * headset that person has and where it is, linking to VR logistics, where the
 * actual hand-over and return are recorded. Setting a date never moves a device.
 */
export async function IndividualVisits({
  cohortId,
  templateId,
  deviceHandoff,
  members,
  visits,
  allocations,
  canManage,
  showNames,
  timeZone,
  physicalConsent,
  collectsQuestionnaire,
  initialVisit,
}: {
  cohortId: string;
  templateId: string;
  deviceHandoff: DeviceHandoff;
  members: { participantId: string; code: string; fullName: string | null }[];
  visits: ParticipantVisit[];
  /** Null when the viewer cannot read logistics. */
  allocations: Map<string, AllocationRow> | null;
  canManage: boolean;
  showNames: boolean;
  timeZone: string;
  /** Null when this visit does not collect it or this cohort's arm does not sign one. */
  physicalConsent: { consents: Map<string, Consent>; scopes: ScopeOption[]; canManage: boolean } | null;
  collectsQuestionnaire: boolean;
  /** Null when this session is not the initial visit, or the viewer cannot read it. */
  initialVisit: {
    visits: Map<string, InitialVisit[]>;
    responsibles: Map<string, ResponsibleRow[]>;
    candidates: { id: string; displayName: string }[];
    canManage: boolean;
  } | null;
}) {
  const t = await getTranslations();
  const byParticipant = new Map(visits.filter((v) => v.templateId === templateId).map((v) => [v.participantId, v]));
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(d);
  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("cohorts.visits.error.invalid"),
    notFound: t("cohorts.error.notFound"),
    notIndividual: t("cohorts.visits.error.notIndividual"),
    notMember: t("cohorts.visits.error.notMember"),
    notBooked: t("cohorts.visits.error.notBooked"),
    notConfigured: t("cohorts.visits.error.notConfigured"),
    hasRecord: t("cohorts.visits.error.hasRecord"),
    failed: t("cohorts.error.failed"),
  };
  const consentErrors = {
    forbidden: t("common.noAccess"),
    invalid: t("participants.error.invalid"),
    notFound: t("participants.error.notFound"),
    unknownScope: t("participants.error.unknownScope"),
    scopesNotAllowed: t("participants.error.scopesNotAllowed"),
    failed: t("participants.error.failed"),
  };

  const careBase = {
    submit: t("common.save"),
    submitting: t("common.loading"),
    errors: {
      forbidden: t("common.noAccess"),
      invalid: t("participants.error.invalid"),
      notFound: t("participants.error.notFound"),
      notesTooLong: t("care.error.notesTooLong"),
      visitAlreadyOpen: t("care.error.visitAlreadyOpen"),
      failed: t("participants.error.failed"),
    },
  };

  if (members.length === 0) {
    return <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{t("cohorts.visits.noMembers")}</p>;
  }

  return (
    <div className="space-y-2 rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">
        {deviceHandoff === "DELIVERY"
          ? t("cohorts.visits.helpDelivery")
          : deviceHandoff === "PICKUP"
            ? t("cohorts.visits.helpPickup")
            : t("cohorts.visits.help")}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => {
          const visit = byParticipant.get(m.participantId);
          const alloc = allocations?.get(m.participantId);
          const consent = physicalConsent?.consents.get(m.participantId);
          const latestVisit = initialVisit?.visits.get(m.participantId)?.[0] ?? null;
          const leads = initialVisit?.responsibles.get(m.participantId) ?? [];
          return (
            <li key={m.participantId} className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  href={`${TEAM_BASE_PATH}/participantes/${m.participantId}`}
                  className="min-w-0 truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {showNames && m.fullName ? (
                    <>
                      {m.fullName}{" "}
                      <span data-numeric className="font-normal text-muted-foreground">
                        ({m.code})
                      </span>
                    </>
                  ) : (
                    <span data-numeric>{m.code}</span>
                  )}
                </Link>

                {deviceHandoff !== "NONE" && allocations ? (
                  <Link
                    href={`${TEAM_BASE_PATH}/logistica-vr?vista=asignacion&participante=${m.participantId}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title={t("nav.logistics")}
                  >
                    <Headset className="size-3.5" aria-hidden />
                    {alloc?.deviceCode ? (
                      <>
                        <span data-numeric className="font-medium text-foreground">
                          {alloc.deviceCode}
                        </span>
                        {alloc.deviceStatus ? (
                          <StatusBadge tone="neutral">{t(`logistics.deviceStatus.${alloc.deviceStatus}`)}</StatusBadge>
                        ) : null}
                      </>
                    ) : (
                      t("logistics.noHeadset")
                    )}
                  </Link>
                ) : null}
              </div>

              {canManage ? (
                <VisitDateForm
                  cohortId={cohortId}
                  participantId={m.participantId}
                  templateId={templateId}
                  value={visit ? toStudyLocal(visit.scheduledAt, timeZone) : ""}
                  labels={{
                    when: t("cohorts.visits.when"),
                    save: t("common.save"),
                    saved: t("cohorts.visits.saved"),
                    errors,
                  }}
                />
              ) : (
                <span data-numeric className="text-sm text-muted-foreground">
                  {visit ? fmt(visit.scheduledAt) : t("sessions.notScheduled")}
                </span>
              )}

              {physicalConsent || collectsQuestionnaire ? (
                <div className="space-y-2 border-t border-border pt-2.5">
                  {physicalConsent ? (
                    <PhysicalConsentCheck
                      key={consent?.id ?? "unsigned"}
                      participantId={m.participantId}
                      signed={
                        consent
                          ? {
                              dateLabel: consent.decidedAt ? fmt(consent.decidedAt) : "",
                              scopes: physicalConsent.scopes
                                .filter((sc) => consent.grantedScopes.includes(sc.code))
                                .map((sc) => sc.label),
                            }
                          : null
                      }
                      scopes={physicalConsent.scopes}
                      canManage={physicalConsent.canManage}
                      labels={{
                        check: t("participants.physicalConsent.check"),
                        scopes: t("participants.physicalConsent.scopes"),
                        save: t("common.save"),
                        undo: t("participants.physicalConsent.undo"),
                        errors: consentErrors,
                      }}
                    />
                  ) : null}
                  {collectsQuestionnaire ? (
                    <VisitQuestionnaireCheck
                      participantId={m.participantId}
                      templateId={templateId}
                      capturedLabel={visit?.questionnaireCapturedAt ? fmt(visit.questionnaireCapturedAt) : null}
                      booked={Boolean(visit)}
                      canManage={canManage}
                      labels={{
                        check: t("cohorts.visits.questionnaire"),
                        needsDate: t("cohorts.visits.questionnaireNeedsDate"),
                        errors,
                      }}
                    />
                  ) : null}
                </div>
              ) : null}

              {initialVisit ? (
                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border pt-2.5">
                  <Dialog>
                    <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5 rounded-lg" />}>
                      <HousePlus className="size-3.5" aria-hidden />
                      {t("care.visit")}
                    </DialogTrigger>
                    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>
                          {t("care.title")} · <span data-numeric>{m.code}</span>
                        </DialogTitle>
                      </DialogHeader>
                      <CareDetails
                        participantId={m.participantId}
                        responsibles={leads}
                        visits={initialVisit.visits.get(m.participantId) ?? []}
                        candidates={initialVisit.candidates}
                        canManage={initialVisit.canManage}
                        timezone={timeZone}
                        formBase={careBase}
                        visitFormsOpen
                      />
                    </DialogContent>
                  </Dialog>
                  {latestVisit ? (
                    <StatusBadge tone="neutral">{t(`care.visitStatus.${latestVisit.status}`)}</StatusBadge>
                  ) : null}
                  {leads.length > 0 ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {leads.map((r) => r.displayName).join(" · ")}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
