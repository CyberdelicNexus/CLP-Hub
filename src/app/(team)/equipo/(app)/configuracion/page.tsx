import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTION_KINDS,
  ALERT_KINDS,
  CONDITION_KEYS,
  DELIVERY_MODES,
  EVENT_TYPES,
  TASK_PRIORITIES,
  describeOffset,
  isDeliveryModeAvailable,
  parseConditions,
} from "@/domain/automation";
import { LOCALES } from "@/domain/locale";
import { SESSION_MODALITIES } from "@/domain/session";
import { STUDY_STATUSES } from "@/domain/study";
import { listRules } from "@/services/automation";
import { listStudyArms } from "@/services/cohorts";
import { listTemplates } from "@/services/communications";
import { listProgramStages } from "@/services/program-stages";
import { listSessionTemplates } from "@/services/sessions";
import { getStudy } from "@/services/study-settings";
import {
  CreateProgramStageForm,
  CreateSessionTemplateForm,
  EditProgramStageForm,
  EditSessionTemplateForm,
  RenameSessionTemplateCodeForm,
  ToggleProgramStageForm,
  ToggleSessionTemplateForm,
} from "./program-forms";
import { CreateRuleForm, StudySettingsForm, ToggleRuleForm } from "./settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

/**
 * Study configuration.
 *
 * Two things live here, and they are the same kind of thing: values that change
 * what the application does for everybody.
 *
 * 1. **The study itself** — where applicants are sent, what timezone every date
 *    is read in, whether recruitment is open, and whether the scheduled-action
 *    processor works through this study at all.
 * 2. **Automation rules** — when something happens, how long before or after it,
 *    and what gets prepared. Every timing this trial uses is a row here and none
 *    is in code (CLAUDE.md rule 6).
 *
 * Gated on `study.settings.manage`, which only ADMIN holds. A facilitator who
 * can use a template should not be able to change when it fires (D-044).
 *
 * NOTHING ON THIS PAGE CAN MAKE THE APPLICATION SEND ANYTHING. AUTOMATIC
 * delivery appears in the mode list and is disabled, with the reason attached,
 * because someone looking for it should find out that it does not exist rather
 * than wonder whether they missed it (D-043).
 */
export default async function SettingsPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("study.settings.manage")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const [study, rules, templates, stages, sessionTemplates, arms] = await Promise.all([
    getStudy(ctx.study.id),
    listRules(ctx.study.id),
    listTemplates(ctx.study.id, { activeOnly: true }),
    listProgramStages(ctx.study.id, { includeInactive: true }),
    listSessionTemplates(ctx.study.id, { includeInactive: true }),
    listStudyArms(ctx.study.id),
  ]);
  if (!study) return null;

  const errors = {
    forbidden: t("settings.errors.forbidden"),
    invalid: t("settings.errors.invalid"),
    notFound: t("settings.errors.notFound"),
    title: t("settings.errors.title"),
    timezone: t("settings.errors.timezone"),
    screeningUrl: t("settings.errors.screeningUrl"),
    duplicateKey: t("automation.errors.duplicateKey"),
    unavailableDeliveryMode: t("automation.errors.unavailableDeliveryMode"),
    invalidOffset: t("automation.errors.invalidOffset"),
    shape: t("automation.errors.shape"),
    duplicateCode: t("program.errors.duplicateCode"),
    failed: t("settings.errors.failed"),
  };

  const labels = { submit: t("common.save"), submitting: t("common.loading"), errors };
  const modalityOptions = SESSION_MODALITIES.map((m) => ({
    value: m,
    label: t(`sessions.modality.${m}`),
  }));
  const stageOptions = stages.filter((s) => s.active).map((s) => ({ id: s.id, nameEs: s.nameEs }));
  const armOptions = arms.map((a) => ({ id: a.id, label: `${a.code} · ${a.nameEs}` }));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.settings")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      {/* Study ------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.study")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {/* The code is not editable: it appears in participant codes, exports
                and every audit row, and renaming it would re-label history. */}
            {t("settings.codeFixed", { code: study.code })}
          </p>
          <StudySettingsForm
            study={{
              title: study.title,
              status: study.status,
              defaultLocale: study.defaultLocale,
              timezone: study.timezone,
              recruitmentOpen: study.recruitmentOpen,
              screeningUrl: study.screeningUrl,
            }}
            statuses={STUDY_STATUSES.map((s) => ({ value: s, label: t(`status.study.${s}`) }))}
            locales={LOCALES.map((l) => ({ value: l, label: t(`locale.${l}`) }))}
            labels={{
              ...labels,
              title: t("settings.title"),
              status: t("settings.status"),
              statusHelp: t("settings.statusHelp"),
              locale: t("settings.locale"),
              timezone: t("settings.timezone"),
              timezoneHelp: t("settings.timezoneHelp"),
              recruitmentOpen: t("settings.recruitmentOpen"),
              screeningUrl: t("settings.screeningUrl"),
              screeningUrlHelp: t("settings.screeningUrlHelp"),
              saved: t("settings.saved"),
            }}
          />
        </CardContent>
      </Card>

      {/* Programme: stages and session templates (2026-09-28 request) ------ */}
      <Card>
        <CardHeader>
          <CardTitle>{t("program.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Collapsed by default (2026-09-29 request): the programme is
              settled and staff shouldn't stumble into editing it day to
              day — still reachable, just tucked behind a click. */}
          <details className="group/program-editing">
            <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
              {t("program.showEditing")}
            </summary>
            <div className="mt-4 space-y-8">
              <p className="rounded-xl bg-surface-sky px-4 py-3 text-xs leading-relaxed text-surface-sky-ink">
                {t("program.boundary")}
              </p>

              {/* Stages ---------------------------------------------------- */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t("program.stages")}</h3>
                {stages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("program.noStages")}</p>
                ) : (
                  <ul className="divide-y">
                    {stages.map((stage) => (
                      <li key={stage.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                        <details>
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2 text-sm">
                              <span data-numeric className="text-xs text-muted-foreground">
                                {stage.position}
                              </span>
                              <span className="font-medium">{stage.nameEs}</span>
                              <StatusBadge tone="neutral">{t(`sessions.modality.${stage.modality}`)}</StatusBadge>
                              {!stage.active ? (
                                <StatusBadge tone="neutral">{t("program.inactive")}</StatusBadge>
                              ) : null}
                            </span>
                            <span className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                              {t("program.edit")}
                            </span>
                          </summary>
                          <div className="mt-3 rounded-xl bg-muted/40 p-3">
                            <EditProgramStageForm
                              stage={stage}
                              modalities={modalityOptions}
                              labels={{
                                ...labels,
                                nameEs: t("program.field.nameEs"),
                                nameEn: t("program.field.nameEn"),
                                modality: t("program.field.modality"),
                                position: t("program.field.position"),
                                saved: t("settings.saved"),
                              }}
                            />
                          </div>
                        </details>
                        <ToggleProgramStageForm
                          stageId={stage.id}
                          active={stage.active}
                          labels={{
                            ...labels,
                            submit: stage.active ? t("program.deactivate") : t("program.activate"),
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-border pt-4">
                  <h4 className="mb-3 text-sm font-medium">{t("program.newStage")}</h4>
                  <CreateProgramStageForm
                    modalities={modalityOptions}
                    labels={{
                      ...labels,
                      submit: t("program.newStage"),
                      code: t("program.field.code"),
                      codeHelp: t("program.field.stageCodeHelp"),
                      nameEs: t("program.field.nameEs"),
                      nameEn: t("program.field.nameEn"),
                      modality: t("program.field.modality"),
                      position: t("program.field.position"),
                    }}
                  />
                </div>
              </div>

              {/* Session templates ------------------------------------------ */}
              <div className="space-y-4 border-t border-border pt-6">
                <h3 className="text-sm font-medium">{t("program.templates")}</h3>
                {sessionTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("program.noTemplates")}</p>
                ) : (
                  <ul className="divide-y">
                    {sessionTemplates.map((tpl) => {
                      const stage = stages.find((s) => s.id === tpl.stageId);
                      return (
                        <li key={tpl.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                          <details>
                            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                              <span className="flex flex-wrap items-center gap-2 text-sm">
                                <code className="font-mono text-xs text-muted-foreground">{tpl.code}</code>
                                <span className="font-medium">{tpl.nameEs}</span>
                                <StatusBadge tone="neutral">{t(`sessions.modality.${tpl.modality}`)}</StatusBadge>
                                {stage ? <StatusBadge tone="neutral">{stage.nameEs}</StatusBadge> : null}
                                {!tpl.active ? (
                                  <StatusBadge tone="neutral">{t("program.inactive")}</StatusBadge>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                                {t("program.edit")}
                              </span>
                            </summary>
                            <div className="mt-3 rounded-xl bg-muted/40 p-3">
                              <EditSessionTemplateForm
                                template={tpl}
                                stages={stageOptions}
                                arms={armOptions}
                                modalities={modalityOptions}
                                labels={{
                                  ...labels,
                                  nameEs: t("program.field.nameEs"),
                                  nameEn: t("program.field.nameEn"),
                                  modality: t("program.field.modality"),
                                  stage: t("program.field.stage"),
                                  stageNone: t("program.field.stageNone"),
                                  arm: t("cohorts.field.arm"),
                                  armAny: t("cohorts.field.armAny"),
                                  duration: t("program.field.duration"),
                                  dayOffset: t("program.field.dayOffset"),
                                  dayOffsetHelp: t("program.field.dayOffsetHelp"),
                                  position: t("program.field.position"),
                                  saved: t("settings.saved"),
                                }}
                              />
                              <div className="mt-3 border-t border-border pt-3">
                                <RenameSessionTemplateCodeForm
                                  templateId={tpl.id}
                                  currentCode={tpl.code}
                                  labels={{
                                    ...labels,
                                    code: t("program.field.code"),
                                    codeWarning: t("program.field.codeWarning"),
                                  }}
                                />
                              </div>
                            </div>
                          </details>
                          <ToggleSessionTemplateForm
                            templateId={tpl.id}
                            active={tpl.active}
                            labels={{
                              ...labels,
                              submit: tpl.active ? t("program.deactivate") : t("program.activate"),
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="border-t border-border pt-4">
                  <h4 className="mb-3 text-sm font-medium">{t("program.newTemplate")}</h4>
                  <CreateSessionTemplateForm
                    stages={stageOptions}
                    arms={armOptions}
                    modalities={modalityOptions}
                    labels={{
                      ...labels,
                      submit: t("program.newTemplate"),
                      code: t("program.field.code"),
                      codeHelp: t("program.field.templateCodeHelp"),
                      nameEs: t("program.field.nameEs"),
                      nameEn: t("program.field.nameEn"),
                      modality: t("program.field.modality"),
                      stage: t("program.field.stage"),
                      stageNone: t("program.field.stageNone"),
                      arm: t("cohorts.field.arm"),
                      armAny: t("cohorts.field.armAny"),
                      duration: t("program.field.duration"),
                      dayOffset: t("program.field.dayOffset"),
                      dayOffsetHelp: t("program.field.dayOffsetHelp"),
                      position: t("program.field.position"),
                    }}
                  />
                </div>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Automation rules --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("automation.rules")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="rounded-xl bg-surface-sky px-4 py-3 text-xs leading-relaxed text-surface-sky-ink">
            {t("automation.nothingSends")}
          </p>

          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("automation.noRules")}</p>
          ) : (
            <ul className="divide-y">
              {rules.map((rule) => {
                // Unknown keys are dropped rather than shown: a rule row edited
                // by hand must not make this page claim a condition that the
                // processor will ignore.
                const { conditions } = parseConditions(rule.conditionsJson);
                const required = CONDITION_KEYS.filter((k) => conditions[k] !== undefined);

                return (
                  <li key={rule.id} className="space-y-1.5 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{rule.nameEs}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(`automation.eventType.${rule.eventType}`)} ·{" "}
                          {offsetLabel(rule.offsetMinutes, t)} ·{" "}
                          {t(`automation.action.${rule.actionKind}`)}
                          {rule.templateName ? ` · ${rule.templateName}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <code className="font-mono">{rule.key}</code>
                          <StatusBadge tone={rule.active ? "success" : "neutral"}>
                            {rule.active ? t("automation.active") : t("automation.inactive")}
                          </StatusBadge>
                          <StatusBadge tone="neutral">
                            {t(`automation.delivery.${rule.deliveryMode}`)}
                          </StatusBadge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {required.length === 0
                            ? t("automation.noConditions")
                            : required
                                .map((k) =>
                                  conditions[k]
                                    ? t(`automation.condition.${k}`)
                                    : // A rule can require a condition to be
                                      // FALSE. The create form only produces
                                      // true ones, but a seeded or hand-edited
                                      // row may not, and rendering it as if it
                                      // required the opposite would be a lie.
                                      t("automation.conditionNot", {
                                        condition: t(`automation.condition.${k}`),
                                      }),
                                )
                                .join(" · ")}
                        </p>
                      </div>
                      <ToggleRuleForm
                        ruleId={rule.id}
                        active={rule.active}
                        labels={{
                          ...labels,
                          submit: rule.active
                            ? t("automation.deactivate")
                            : t("automation.activate"),
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-border pt-6">
            <h3 className="mb-3 text-sm font-medium">{t("settings.newRule")}</h3>
            <CreateRuleForm
              events={EVENT_TYPES.map((e) => ({
                value: e,
                label: t(`automation.eventType.${e}`),
              }))}
              actionKinds={ACTION_KINDS.map((a) => ({
                value: a,
                label: t(`automation.action.${a}`),
              }))}
              deliveryModes={DELIVERY_MODES.map((m) => ({
                value: m,
                label: t(`automation.delivery.${m}`),
                available: isDeliveryModeAvailable(m),
              }))}
              templates={templates.map((tpl) => ({ value: tpl.id, label: tpl.nameEs }))}
              alertKinds={ALERT_KINDS.map((k) => ({
                value: k,
                label: t(`alerts.kind.${k}`),
              }))}
              priorities={TASK_PRIORITIES.map((p) => ({
                value: p,
                label: t(`tasks.priorityLabel.${p}`),
              }))}
              conditions={CONDITION_KEYS.map((k) => ({
                value: k,
                label: t(`automation.condition.${k}`),
              }))}
              labels={{
                ...labels,
                submit: t("settings.newRule"),
                key: t("settings.ruleKey"),
                name: t("automation.rule"),
                event: t("automation.event"),
                offset: t("automation.offset"),
                offsetHelp: t("automation.offsetHelp"),
                actionKind: t("automation.actionKind"),
                deliveryMode: t("automation.deliveryMode"),
                deliveryUnavailable: t("automation.deliveryUnavailable"),
                template: t("automation.template"),
                taskTitle: t("tasks.title"),
                priority: t("tasks.priority"),
                alertKind: t("nav.alerts"),
                conditions: t("automation.conditions"),
                conditionsHelp: t("settings.conditionsHelp"),
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * "2 días antes" rather than "2880 min antes".
 *
 * Rules are stored and edited in minutes because that is the only unit that
 * expresses every timing without rounding. Reading them back in minutes makes
 * the person checking whether a rule is right do the arithmetic in their head,
 * on exactly the screen where a mistake is expensive. `describeOffset` picks the
 * largest unit that says it EXACTLY, so 90 minutes stays 90 minutes.
 */
function offsetLabel(
  minutes: number,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
) {
  const offset = describeOffset(minutes);
  if (offset.direction === "same") return t("automation.offsetLabel.same");
  return t(`automation.offsetLabel.${offset.direction}.${offset.unit}`, { value: offset.value });
}
