import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, ChevronDown, MessageSquare, Plus } from "lucide-react";
import type { StudyContext } from "@/auth/study-context";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ENROLLMENT_TONES } from "@/components/team/participant-status-badge";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CohortOccupancy } from "@/components/team/cohort-occupancy";
import { publicPathFor } from "@/domain/content";
import { assessCohortSize, nextCohortStatus, sizeIsCheckedAt } from "@/domain/cohort";
import { TASK_PRIORITIES } from "@/domain/automation";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import type { Locale } from "@/domain/locale";
import { getCohortDetail, listAssignableStaff, listCohortNotes } from "@/services/cohorts";
import { listProgramStages } from "@/services/program-stages";
import { listSessionTemplates, listSessions } from "@/services/sessions";
import { getPublishedForSession, listContentsByType } from "@/services/content";
import { listTemplates } from "@/services/communications";
import { listTasks } from "@/services/automation";
import { listParticipants } from "@/services/participant-ops";
import { AddMemberForm, AdvanceCohortForm, AssignStaffForm, RevokeStaffForm } from "./cohort-forms";
import { ContentSlot, type AssignableContentOption } from "./content-slot";
import { CommsSlot, type AssignableTemplateOption } from "./comms-slot";
import { CreateNoteForm, NoteCard } from "./cohort-notes";
import { PendingToggle } from "./pending-toggle";
import { ProgramTimeline } from "../sesiones/program-timeline";
import { ScheduleSessionForm } from "../sesiones/session-forms";
import { CreateTaskForm } from "../tareas/task-forms";
import { advanceStageAction } from "./actions";
import { TaskChecklistItem } from "./task-checklist";
import { cohortTone } from "./tone";
import { StageIcon } from "./stage-icon";
import { sessionTone } from "../sesiones/tone";

/**
 * One cohort's full workspace — lifecycle, staff, members, and (2026-09-18
 * merge request) its programme sessions with the content and communications
 * each one needs, plus its open tasks as a checklist. This is what used to be
 * spread across the Cohortes, Sesiones, Comunicaciones and Contenido pages;
 * see D-068 for why the merge is scoped the way it is (session/content
 * AUTHORING stays on their own pages, this is the read-and-act view), and
 * D-070 for the 2026-09-19 layout pass (status/team compacted to the top,
 * members as a gallery above the timeline, sticky notes, a manual
 * next-stage button).
 */
export async function CohortPanel({ ctx, cohortId }: { ctx: StudyContext; cohortId: string }) {
  const t = await getTranslations();
  const locale = await getLocale();

  const includeContact = ctx.permissions.has("participants.contact.read");
  const canManage = ctx.permissions.has("cohorts.manage");
  const canManageSessions = ctx.permissions.has("sessions.manage");
  const canReadComms = ctx.permissions.has("communications.read");
  const canManageComms = ctx.permissions.has("communications.manage");
  const canReadTasks = ctx.permissions.has("tasks.read");
  const canManageTasks = ctx.permissions.has("tasks.manage");
  const canManageContent = ctx.permissions.has("content.manage");

  const detail = await getCohortDetail(ctx.study.id, cohortId, { scope: ctx.cohortScope, includeContact });
  if (!detail) notFound();
  const { cohort, staff, members } = detail;

  const [
    assignable,
    addableParticipants,
    stages,
    templates,
    scheduledSessions,
    commsTemplates,
    tasks,
    notes,
    assignablePrep,
    assignableIntegration,
  ] = await Promise.all([
    canManage ? listAssignableStaff(ctx.study.id) : Promise.resolve([]),
    canManage
      ? listParticipants(ctx.study.id, { includeContact, eligibility: "ELIGIBLE" })
      : Promise.resolve([]),
    listProgramStages(ctx.study.id),
    listSessionTemplates(ctx.study.id),
    listSessions(ctx.study.id, { scope: ctx.cohortScope, cohortId }),
    canReadComms ? listTemplates(ctx.study.id, { activeOnly: true }) : Promise.resolve([]),
    canReadTasks ? listTasks(ctx.study.id, { status: "OPEN", limit: 200 }) : Promise.resolve([]),
    canReadTasks ? listCohortNotes(ctx.study.id, cohortId) : Promise.resolve([]),
    canManageContent ? listContentsByType(ctx.study.id, locale as Locale, "SESSION_PREPARATION") : Promise.resolve([]),
    canManageContent ? listContentsByType(ctx.study.id, locale as Locale, "SESSION_INTEGRATION") : Promise.resolve([]),
  ]);

  // Each template's published content — what to share going in (prep) and
  // going out (integration). Not every session needs both: e.g. an opening
  // orientation may have nothing to prepare for, a closing session nothing
  // left to integrate. That's an editorial call for staff, not a rule this
  // code enforces (session identity is configuration, not code — rule 6), so
  // every slot is simply offered and may stay empty.
  const content = await Promise.all(
    templates.map((tpl) =>
      Promise.all([
        getPublishedForSession({ sessionCode: tpl.code, type: "SESSION_PREPARATION", locale: locale as Locale }),
        getPublishedForSession({ sessionCode: tpl.code, type: "SESSION_INTEGRATION", locale: locale as Locale }),
      ]),
    ),
  );
  const contentByTemplate = new Map(
    templates.map((tpl, i) => [tpl.id, { prep: content[i][0], integration: content[i][1] }]),
  );
  const scheduledByTemplate = new Map(
    scheduledSessions.filter((s) => s.templateId).map((s) => [s.templateId as string, s]),
  );
  const commsByTemplate = new Map<string, typeof commsTemplates>();
  for (const tpl of templates) {
    commsByTemplate.set(
      tpl.id,
      commsTemplates.filter((c) => c.sessionTemplateId === tpl.id),
    );
  }
  const cohortTasks = tasks.filter((task) => task.cohortId === cohort.id);

  const asOptions = (rows: typeof assignablePrep): AssignableContentOption[] =>
    rows.map((r) => ({ id: r.id, label: r.publishedTitle ?? r.key, currentSessionName: r.sessionName }));
  const prepOptions = asOptions(assignablePrep);
  const integrationOptions = asOptions(assignableIntegration);
  const commsAssignableOptions: AssignableTemplateOption[] = commsTemplates.map((c) => ({
    id: c.id,
    label: c.nameEs,
    currentSessionName: c.sessionName,
  }));

  const size = assessCohortSize({
    members: members.length,
    minSize: cohort.minSize,
    maxSize: cohort.maxSize,
  });
  const next = nextCohortStatus(cohort.status);

  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("cohorts.error.invalid"),
    notFound: t("cohorts.error.notFound"),
    duplicateCode: t("cohorts.error.duplicateCode"),
    alreadyRandomized: t("cohorts.error.alreadyRandomized"),
    alreadyAssigned: t("cohorts.error.alreadyAssigned"),
    cohortClosed: t("cohorts.error.cohortClosed"),
    badReference: t("participants.error.badReference"),
    failed: t("cohorts.error.failed"),
  };
  const base = { submit: t("common.save"), submitting: t("common.loading"), errors };
  const taskErrors = {
    forbidden: t("tasks.errors.forbidden"),
    invalid: t("tasks.errors.invalid"),
    notFound: t("tasks.errors.notFound"),
    failed: t("tasks.errors.failed"),
  };
  const assignedIds = new Set(staff.map((s) => s.userId));
  const currentTemplateId = templates.find((tpl) => tpl.stageId === cohort.currentStageId)?.id ?? null;

  const currentStageIndex = stages.findIndex((s) => s.id === cohort.currentStageId);
  const nextStage = currentStageIndex === -1 ? (stages[0] ?? null) : (stages[currentStageIndex + 1] ?? null);

  const blocked = size.verdict === "UNDER" || size.verdict === "OVER";

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {cohort.code}
            </p>
            <h2 className="text-xl font-semibold tracking-tight">{cohort.name}</h2>
            <p data-numeric className="text-sm text-muted-foreground">
              {cohort.plannedStartDate ?? "—"} → {cohort.plannedEndDate ?? "—"}
            </p>
          </div>

          {/* Status badge and the "next status" action sit side by side
              (2026-09-19 request: "the status button should be next to the
              status badge") — this replaces the full-width lifecycle card
              that used to live further down the page. */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={cohortTone(cohort.status)}>{t(`cohorts.status.${cohort.status}`)}</StatusBadge>
            {canManage ? (
              <AdvanceCohortForm
                cohortId={cohort.id}
                next={next ? { value: next, label: t(`cohorts.advanceTo.${next}`) } : null}
                labels={{
                  ...base,
                  terminal: t("cohorts.lifecycleEnd"),
                  confirmUnder: t("cohorts.size.confirmUnder", { members: size.members, min: size.minSize ?? 0 }),
                  confirmOver: t("cohorts.size.confirmOver", { members: size.members, max: size.maxSize ?? 0 }),
                  overrideReason: t("cohorts.size.overrideReason"),
                  confirmSubmit: t("cohorts.size.confirmSubmit"),
                }}
              />
            ) : null}
          </div>
        </div>

        {next && sizeIsCheckedAt(next) && blocked ? (
          <p className="rounded-xl bg-surface-peach px-3 py-2 text-xs leading-relaxed text-surface-peach-ink">
            {size.verdict === "UNDER"
              ? t("cohorts.size.warnUnder", { members: size.members, min: size.minSize ?? 0 })
              : t("cohorts.size.warnOver", { members: size.members, max: size.maxSize ?? 0 })}
          </p>
        ) : null}

        {/* Team, one line: names only, a hover-revealed × per chip, and a
            round "+" that opens the add-staff picker (2026-09-19 request).
            `<details>` again, so the picker needs no floating-popover
            dependency — same pattern the content/comms slots use. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("cohorts.staff")}
          </span>
          {staff.length === 0 && !canManage ? (
            <span className="text-sm text-muted-foreground">{t("cohorts.noStaff")}</span>
          ) : null}
          {staff.map((s) => (
            <span
              key={s.userId}
              className="group/staff inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-xs font-medium"
            >
              {s.displayName}
              {canManage ? (
                <RevokeStaffForm
                  cohortId={cohort.id}
                  userId={s.userId}
                  labels={{ ...base, submit: t("cohorts.revokeStaff") }}
                  iconOnly
                  className="opacity-0 transition-opacity group-hover/staff:opacity-100 focus-visible:opacity-100"
                />
              ) : null}
            </span>
          ))}
          {canManage ? (
            <details className="relative">
              <summary
                aria-label={t("cohorts.assignStaff")}
                className="flex size-6 cursor-pointer list-none items-center justify-center rounded-full border border-dashed border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
              >
                <Plus className="size-3.5" aria-hidden />
              </summary>
              {/* w-72 can run past the right edge on a narrow phone when the
                  "+" sits late in a wrapped chip row; capped to the viewport
                  rather than the trigger's own width (2026-09-19 mobile pass). */}
              <div className="absolute right-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-lift">
                <AssignStaffForm
                  cohortId={cohort.id}
                  staff={assignable.filter((s) => !assignedIds.has(s.id))}
                  labels={{
                    ...base,
                    submit: t("cohorts.assignStaff"),
                    person: t("cohorts.field.person"),
                    note: t("cohorts.staffVisibilityNote"),
                  }}
                />
              </div>
            </details>
          ) : null}
        </div>
      </header>

      {/* Participants, as a gallery of buttons straight to each participant
          — moved above the timeline and out of list form (2026-09-19
          request: "a 4-column gallery grid, each tile a button"). */}
      <Card className="py-0">
        <details open className="group/section">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
            <CardTitle className="flex-1">
              {t("cohorts.members")}{" "}
              <span className="font-normal text-muted-foreground">
                <CohortOccupancy
                  size={size}
                  labels={{
                    under: t("cohorts.size.under", { needed: size.needed }),
                    over: t("cohorts.size.over"),
                    remaining: t("cohorts.size.remaining", { remaining: size.remaining ?? 0 }),
                  }}
                />
              </span>
            </CardTitle>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/section:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="border-t border-border pt-4">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("cohorts.noMembers")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {members.map((m) => {
                  const tone = m.enrollmentStatus ? ENROLLMENT_TONES[m.enrollmentStatus] : "neutral";
                  return (
                    <Link
                      key={m.participantId}
                      href={`${TEAM_BASE_PATH}/participantes/${m.participantId}`}
                      className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/40 p-3 text-center transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span
                        className="flex size-9 items-center justify-center rounded-full"
                        style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
                      >
                        <StageIcon status={m.enrollmentStatus} className="size-4" />
                      </span>
                      <span data-numeric className="text-sm font-semibold">
                        {m.code}
                      </span>
                      {includeContact && m.fullName ? (
                        <span className="w-full truncate text-xs text-muted-foreground">{m.fullName}</span>
                      ) : null}
                      {m.armCode ? (
                        <span className="text-[0.65rem] text-muted-foreground">
                          {t("cohorts.arm")} {m.armCode}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}

            {canManage ? (
              <div className="mt-4 border-t border-border pt-4">
                <AddMemberForm
                  cohortId={cohort.id}
                  participants={addableParticipants
                    .filter((p) => !p.cohortCode)
                    .map((p) => ({
                      id: p.id,
                      label: includeContact && p.fullName ? `${p.code} · ${p.fullName}` : p.code,
                    }))}
                  labels={{
                    ...base,
                    submit: t("cohorts.addMember"),
                    participant: t("cohorts.field.participant"),
                    none: t("cohorts.noAddable"),
                  }}
                />
              </div>
            ) : null}
          </CardContent>
        </details>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>{t("sessions.timelineTitle")}</CardTitle>
          {canManage ? (
            <form action={advanceStageAction}>
              <input type="hidden" name="cohortId" value={cohort.id} />
              {nextStage ? (
                <button
                  type="submit"
                  name="stageId"
                  value={nextStage.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t("cohorts.nextStage", { stage: nextStage.nameEs })}
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">{t("cohorts.programComplete")}</span>
              )}
            </form>
          ) : null}
        </CardHeader>
        <CardContent>
          <ProgramTimeline
            stages={stages.map((s) => ({ id: s.id, nameEs: s.nameEs, modality: s.modality }))}
            cohorts={[{ id: cohort.id, code: cohort.code, name: cohort.name, currentStageId: cohort.currentStageId }]}
            canManage={canManage}
            modalityLabels={{
              ZOOM: t("sessions.modality.ZOOM"),
              VR: t("sessions.modality.VR"),
              IN_PERSON: t("sessions.modality.IN_PERSON"),
              ASYNCHRONOUS: t("sessions.modality.ASYNCHRONOUS"),
              OTHER: t("sessions.modality.OTHER"),
            }}
            errorLabels={errors}
            emptyLabel={t("sessions.timelineEmpty")}
            notStartedLabel={t("sessions.timelineNotStarted")}
          />
        </CardContent>
      </Card>

      <Card className="py-0">
        <details open className="group/section">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 [&::-webkit-details-marker]:hidden">
            <CardTitle className="flex-1">{t("sessions.programTitle")}</CardTitle>
            {canManageContent ? (
              <Link
                href={`${TEAM_BASE_PATH}/contenido`}
                className="rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t("sessions.manageContent")}
              </Link>
            ) : null}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/section:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="pb-4">
          <Accordion
            key={cohort.id}
            defaultValue={currentTemplateId ? [currentTemplateId] : []}
            multiple
            className="border-t border-border px-4 pt-1"
          >
            {templates.map((tpl) => {
              const scheduled = scheduledByTemplate.get(tpl.id);
              const { prep, integration } = contentByTemplate.get(tpl.id) ?? { prep: null, integration: null };
              const comms = commsByTemplate.get(tpl.id) ?? [];
              const isCurrent = tpl.id === currentTemplateId;
              return (
                <AccordionItem key={tpl.id} value={tpl.id}>
                  {/* data-open (not group-data-open: this IS the element the
                      state lives on) tints the row while it's expanded — "make
                      it clear which one is open" (2026-09-19). */}
                  <AccordionTrigger className="data-open:bg-muted/70 rounded-xl px-3 -mx-3 data-open:px-3">
                    <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
                      <span className="font-medium">{tpl.nameEs}</span>
                      <StatusBadge tone="neutral">{t(`sessions.modality.${tpl.modality}`)}</StatusBadge>
                      {isCurrent ? (
                        <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-[oklch(0.2_0.02_265)]">
                          {t("sessions.currentStage")}
                        </span>
                      ) : null}
                      {scheduled ? (
                        <>
                          <StatusBadge tone={sessionTone(scheduled.status)}>
                            {t(`sessions.status.${scheduled.status}`)}
                          </StatusBadge>
                          {/* Shown even while collapsed — 2026-09-19 request:
                              "put the date and time in the closed state". */}
                          <span data-numeric className="text-xs text-muted-foreground">
                            {formatDate(scheduled.scheduledStart, ctx.study.timezone)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("sessions.notScheduled")}</span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionPanel>
                    <div className="space-y-4">
                      {scheduled ? (
                        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                          <span data-numeric>{formatDate(scheduled.scheduledStart, ctx.study.timezone)}</span>
                          <span className="text-muted-foreground">{scheduled.expected} {t("sessions.table.expected")}</span>
                          <Link
                            href={`${TEAM_BASE_PATH}/sesiones/${scheduled.id}`}
                            className="ml-auto rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {t("sessions.register")}
                          </Link>
                        </div>
                      ) : canManageSessions ? (
                        <div className="rounded-xl bg-muted/50 p-3">
                          <ScheduleSessionForm
                            cohort={{ id: cohort.id, label: `${cohort.code} · ${cohort.name}` }}
                            template={{ id: tpl.id, name: tpl.nameEs, modality: tpl.modality }}
                            labels={{
                              submit: t("sessions.schedule"),
                              submitting: t("common.loading"),
                              when: t("sessions.field.when"),
                              duration: t("sessions.field.duration"),
                              location: t("sessions.field.location"),
                              errors,
                            }}
                          />
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <ContentSlot
                          label={t("sessions.contentPrepTitle")}
                          tone="mint"
                          content={prep}
                          emptyLabel={t("sessions.noContentPrep")}
                          createHref={
                            canManageContent
                              ? `${TEAM_BASE_PATH}/contenido?sessionTemplateId=${tpl.id}&type=SESSION_PREPARATION#create`
                              : null
                          }
                          createLabel={t("sessions.addContent")}
                          editLabel={t("sessions.editContent")}
                          publicPath={publicPathFor({ type: "SESSION_PREPARATION", key: "", sessionCode: tpl.code })}
                          viewLabel={t("sessions.contentView")}
                          copyLabel={t("sessions.contentCopyLink")}
                          copiedLabel={t("sessions.contentLinkCopied")}
                          canManageContent={canManageContent}
                          sessionTemplateId={tpl.id}
                          assignable={prepOptions}
                          pickLabel={t("sessions.contentPick")}
                          pickNoneLabel={t("sessions.contentPickError")}
                          pickPlaceholder={t("sessions.contentPickPlaceholder")}
                          assignLabel={t("sessions.contentAssign")}
                        />
                        <ContentSlot
                          label={t("sessions.contentIntegrationTitle")}
                          tone="sky"
                          content={integration}
                          emptyLabel={t("sessions.noContentIntegration")}
                          createHref={
                            canManageContent
                              ? `${TEAM_BASE_PATH}/contenido?sessionTemplateId=${tpl.id}&type=SESSION_INTEGRATION#create`
                              : null
                          }
                          createLabel={t("sessions.addContent")}
                          editLabel={t("sessions.editContent")}
                          publicPath={publicPathFor({ type: "SESSION_INTEGRATION", key: "", sessionCode: tpl.code })}
                          viewLabel={t("sessions.contentView")}
                          copyLabel={t("sessions.contentCopyLink")}
                          copiedLabel={t("sessions.contentLinkCopied")}
                          canManageContent={canManageContent}
                          sessionTemplateId={tpl.id}
                          assignable={integrationOptions}
                          pickLabel={t("sessions.contentPick")}
                          pickNoneLabel={t("sessions.contentPickError")}
                          pickPlaceholder={t("sessions.contentPickPlaceholder")}
                          assignLabel={t("sessions.contentAssign")}
                        />
                      </div>

                      {canReadComms ? (
                        <div className="rounded-xl border border-transparent bg-card p-3 ring-1 ring-inset ring-[color-mix(in_oklch,var(--surface-peach-ink)_35%,transparent)]">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            <MessageSquare className="size-3.5" aria-hidden />
                            {t("sessions.commsTitle")}
                          </p>
                          <CommsSlot
                            assigned={comms.map((c) => ({ id: c.id, nameEs: c.nameEs, bodyEs: c.bodyEs }))}
                            emptyLabel={t("sessions.noComms")}
                            editLabel={t("sessions.editContent")}
                            copyLabel={t("sessions.contentCopyLink")}
                            copiedLabel={t("sessions.contentLinkCopied")}
                            canManage={canManageComms}
                            sessionTemplateId={tpl.id}
                            assignable={commsAssignableOptions}
                            pickLabel={t("sessions.contentPick")}
                            pickNoneLabel={t("sessions.contentPickError")}
                            pickPlaceholder={t("sessions.contentPickPlaceholder")}
                            assignLabel={t("sessions.contentAssign")}
                          />
                        </div>
                      ) : null}
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
          </div>
        </details>
      </Card>

      {canReadTasks ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle>{t("tasks.checklistTitle")}</CardTitle>
            {canManageTasks ? (
              <Dialog>
                <DialogTrigger render={<Button size="xs" variant="outline" className="gap-1 rounded-md" />}>
                  <Plus className="size-3" aria-hidden />
                  {t("tasks.add")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("tasks.add")}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">{t("tasks.boundary")}</p>
                  <CreateTaskForm
                    defaultCohortId={cohort.id}
                    labels={{
                      submit: t("tasks.add"),
                      submitting: t("common.loading"),
                      errors: taskErrors,
                      title: t("tasks.title"),
                      detail: t("tasks.detail"),
                      detailHelp: t("tasks.detailHelp"),
                      priority: t("tasks.priority"),
                      dueAt: t("tasks.dueAt"),
                      assignedTo: t("tasks.assignedTo"),
                      unassigned: t("tasks.unassigned"),
                      aboutParticipant: t("tasks.aboutParticipant"),
                      aboutCohort: t("tasks.aboutCohort"),
                      none: t("common.none"),
                    }}
                    priorities={TASK_PRIORITIES.map((p) => ({ value: p, label: t(`tasks.priorityLabel.${p}`) }))}
                    staff={assignable.map((s) => ({ value: s.id, label: s.displayName }))}
                    participants={members.map((m) => ({ value: m.participantId, label: m.code }))}
                    cohorts={[{ value: cohort.id, label: `${cohort.code} · ${cohort.name}` }]}
                  />
                </DialogContent>
              </Dialog>
            ) : null}
          </CardHeader>
          <CardContent>
            <PendingToggle
              tasksLabel={t("cohorts.notes.tasksTab")}
              notesLabel={t("cohorts.notes.notesTab")}
              tasks={
                <div className="space-y-3">
                  {cohortTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("tasks.checklistEmpty")}</p>
                  ) : canManageTasks ? (
                    <div className="divide-y divide-border">
                      {cohortTasks.map((task) => (
                        <TaskChecklistItem
                          key={task.id}
                          taskId={task.id}
                          title={task.titleEs}
                          detail={task.detail}
                          errorLabels={taskErrors}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {cohortTasks.map((task) => (
                        <li key={task.id} className="text-sm">
                          {task.titleEs}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`${TEAM_BASE_PATH}/tareas`}
                    className="inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("tasks.viewAll")}
                  </Link>
                </div>
              }
              notes={
                <div className="space-y-3">
                  {notes.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {notes.map((n) => (
                        <NoteCard
                          key={n.id}
                          note={n}
                          canManage={canManageTasks}
                          removeLabel={t("cohorts.notes.remove")}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("cohorts.notes.empty")}</p>
                  )}
                  {canManageTasks ? (
                    <CreateNoteForm
                      cohortId={cohort.id}
                      labels={{
                        placeholder: t("cohorts.notes.placeholder"),
                        submit: t("cohorts.notes.add"),
                        submitting: t("common.loading"),
                        color: t("cohorts.notes.color"),
                        error: t("cohorts.error.failed"),
                      }}
                    />
                  ) : null}
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(value);
}
