import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_STAGES,
  TEMPLATE_VARIABLES,
  isCommunicationStage,
} from "@/domain/communication";
import { listTemplates, suggestValues } from "@/services/communications";
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
 * hands it to the clipboard; a person pastes it into WhatsApp and then says they
 * did (D-004). The banner at the top says so in Spanish, because a screen with a
 * "Copiar" button next to a "Marcar como enviado" button should not be ambiguous
 * about which one talks to the outside world. Neither does.
 */
export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ participante?: string; etapa?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("communications.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const params = await searchParams;
  const stage = isCommunicationStage(params.etapa) ? params.etapa : undefined;
  const canManage = ctx.permissions.has("communications.manage");
  const includeContact = ctx.permissions.has("participants.contact.read");

  const [templates, participantRows] = await Promise.all([
    listTemplates(ctx.study.id, { stage }),
    listParticipants(ctx.study.id, { includeContact: false, limit: 500 }),
  ]);

  const selected = params.participante
    ? participantRows.find((p) => p.id === params.participante)
    : undefined;

  const suggested = selected
    ? await suggestValues(ctx.study.id, selected.id, {
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
    failed: t("communications.error.failed"),
  };

  const templateLabels = {
    submit: t("communications.saveTemplate"),
    submitting: t("common.loading"),
    key: t("communications.field.key"),
    name: t("communications.field.name"),
    stage: t("communications.field.stage"),
    channel: t("communications.field.channel"),
    body: t("communications.field.body"),
    bodyHelp: t("communications.field.bodyHelp"),
    variablesTitle: t("communications.variables"),
    errors,
    stages: COMMUNICATION_STAGES.map((s) => ({
      value: s,
      label: t(`communications.stage.${s}`),
    })),
    channels: COMMUNICATION_CHANNELS.map((c) => ({
      value: c,
      label: t(`communications.channel.${c}`),
    })),
  };

  const byStage = COMMUNICATION_STAGES.map((s) => ({
    stage: s,
    items: templates.filter((tpl) => tpl.stage === s),
  })).filter((g) => g.items.length > 0);

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
            Participant selection is a plain link list rather than a client
            select, so the chosen person is in the URL and the page stays
            shareable — and so `suggestValues` runs on the server for exactly one
            participant instead of for all of them.
          */}
          <nav aria-label={t("communications.participant")} className="flex flex-wrap gap-2">
            {participantRows.slice(0, 40).map((p) => (
              <a
                key={p.id}
                href={`?participante=${p.id}`}
                aria-current={selected?.id === p.id ? "true" : undefined}
                data-numeric
                className={
                  selected?.id === p.id
                    ? "inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    : "inline-flex items-center rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground"
                }
              >
                {p.code}
              </a>
            ))}
          </nav>

          {selected ? (
            <MessageComposer
              participantId={selected.id}
              canReadContact={includeContact}
              suggested={suggested}
              templates={templates
                .filter((tpl) => tpl.active)
                .map((tpl) => ({
                  id: tpl.id,
                  name: tpl.nameEs,
                  stage: tpl.stage,
                  stageLabel: t(`communications.stage.${tpl.stage}`),
                  channel: tpl.channel,
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
                noTemplates: t("communications.noTemplates"),
                submitting: t("common.loading"),
                errors,
                variable: Object.fromEntries(
                  TEMPLATE_VARIABLES.map((v) => [v, t(`communications.variable.${v}`)]),
                ),
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("communications.pickParticipant")}</p>
          )}
        </CardContent>
      </Card>

      {/* Templates -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("communications.templates")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {byStage.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("communications.noTemplates")}</p>
          ) : (
            byStage.map((group) => (
              <section key={group.stage} className="space-y-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t(`communications.stage.${group.stage}`)}
                </h3>
                <ul className="space-y-3">
                  {group.items.map((tpl) => (
                    <li key={tpl.id} className="space-y-2 rounded-xl bg-muted/40 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{tpl.nameEs}</span>
                        <StatusBadge tone="neutral">
                          {t(`communications.channel.${tpl.channel}`)}
                        </StatusBadge>
                        <code className="font-mono text-xs text-muted-foreground">{tpl.key}</code>
                        <span data-numeric className="text-xs text-muted-foreground">
                          v{tpl.version}
                        </span>
                        {!tpl.active ? (
                          <StatusBadge tone="warning">{t("communications.inactive")}</StatusBadge>
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
                              }}
                              labels={{ ...templateLabels, active: t("communications.activeLabel") }}
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
