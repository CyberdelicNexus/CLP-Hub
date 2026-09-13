"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OFFSET_MINUTES_MAX,
  OFFSET_MINUTES_MIN,
  RULE_NAME_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  type ActionKind,
} from "@/domain/automation";
import {
  createRuleAction,
  toggleRuleAction,
  updateSettingsAction,
  type SettingsState,
} from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: SettingsState = { error: null };

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export interface SettingsLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: SettingsState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

export function StudySettingsForm({
  study,
  statuses,
  locales,
  labels,
}: {
  study: {
    title: string;
    status: string;
    defaultLocale: string;
    timezone: string;
    recruitmentOpen: boolean;
    screeningUrl: string | null;
  };
  statuses: { value: string; label: string }[];
  locales: { value: string; label: string }[];
  labels: SettingsLabels & {
    title: string;
    status: string;
    statusHelp: string;
    locale: string;
    timezone: string;
    timezoneHelp: string;
    recruitmentOpen: string;
    screeningUrl: string;
    screeningUrlHelp: string;
    saved: string;
  };
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, initial);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="studyTitle">{labels.title}</Label>
        <Input id="studyTitle" name="title" defaultValue={study.title} required maxLength={200} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="studyStatus">{labels.status}</Label>
        <select
          id="studyStatus"
          name="status"
          defaultValue={study.status}
          className={SELECT_CLASS}
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {/*
          Said out loud because it is not obvious from the word "ACTIVE": the
          scheduled-action processor only works through active studies.
        */}
        <p className="text-xs text-muted-foreground">{labels.statusHelp}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="studyLocale">{labels.locale}</Label>
        <select
          id="studyLocale"
          name="defaultLocale"
          defaultValue={study.defaultLocale}
          className={SELECT_CLASS}
        >
          {locales.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="studyTimezone">{labels.timezone}</Label>
        <Input
          id="studyTimezone"
          name="timezone"
          defaultValue={study.timezone}
          required
          maxLength={64}
          placeholder="Europe/Madrid"
        />
        <p className="text-xs text-muted-foreground">{labels.timezoneHelp}</p>
      </div>

      <div className="flex items-end gap-2 pb-1">
        <input
          id="recruitmentOpen"
          name="recruitmentOpen"
          type="checkbox"
          defaultChecked={study.recruitmentOpen}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="recruitmentOpen">{labels.recruitmentOpen}</Label>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="screeningUrl">{labels.screeningUrl}</Label>
        <Input
          id="screeningUrl"
          name="screeningUrl"
          type="url"
          defaultValue={study.screeningUrl ?? ""}
          maxLength={500}
          placeholder="https://…"
        />
        {/*
          This is where every applicant is sent (D-031). A wrong value routes
          people to the wrong questionnaire and nothing downstream notices, so
          the warning sits next to the field rather than in a manual.
        */}
        <p className="text-xs text-muted-foreground">{labels.screeningUrlHelp}</p>
      </div>

      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        {state.ok ? <p className="text-sm text-muted-foreground">{labels.saved}</p> : null}
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

/**
 * Create an automation rule.
 *
 * The form follows the sentence a rule actually is: WHEN this happens, THIS long
 * before or after it, DO this, IF these still hold. The fields for the action
 * swap with the action kind, because a MESSAGE rule needs a template and a TASK
 * rule needs a title, and showing all three at once invites a row that fails the
 * shape constraint.
 */
export function CreateRuleForm({
  events,
  actionKinds,
  deliveryModes,
  templates,
  alertKinds,
  priorities,
  conditions,
  labels,
}: {
  events: { value: string; label: string }[];
  actionKinds: { value: ActionKind; label: string }[];
  deliveryModes: { value: string; label: string; available: boolean }[];
  templates: { value: string; label: string }[];
  alertKinds: { value: string; label: string }[];
  priorities: { value: string; label: string }[];
  conditions: { value: string; label: string }[];
  labels: SettingsLabels & {
    key: string;
    name: string;
    event: string;
    offset: string;
    offsetHelp: string;
    actionKind: string;
    deliveryMode: string;
    deliveryUnavailable: string;
    template: string;
    taskTitle: string;
    priority: string;
    alertKind: string;
    conditions: string;
    conditionsHelp: string;
  };
}) {
  const [state, action, pending] = useActionState(createRuleAction, initial);
  const [kind, setKind] = useState<ActionKind>("MESSAGE");

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="ruleKey">{labels.key}</Label>
        <Input id="ruleKey" name="key" required maxLength={48} placeholder="recordatorio-vispera" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ruleName">{labels.name}</Label>
        <Input id="ruleName" name="nameEs" required maxLength={RULE_NAME_MAX_LENGTH} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ruleEvent">{labels.event}</Label>
        <select id="ruleEvent" name="eventType" required className={SELECT_CLASS}>
          {events.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ruleOffset">{labels.offset}</Label>
        <Input
          id="ruleOffset"
          name="offsetMinutes"
          type="number"
          defaultValue={0}
          min={OFFSET_MINUTES_MIN}
          max={OFFSET_MINUTES_MAX}
          step={1}
        />
        <p className="text-xs text-muted-foreground">{labels.offsetHelp}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ruleAction">{labels.actionKind}</Label>
        <select
          id="ruleAction"
          name="actionKind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ActionKind)}
          className={SELECT_CLASS}
        >
          {actionKinds.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {kind === "MESSAGE" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ruleTemplate">{labels.template}</Label>
            <select id="ruleTemplate" name="communicationTemplateId" className={SELECT_CLASS}>
              {templates.map((tpl) => (
                <option key={tpl.value} value={tpl.value}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ruleDelivery">{labels.deliveryMode}</Label>
            <select id="ruleDelivery" name="deliveryMode" className={SELECT_CLASS}>
              {deliveryModes.map((m) => (
                // AUTOMATIC is shown and disabled rather than hidden. Someone
                // looking for it should find out that it does not exist and
                // why, not wonder whether they missed it (D-043).
                <option key={m.value} value={m.value} disabled={!m.available}>
                  {m.available ? m.label : `${m.label} — ${labels.deliveryUnavailable}`}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {kind === "TASK" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ruleTaskTitle">{labels.taskTitle}</Label>
            <Input id="ruleTaskTitle" name="taskTitleEs" maxLength={TASK_TITLE_MAX_LENGTH} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rulePriority">{labels.priority}</Label>
            <select
              id="rulePriority"
              name="taskPriority"
              defaultValue="NORMAL"
              className={SELECT_CLASS}
            >
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {kind === "ALERT" ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ruleAlertKind">{labels.alertKind}</Label>
          <select id="ruleAlertKind" name="alertKind" className={SELECT_CLASS}>
            {alertKinds.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium">{labels.conditions}</legend>
        {/*
          Checkboxes, and nothing else. There is no operator field and no value
          field because the condition vocabulary is a closed list of booleans —
          which is what stops a rule ever being written against a screening
          result (D-043).
        */}
        <p className="text-xs text-muted-foreground">{labels.conditionsHelp}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {conditions.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="conditions"
                value={c.value}
                className="size-4 rounded border-input"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

/**
 * Turn a rule on or off.
 *
 * Deactivating stops NEW actions being scheduled; the ones already planned stay,
 * and are re-checked when they come due.
 */
export function ToggleRuleForm({
  ruleId,
  active,
  labels,
}: {
  ruleId: string;
  active: boolean;
  labels: SettingsLabels;
}) {
  const [state, action, pending] = useActionState(toggleRuleAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
