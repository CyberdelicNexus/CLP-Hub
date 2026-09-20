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
import {
  CONSENT_TYPES,
  isActiveConsent,
  missingConsentTypes,
  type ConsentStatus,
} from "@/domain/consent";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { NextStepBadge } from "@/components/team/next-step-badge";
import { nextStep, outstandingSteps } from "@/domain/next-step";
import { ENROLLMENT_TRANSITIONS } from "@/domain/participant-state";
import {
  listInitialVisits,
  listResponsibleCandidates,
  listResponsibles,
} from "@/services/participant-care";
import { AuditPanel } from "./audit-panel";
import { CarePanel } from "./care-panel";
import {
  describeScopes,
  getParticipantDetail,
  listConsentScopes,
  listEligibilityReasons,
} from "@/services/participant-ops";
import {
  getParticipantPlacement,
  listAssignableCohorts,
  listStudyArms,
} from "@/services/cohorts";
import {
  AssignCohortForm,
  RecordRandomizationForm,
  RemoveFromCohortForm,
  TransferCohortForm,
} from "../../cohortes/cohort-forms";
import {
  CloseScreeningForm,
  CompleteScreeningForm,
  ConsentDecisionForm,
  ContactField,
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
  // Loaded for anyone who may see screening at all, not only for someone who can
  // record one: the list is configuration, and a viewer needs it to read the
  // reason on a determination that was already made.
  const reasons = includeScreening ? await listEligibilityReasons(ctx.study.id) : [];
  // Loaded for any consent viewer: a recorded authorization must still read as
  // words once the scope that named it has been retired.
  const scopes = includeConsent ? await listConsentScopes(ctx.study.id) : [];

  // Responsibles and the initial visit are operational, so they follow
  // participants.read rather than a permission of their own. Naming a
  // responsible grants no visibility, so there is nothing extra to gate.
  const [responsibles, visits, responsibleCandidates] = await Promise.all([
    listResponsibles(id),
    listInitialVisits(id),
    ctx.permissions.has("participants.manage")
      ? listResponsibleCandidates(ctx.study.id)
      : Promise.resolve([]),
  ]);
  const canManageConsent = ctx.permissions.has("consent.manage");
  const canManageParticipant = ctx.permissions.has("participants.manage");
  const canReadRandomization = ctx.permissions.has("randomization.read");
  const canManageRandomization = ctx.permissions.has("randomization.manage");
  const canManageCohorts = ctx.permissions.has("cohorts.manage");

  const placement = canReadRandomization || ctx.permissions.has("cohorts.read")
    ? await getParticipantPlacement(ctx.study.id, id)
    : null;
  const arms = canManageRandomization && !placement?.randomization ? await listStudyArms(ctx.study.id) : [];
  // Loaded whether or not the participant is already in a cohort: an existing
  // member needs the list to be moved to another one.
  const assignableCohorts = canManageCohorts
    ? await listAssignableCohorts(ctx.study.id, { scope: ctx.cohortScope })
    : [];

  const { participant, contact, screenings, consents } = detail;
  const openScreening = screenings.find((s) => s.status === "SCHEDULED");
  /**
   * One active consent PER TYPE now (D-032): digital and physical are two
   * decisions made at two moments, and both can be in force at once.
   */
  const activeConsents = CONSENT_TYPES.map((type) => ({
    type,
    consent: consents.find(
      (c) => c.consentType === type && isActiveConsent(c.status as ConsentStatus),
    ),
  })).filter((e) => e.consent);

  // What the study configured as required, minus what is recorded. Advisory
  // only: nothing here refuses an action because a consent is missing.
  const missingConsents = includeConsent
    ? missingConsentTypes({
        requiresPhysical: placement?.randomization?.requiresPhysicalConsent ?? null,
        activeTypes: activeConsents
          .filter((e) => e.consent?.status === "CONSENTED")
          .map((e) => e.type),
      })
    : [];

  /**
   * The next MISSING RECORD, not a judgement about the person. The domain
   * enforces that distinction; see src/domain/next-step.ts.
   *
   * Screening and consent are gated by their own permissions, so a viewer
   * without them would compute a next step from a partial picture and be told
   * something false. It is therefore computed only when both are visible.
   */
  const canSeeWholePicture = includeScreening && includeConsent;
  const snapshot = canSeeWholePicture
    ? {
        enrollmentStatus: participant.enrollmentStatus,
        hasScreeningResult: screenings.some((sc) => sc.result !== null),
        hasOpenScreening: Boolean(openScreening),
        activeConsentTypes: activeConsents
          .filter((e) => e.consent?.status === "CONSENTED")
          .map((e) => e.type),
        requiresPhysicalConsent: placement?.randomization?.requiresPhysicalConsent ?? null,
        hasAllocation: Boolean(placement?.randomization),
        hasCohort: Boolean(placement?.cohort),
        initialVisitStatus: visits[0]?.status ?? null,
        hasInitialSessionResponsible: responsibles.some((r) => r.role === "INITIAL_SESSION"),
      }
    : null;
  const step = snapshot ? nextStep(snapshot) : null;
  const outstanding = snapshot ? outstandingSteps(snapshot) : [];

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
    visitAlreadyOpen: t("care.error.visitAlreadyOpen"),
    notesTooLong: t("care.error.notesTooLong"),
    armMismatch: t("cohorts.error.armMismatch"),
    armNotRecorded: t("cohorts.error.armNotRecorded"),
    sameCohort: t("cohorts.error.sameCohort"),
    duplicateEmail: t("participants.error.duplicateEmail"),
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
          {step ? <NextStepBadge step={step} label={t(`nextStep.${step}`)} /> : null}
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
                          {s.reasonId ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {reasonLabel(reasons, s.reasonId)}
                            </span>
                          ) : null}
                          {s.reasonNote ? (
                            <span className="text-xs text-muted-foreground italic">
                              {s.reasonNote}
                            </span>
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
                          reasons={reasons
                            .filter((r) => r.active)
                            .map((r) => ({
                              id: r.id,
                              label: r.labelEs,
                              appliesTo: [...r.appliesTo],
                            }))}
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

                  {missingConsents.length > 0 ? (
                    <p
                      role="status"
                      className="rounded-xl bg-surface-peach px-4 py-3 text-xs leading-relaxed text-surface-peach-ink"
                    >
                      {t("participants.consentMissing", {
                        types: missingConsents
                          .map((ty) => t(`participants.consentType.${ty}`))
                          .join(", "),
                      })}
                    </p>
                  ) : null}

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
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                            {t(`participants.consentType.${c.consentType}`)}
                          </span>
                          <span className="text-sm font-medium">{c.versionLabel}</span>
                          <span data-numeric className="text-sm text-muted-foreground">
                            {c.decidedAt
                              ? formatDate(c.decidedAt, ctx.study.timezone)
                              : formatDate(c.createdAt, ctx.study.timezone)}
                          </span>
                          {c.grantedScopes.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {describeScopes(scopes, c.grantedScopes).join(" · ")}
                            </span>
                          ) : null}
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
                      {/*
                        One decision form per consent in force, labelled by type,
                        so recording the physical signature cannot be mistaken for
                        acting on the digital one.
                      */}
                      {activeConsents.map(({ type, consent }) =>
                        consent && consent.status === "PENDING" ? (
                          <div key={consent.id} className="space-y-2">
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                              {t(`participants.consentType.${type}`)}
                            </p>
                            <ConsentDecisionForm
                              participantId={participant.id}
                              consentId={consent.id}
                              options={["CONSENTED", "DECLINED"].map((st) => ({
                                value: st,
                                label: t(`participants.consentAction.${st}`),
                              }))}
                              labels={{ ...formBase, reference: t("participants.externalRef") }}
                            />
                          </div>
                        ) : consent && consent.status === "CONSENTED" ? (
                          <div key={consent.id} className="space-y-2">
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                              {t(`participants.consentType.${type}`)}
                            </p>
                            <ConsentDecisionForm
                              participantId={participant.id}
                              consentId={consent.id}
                              options={[
                                {
                                  value: "WITHDRAWN",
                                  label: t("participants.consentAction.WITHDRAWN"),
                                },
                              ]}
                              labels={{ ...formBase, reference: t("participants.externalRef") }}
                            />
                          </div>
                        ) : null,
                      )}

                      <StartConsentForm
                        participantId={participant.id}
                        types={CONSENT_TYPES.map((ty) => ({
                          value: ty,
                          label: t(`participants.consentType.${ty}`),
                        }))}
                        scopes={scopes
                          .filter((sc) => sc.active)
                          .map((sc) => ({ code: sc.code, label: sc.labelEs }))}
                        labels={{
                          ...formBase,
                          submit:
                            activeConsents.length > 0
                              ? t("participants.startNewConsent")
                              : t("participants.startConsent"),
                          version: t("participants.consentVersion"),
                          versionHelp: t("participants.consentVersionHelp"),
                          type: t("participants.consentTypeLabel"),
                          scopes: t("participants.consentScopes"),
                          scopesHelp: t("participants.consentScopesHelp"),
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
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("applications.field.name")}</dt>
                    {canManageParticipant ? (
                      <ContactField
                        field="fullName"
                        participantId={participant.id}
                        value={contact?.fullName ?? null}
                        labels={{
                          ...formBase,
                          empty: t("participants.contactName.empty"),
                          edit: t("participants.contactName.edit"),
                        }}
                      />
                    ) : (
                      <dd className="break-words">{contact?.fullName ?? "—"}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("applications.field.email")}</dt>
                    {canManageParticipant ? (
                      <ContactField
                        field="email"
                        inputType="email"
                        maxLength={254}
                        participantId={participant.id}
                        value={contact?.email ?? null}
                        labels={{
                          ...formBase,
                          empty: t("participants.contactEmail.empty"),
                          edit: t("participants.contactEmail.edit"),
                        }}
                      />
                    ) : (
                      <dd className="break-words">{contact?.email ?? "—"}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("applications.field.phone")}</dt>
                    {canManageParticipant ? (
                      <ContactField
                        field="phone"
                        inputType="tel"
                        maxLength={40}
                        participantId={participant.id}
                        value={contact?.phone ?? null}
                        labels={{
                          ...formBase,
                          empty: t("participants.contactPhone.empty"),
                          edit: t("participants.contactPhone.edit"),
                        }}
                      />
                    ) : (
                      <dd className="break-words">{contact?.phone ?? "—"}</dd>
                    )}
                  </div>
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
                        <>
                          {/*
                            Moving is offered before removing: a change of cohort
                            is the ordinary case, and doing it as one action
                            avoids the gap where the person belongs nowhere.
                          */}
                          <TransferCohortForm
                            participantId={participant.id}
                            cohorts={assignableCohorts
                              .filter((c) => c.id !== placement.cohort?.id)
                              .map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))}
                            labels={{
                              ...formBase,
                              submit: t("cohorts.transfer"),
                              target: t("cohorts.transferTarget"),
                              reason: t("cohorts.transferReason"),
                              reasonHelp: t("cohorts.transferReasonHelp"),
                            }}
                          />
                          <RemoveFromCohortForm
                            participantId={participant.id}
                            labels={{ ...formBase, submit: t("cohorts.removeFromCohort") }}
                          />
                        </>
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

          {outstanding.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("nextStep.outstandingTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {outstanding.map((os) => (
                    <li key={os}>{t(`nextStep.${os}`)}</li>
                  ))}
                </ul>
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

      <CarePanel
        participantId={participant.id}
        responsibles={responsibles}
        visits={visits}
        candidates={responsibleCandidates}
        canManage={canManageParticipant}
        timezone={ctx.study.timezone}
        formBase={formBase}
      />

      {/* Reading the audit log needs its own permission; writing it never did. */}
      {ctx.permissions.has("audit.read") ? (
        <AuditPanel
          studyId={ctx.study.id}
          participantId={participant.id}
          timezone={ctx.study.timezone}
        />
      ) : null}
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    value,
  );
}

/**
 * Wording for an already-recorded reason. Inactive reasons are included in the
 * list precisely so a historical determination still reads properly instead of
 * degrading to an opaque id once the reason is retired.
 */
function reasonLabel(
  reasons: readonly { id: string; labelEs: string }[],
  reasonId: string,
): string {
  return reasons.find((r) => r.id === reasonId)?.labelEs ?? "—";
}
