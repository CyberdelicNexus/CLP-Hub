import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import {
  ConsentBadge,
  EligibilityBadge,
  EnrollmentBadge,
  ScreeningBadge,
} from "@/components/team/participant-status-badge";
import { RecruitmentStatusBadge } from "@/components/team/application-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isActiveConsent, type ConsentStatus } from "@/domain/consent";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { ENROLLMENT_TRANSITIONS } from "@/domain/participant-state";
import { getParticipantDetail } from "@/services/participant-ops";
import {
  getParticipantPlacement,
  listAssignableCohorts,
  listStudyArms,
} from "@/services/cohorts";
import {
  AssignCohortForm,
  RecordRandomizationForm,
  RemoveFromCohortForm,
} from "../../cohortes/cohort-forms";
import {
  CloseScreeningForm,
  CompleteScreeningForm,
  ConsentDecisionForm,
  EnrollmentForm,
  ScheduleScreeningForm,
  StartConsentForm,
} from "../participant-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("participants");
  return { title: t("detailTitle") };
}

/**
 * One participant: state, contact, screening history and consent history.
 *
 * Each panel is gated by its own permission, so a RESEARCHER sees screening and
 * consent status without contact details, while LOGISTICS sees contact details
 * without either. No screening content is displayed because none is stored.
 */
export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("participants.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { id } = await params;
  const includeContact = ctx.permissions.has("participants.contact.read");
  const includeScreening = ctx.permissions.has("screening.read");
  const includeConsent = ctx.permissions.has("consent.read");

  const detail = await getParticipantDetail(ctx.study.id, id, {
    includeContact,
    includeScreening,
    includeConsent,
  });
  if (!detail) notFound();

  const canManageScreening = ctx.permissions.has("screening.manage");
  const canManageConsent = ctx.permissions.has("consent.manage");
  const canManageParticipant = ctx.permissions.has("participants.manage");
  const canReadRandomization = ctx.permissions.has("randomization.read");
  const canManageRandomization = ctx.permissions.has("randomization.manage");
  const canManageCohorts = ctx.permissions.has("cohorts.manage");

  const placement = canReadRandomization || ctx.permissions.has("cohorts.read")
    ? await getParticipantPlacement(ctx.study.id, id)
    : null;
  const arms = canManageRandomization && !placement?.randomization ? await listStudyArms(ctx.study.id) : [];
  const assignableCohorts =
    canManageCohorts && !placement?.cohort
      ? await listAssignableCohorts(ctx.study.id, { scope: ctx.cohortScope })
      : [];

  const { participant, contact, screenings, consents } = detail;
  const openScreening = screenings.find((s) => s.status === "SCHEDULED");
  const activeConsent = consents.find((c) => isActiveConsent(c.status as ConsentStatus));

  const errorLabels = {
    forbidden: t("common.noAccess"),
    invalid: t("participants.error.invalid"),
    badReference: t("participants.error.badReference"),
    duplicateCode: t("cohorts.error.duplicateCode"),
    alreadyRandomized: t("cohorts.error.alreadyRandomized"),
    alreadyAssigned: t("cohorts.error.alreadyAssigned"),
    cohortClosed: t("cohorts.error.cohortClosed"),
    notFound: t("participants.error.notFound"),
    failed: t("participants.error.failed"),
  };
  const formBase = { submit: t("common.save"), submitting: t("common.loading"), errors: errorLabels };

  const enrollmentOptions = (
    participant.enrollmentStatus
      ? ENROLLMENT_TRANSITIONS[participant.enrollmentStatus].filter(
          (s) => s === "WITHDRAWN" || s === "COMPLETED",
        )
      : []
  ).map((s) => ({ value: s, label: t(`participants.enrollmentAction.${s}`) }));

  return (
    <div className="space-y-6">
      <Link
        href={`${TEAM_BASE_PATH}/participantes`}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("participants.backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {participant.code}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("participants.detailTitle")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RecruitmentStatusBadge
            status={participant.recruitmentStatus}
            label={t(`applications.recruitment.${participant.recruitmentStatus}`)}
          />
          <EligibilityBadge
            status={participant.eligibilityStatus}
            label={t(`participants.eligibility.${participant.eligibilityStatus}`)}
          />
          {participant.enrollmentStatus ? (
            <EnrollmentBadge
              status={participant.enrollmentStatus}
              label={t(`participants.enrollment.${participant.enrollmentStatus}`)}
            />
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Screening ------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>{t("participants.screening")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!includeScreening ? (
                <p className="text-sm text-muted-foreground">{t("participants.screeningHidden")}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t("participants.screeningBoundary")}</p>

                  {screenings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("participants.noScreenings")}</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {screenings.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                          <ScreeningBadge
                            status={s.status}
                            label={t(`participants.screeningStatus.${s.status}`)}
                          />
                          <span data-numeric className="text-sm text-muted-foreground">
                            {s.scheduledAt
                              ? formatDate(s.scheduledAt, ctx.study.timezone)
                              : formatDate(s.createdAt, ctx.study.timezone)}
                          </span>
                          {s.result ? (
                            <EligibilityBadge
                              status={s.result}
                              label={t(`participants.eligibility.${s.result}`)}
                            />
                          ) : null}
                          {s.externalRecordId ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {s.externalRecordId}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canManageScreening ? (
                    openScreening ? (
                      <div className="space-y-4 rounded-xl bg-muted/50 p-4">
                        <CompleteScreeningForm
                          participantId={participant.id}
                          screeningId={openScreening.id}
                          results={["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED", "WAITLIST"].map((r) => ({
                            value: r,
                            label: t(`participants.eligibility.${r}`),
                          }))}
                          labels={{
                            ...formBase,
                            submit: t("participants.recordResult"),
                            result: t("participants.result"),
                            reference: t("participants.externalRef"),
                            referenceHelp: t("participants.externalRefHelp"),
                          }}
                        />
                        <CloseScreeningForm
                          participantId={participant.id}
                          screeningId={openScreening.id}
                          options={["NO_SHOW", "CANCELLED"].map((s) => ({
                            value: s,
                            label: t(`participants.screeningAction.${s}`),
                          }))}
                          labels={formBase}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl bg-muted/50 p-4">
                        <ScheduleScreeningForm
                          participantId={participant.id}
                          labels={{
                            ...formBase,
                            submit: t("participants.scheduleScreening"),
                            when: t("participants.when"),
                          }}
                        />
                      </div>
                    )
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {/* Consent -------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>{t("participants.consent")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!includeConsent ? (
                <p className="text-sm text-muted-foreground">{t("participants.consentHidden")}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t("participants.consentBoundary")}</p>

                  {consents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("participants.noConsents")}</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {consents.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                          <ConsentBadge
                            status={c.status}
                            label={t(`participants.consentStatus.${c.status}`)}
                          />
                          <span className="text-sm font-medium">{c.versionLabel}</span>
                          <span data-numeric className="text-sm text-muted-foreground">
                            {c.decidedAt
                              ? formatDate(c.decidedAt, ctx.study.timezone)
                              : formatDate(c.createdAt, ctx.study.timezone)}
                          </span>
                          {c.externalRecordId ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {c.externalRecordId}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canManageConsent ? (
                    <div className="space-y-4 rounded-xl bg-muted/50 p-4">
                      {activeConsent && activeConsent.status === "PENDING" ? (
                        <ConsentDecisionForm
                          participantId={participant.id}
                          consentId={activeConsent.id}
                          options={["CONSENTED", "DECLINED"].map((s) => ({
                            value: s,
                            label: t(`participants.consentAction.${s}`),
                          }))}
                          labels={{ ...formBase, reference: t("participants.externalRef") }}
                        />
                      ) : null}
                      {activeConsent && activeConsent.status === "CONSENTED" ? (
                        <ConsentDecisionForm
                          participantId={participant.id}
                          consentId={activeConsent.id}
                          options={[
                            { value: "WITHDRAWN", label: t("participants.consentAction.WITHDRAWN") },
                          ]}
                          labels={{ ...formBase, reference: t("participants.externalRef") }}
                        />
                      ) : null}
                      <StartConsentForm
                        participantId={participant.id}
                        labels={{
                          ...formBase,
                          submit: activeConsent
                            ? t("participants.startNewConsent")
                            : t("participants.startConsent"),
                          version: t("participants.consentVersion"),
                          versionHelp: t("participants.consentVersionHelp"),
                        }}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar ---------------------------------------------------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("applications.contact")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!includeContact ? (
                <p className="text-sm text-muted-foreground">{t("applications.contactHidden")}</p>
              ) : (
                <dl className="space-y-3 text-sm">
                  <Field label={t("applications.field.name")} value={contact?.fullName} />
                  <Field label={t("applications.field.email")} value={contact?.email} />
                  <Field label={t("applications.field.phone")} value={contact?.phone} />
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Allocation and cohort placement (Phase 3a) ------------------- */}
          {placement ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("cohorts.placement")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canReadRandomization ? (
                  placement.randomization ? (
                    <dl className="space-y-1 text-sm">
                      <dt className="text-xs text-muted-foreground">{t("cohorts.arm")}</dt>
                      <dd className="font-medium">
                        {placement.randomization.armCode} · {placement.randomization.armName}
                      </dd>
                      <dd data-numeric className="text-xs text-muted-foreground">
                        {formatDate(placement.randomization.allocatedAt, ctx.study.timezone)}
                      </dd>
                      {placement.randomization.externalRecordId ? (
                        <dd className="font-mono text-xs text-muted-foreground">
                          {placement.randomization.externalRecordId}
                        </dd>
                      ) : null}
                    </dl>
                  ) : canManageRandomization && arms.length > 0 ? (
                    <RecordRandomizationForm
                      participantId={participant.id}
                      arms={arms.map((a) => ({ id: a.id, label: `${a.code} · ${a.nameEs}` }))}
                      labels={{
                        ...formBase,
                        submit: t("cohorts.recordAllocation"),
                        arm: t("cohorts.arm"),
                        when: t("cohorts.allocatedAt"),
                        reference: t("participants.externalRef"),
                        boundary: t("cohorts.allocationBoundary"),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("cohorts.noAllocation")}</p>
                  )
                ) : null}

                <div className="border-t border-border pt-4">
                  {placement.cohort ? (
                    <div className="space-y-2">
                      <Link
                        href={`${TEAM_BASE_PATH}/cohortes/${placement.cohort.id}`}
                        className="rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {placement.cohort.code} · {placement.cohort.name}
                      </Link>
                      {canManageCohorts ? (
                        <RemoveFromCohortForm
                          participantId={participant.id}
                          labels={{ ...formBase, submit: t("cohorts.removeFromCohort") }}
                        />
                      ) : null}
                    </div>
                  ) : canManageCohorts ? (
                    <AssignCohortForm
                      participantId={participant.id}
                      cohorts={assignableCohorts.map((c) => ({
                        id: c.id,
                        label: `${c.code} · ${c.name}`,
                      }))}
                      labels={{
                        ...formBase,
                        submit: t("cohorts.assignToCohort"),
                        cohort: t("nav.cohorts"),
                        none: t("cohorts.noneAssignable"),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("cohorts.noCohort")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {canManageParticipant && enrollmentOptions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("participants.enrollmentTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <EnrollmentForm
                  participantId={participant.id}
                  options={enrollmentOptions}
                  labels={formBase}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value ?? "—"}</dd>
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    value,
  );
}
