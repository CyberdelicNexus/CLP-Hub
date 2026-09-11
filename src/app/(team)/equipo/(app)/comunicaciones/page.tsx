import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_STAGES,
  TEMPLATE_VARIABLES,
  isCommunicationAudience,
  type CommunicationAudience,
} from "@/domain/communication";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import {
  listCohortOptions,
  listSessionOptions,
  listTemplates,
  suggestCohortValues,
  suggestValues,
  type TemplateRow,
} from "@/services/communications";
import { listParticipants } from "@/services/participant-ops";
import { MessageComposer } from "./message-composer";
import { CreateTemplateForm, EditTemplateForm } from "./template-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("communications") };
}

/**
 * Communications (Phase 7).
 *
 * NOTHING ON THIS PAGE SENDS A MESSAGE. It renders a template, shows it, and
 * hands it to the clipboard; a person pastes it into the channel and then says
 * they did (D-004). The banner says so in Spanish, because a screen with a
 * "Copiar" button beside a "Marcar como enviado" button should not be ambiguous
 * about which one talks to the outside world. Neither does.
 *
 * Templates are divided by STAGE and, within a stage, by SESSION — the division
 * the team actually works in. The composer addresses either a cohort's channel
 * or one person, and a channel template can never name an individual (D-041).
 */
export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ destinatario?: string; participante?: string; cohorte?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("communications.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const params = await searchParams;
  const audience: CommunicationAudience = isCommunicationAudience(params.destinatario)
    ? params.destinatario
    : "COHORT_CHANNEL";
  const canManage = ctx.permissions.has("communications.manage");
  const includeContact = ctx.permissions.has("participants.contact.read");

  const [templates, sessionOptions, cohortOptions, participantRows] = await Promise.all([
    listTemplates(ctx.study.id),
    listSessionOptions(ctx.study.id),
    listCohortOptions(ctx.study.id),
    listParticipants(ctx.study.id, { includeContact: false, limit: 500 }),
  ]);

  const selectedCohort =
    audience === "COHORT_CHANNEL" && params.cohorte
      ? cohortOptions.find((c) => c.id === params.cohorte)
      : undefined;
  const selectedParticipant =
    audience === "PARTICIPANT" && params.participante
      ? participantRows.find((p) => p.id === params.participante)
      : undefined;

  // The template drives which session's date is offered, so a "session 2
  // reminder" suggests session 2 rather than whatever comes next.
  const composerTemplates = templates.filter((tpl) => tpl.active && tpl.audience === audience);

  const suggested = selectedCohort
    ? await suggestCohortValues(ctx.study.id, selectedCohort.id, {
        timezone: ctx.study.timezone,
        sessionTemplateId: composerTemplates[0]?.sessionTemplateId ?? null,
      })
    : selectedParticipant
      ? await suggestValues(ctx.study.id, selectedParticipant.id, {
          includeContact,
          timezone: ctx.study.timezone,
        })
      : {};

  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("communications.error.invalid"),
    notFound: t("communications.error.notFound"),
    duplicateKey: t("communications.error.duplicateKey"),
    unknownVariable: t("communications.error.unknownVariable"),
    tooLong: t("communications.error.tooLong"),
    empty: t("communications.error.empty"),
    participantVariableInChannel: t("communications.error.participantVariableInChannel"),
    audienceMismatch: t("communications.error.audienceMismatch"),
    failed: t("communications.error.failed"),
  };

  const templateLabels = {
    submit: t("communications.saveTemplate"),
    submitting: t("common.loading"),
    key: t("communications.field.key"),
    name: t("communications.field.name"),
    stage: t("communications.field.stage"),
    channel: t("communications.field.channel"),
    audience: t("communications.field.audience"),
    audienceHelp: t("communications.field.audienceHelp"),
    session: t("communications.field.session"),
    sessionHelp: t("communications.field.sessionHelp"),
    sessionNone: t("communications.field.sessionNone"),
    body: t("communications.field.body"),
    bodyHelp: t("communications.field.bodyHelp"),
    variablesTitle: t("communications.variables"),
    channelVariablesNote: t("communications.channelVariablesNote"),
    errors,
    stages: COMMUNICATION_STAGES.map((s) => ({
      value: s,
      label: t(`communications.stage.${s}`),
    })),
    channels: COMMUNICATION_CHANNELS.map((c) => ({
      value: c,
      label: t(`communications.channel.${c}`),
    })),
    audiences: COMMUNICATION_AUDIENCES.map((a) => ({
      value: a,
      label: t(`communications.audience.${a}`),
    })),
    sessions: sessionOptions.map((o) => ({ value: o.id, label: o.name })),
  };

  const base = `${TEAM_BASE_PATH}/comunicaciones`;
  const grouped = groupByStageAndSession(templates);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.communications")}</h1>
        <p className="text-sm text-muted-foreground">{t("communications.subtitle")}</p>
      </header>

      <p className="rounded-xl bg-surface-sky px-4 py-3 text-xs leading-relaxed text-surface-sky-ink">
        {t("communications.manualNote")}
      </p>

      {/* Compose ---------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("communications.compose")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/*
            Audience first, because it changes both the templates offered and the
            list of subjects below it.
          */}
          <nav aria-label={t("communications.field.audience")} className="flex flex-wrap gap-2">
            {COMMUNICATION_AUDIENCES.map((a) => (
              <Chip
                key={a}
                href={`${base}?destinatario=${a}`}
                active={audience === a}
                label={t(`communications.audience.${a}`)}
              />
            ))}
          </nav>

          {/*
            Subject selection is a link list rather than a client select, so the
            choice is in the URL and the page stays shareable — and so the
            suggested values are gathered on the server for one subject instead
            of for all of them.
          */}
          {audience === "COHORT_CHANNEL" ? (
            <nav aria-label={t("communications.cohort")} className="flex flex-wrap gap-2">
              {cohortOptions.map((c) => (
                <Chip
                  key={c.id}
                  href={`${base}?destinatario=COHORT_CHANNEL&cohorte=${c.id}`}
                  active={selectedCohort?.id === c.id}
                  label={`${c.code} · ${c.name}`}
                />
              ))}
            </nav>
          ) : (
            <nav aria-label={t("communications.participant")} className="flex flex-wrap gap-2">
              {participantRows.slice(0, 40).map((p) => (
                <Chip
                  key={p.id}
                  href={`${base}?destinatario=PARTICIPANT&participante=${p.id}`}
                  active={selectedParticipant?.id === p.id}
                  label={p.code}
                  numeric
                />
              ))}
            </nav>
          )}

          {selectedCohort || selectedParticipant ? (
            <MessageComposer
              subject={
                selectedCohort
                  ? { kind: "COHORT_CHANNEL", id: selectedCohort.id }
                  : { kind: "PARTICIPANT", id: selectedParticipant!.id }
              }
              audience={audience}
              canReadContact={includeContact}
              suggested={suggested}
              templates={composerTemplates.map((tpl) => ({
                id: tpl.id,
                name: tpl.nameEs,
                stageLabel: t(`communications.stage.${tpl.stage}`),
                sessionName: tpl.sessionName,
                body: tpl.bodyEs,
              }))}
              labels={{
                template: t("communications.template"),
                values: t("communications.values"),
                preview: t("communications.preview"),
                copy: t("communications.copy"),
                copied: t("communications.copied"),
                markSent: t("communications.markSent"),
                markSkipped: t("communications.markSkipped"),
                skipReason: t("communications.skipReason"),
                missing: t("communications.missing"),
                redacted: t("communications.redacted"),
                noTemplates: t("communications.noTemplatesForAudience"),
                submitting: t("common.loading"),
                errors,
                variable: Object.fromEntries(
                  TEMPLATE_VARIABLES.map((v) => [v, t(`communications.variable.${v}`)]),
                ),
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {audience === "COHORT_CHANNEL"
                ? t("communications.pickCohort")
                : t("communications.pickParticipant")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Templates, by stage and session ----------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("communications.templates")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("communications.noTemplates")}</p>
          ) : (
            grouped.map((group) => (
              <section key={group.stage} className="space-y-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t(`communications.stage.${group.stage}`)}
                </h3>

                {group.sessions.map((bucket) => (
                  <div key={bucket.key} className="space-y-2">
                    {/*
                      The session heading only appears when a stage actually has
                      session-linked messages. A lone "Sin sesión" label above
                      every waiting-list message is noise.
                    */}
                    {group.sessions.length > 1 || bucket.sessionName ? (
                      <p className="text-xs text-muted-foreground">
                        {bucket.sessionName ?? t("communications.noSession")}
                      </p>
                    ) : null}

                    <ul className="space-y-3">
                      {bucket.items.map((tpl) => (
                        <li key={tpl.id} className="space-y-2 rounded-xl bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{tpl.nameEs}</span>
                            <StatusBadge
                              tone={tpl.audience === "COHORT_CHANNEL" ? "info" : "neutral"}
                            >
                              {t(`communications.audience.${tpl.audience}`)}
                            </StatusBadge>
                            <StatusBadge tone="neutral">
                              {t(`communications.channel.${tpl.channel}`)}
                            </StatusBadge>
                            <code className="font-mono text-xs text-muted-foreground">{tpl.key}</code>
                            <span data-numeric className="text-xs text-muted-foreground">
                              v{tpl.version}
                            </span>
                            {!tpl.active ? (
                              <StatusBadge tone="warning">
                                {t("communications.inactive")}
                              </StatusBadge>
                            ) : null}
                          </div>

                          {canManage ? (
                            <details>
                              <summary className="cursor-pointer text-xs text-muted-foreground">
                                {t("communications.edit")}
                              </summary>
                              <div className="pt-3">
                                <EditTemplateForm
                                  templateId={tpl.id}
                                  current={{
                                    nameEs: tpl.nameEs,
                                    bodyEs: tpl.bodyEs,
                                    active: tpl.active,
                                    audience: tpl.audience,
                                    sessionTemplateId: tpl.sessionTemplateId,
                                  }}
                                  labels={{
                                    ...templateLabels,
                                    active: t("communications.activeLabel"),
                                  }}
                                />
                              </div>
                            </details>
                          ) : (
                            <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                              {tpl.bodyEs}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))
          )}

          {canManage ? (
            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("communications.newTemplate")}
              </h3>
              <CreateTemplateForm labels={templateLabels} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Stage → session → templates.
 *
 * Sessions come out in programme order (the service ordered by
 * `sessionTemplates.position`), with unlinked messages last: a "recordatorio de
 * sesión" group should read session 1, session 2, session 3, and the things that
 * belong to no session are the tail, not the head.
 */
function groupByStageAndSession(templates: TemplateRow[]) {
  const stages = new Map<
    string,
    Map<string, { key: string; sessionName: string | null; items: TemplateRow[] }>
  >();

  for (const tpl of templates) {
    const byStage = stages.get(tpl.stage) ?? new Map();
    stages.set(tpl.stage, byStage);

    const key = tpl.sessionTemplateId ?? "__none__";
    const bucket = byStage.get(key) ?? { key, sessionName: tpl.sessionName, items: [] };
    bucket.items.push(tpl);
    byStage.set(key, bucket);
  }

  return [...stages.entries()].map(([stage, byStage]) => ({
    stage,
    sessions: [...byStage.values()].sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return 0;
    }),
  }));
}

function Chip({
  href,
  active,
  label,
  numeric,
}: {
  href: string;
  active: boolean;
  label: string;
  numeric?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      data-numeric={numeric ? "" : undefined}
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
