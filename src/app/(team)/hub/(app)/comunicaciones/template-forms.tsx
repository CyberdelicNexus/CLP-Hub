"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TEMPLATE_BODY_MAX_LENGTH,
  variablesFor,
  type CommunicationAudience,
} from "@/domain/communication";
import { createTemplateAction, updateTemplateAction, type CommsState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: CommsState = { error: null };

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-card px-2 py-1.5 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export interface TemplateLabels {
  submit: string;
  submitting: string;
  key: string;
  name: string;
  stage: string;
  channel: string;
  audience: string;
  audienceHelp: string;
  session: string;
  sessionHelp: string;
  sessionNone: string;
  body: string;
  bodyHelp: string;
  variablesTitle: string;
  channelVariablesNote: string;
  errors: Record<string, string>;
  stages: { value: string; label: string }[];
  channels: { value: string; label: string }[];
  audiences: { value: string; label: string }[];
  sessions: { value: string; label: string }[];
}

function ErrorLine({ state, errors }: { state: CommsState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/**
 * The list of usable placeholders, shown beside the editor.
 *
 * Not decoration: the allow-list is enforced on save, so an author who types
 * `{{email}}` gets a refusal. Showing what exists turns that refusal into
 * something they can act on before it happens.
 *
 * The list SHRINKS for a channel template — `nombre` and `codigo` disappear —
 * and a line explains why, because "the variable I used yesterday is gone" is
 * otherwise a confusing way to learn a rule (D-041).
 */
function VariableHints({
  title,
  audience,
  channelNote,
}: {
  title: string;
  audience: CommunicationAudience;
  channelNote: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <p className="flex flex-wrap gap-1.5">
        {variablesFor(audience).map((v) => (
          <code
            key={v}
            className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {`{{${v}}}`}
          </code>
        ))}
      </p>
      {audience === "COHORT_CHANNEL" ? (
        <p className="text-xs text-muted-foreground">{channelNote}</p>
      ) : null}
    </div>
  );
}

const AUDIENCE_DEFAULT: CommunicationAudience = "PARTICIPANT";

export function CreateTemplateForm({ labels }: { labels: TemplateLabels }) {
  const [state, action, pending] = useActionState(createTemplateAction, initial);
  // Drives which variables are offered, live, so the hint list matches the rule
  // that will be applied on save.
  const [audience, setAudience] = useState<CommunicationAudience>(AUDIENCE_DEFAULT);

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tplKey">{labels.key}</Label>
          <Input id="tplKey" name="key" required maxLength={48} placeholder="recordatorio-sesion" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tplName">{labels.name}</Label>
          <Input id="tplName" name="nameEs" required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tplStage">{labels.stage}</Label>
          <select id="tplStage" name="stage" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled />
            {labels.stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tplChannel">{labels.channel}</Label>
          <select
            id="tplChannel"
            name="channel"
            required
            defaultValue="WHATSAPP"
            className={SELECT_CLASS}
          >
            {labels.channels.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tplAudience">{labels.audience}</Label>
          <select
            id="tplAudience"
            name="audience"
            required
            value={audience}
            onChange={(e) => setAudience(e.target.value as CommunicationAudience)}
            className={SELECT_CLASS}
          >
            {labels.audiences.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{labels.audienceHelp}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tplSession">{labels.session}</Label>
          <select id="tplSession" name="sessionTemplateId" defaultValue="" className={SELECT_CLASS}>
            <option value="">{labels.sessionNone}</option>
            {labels.sessions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{labels.sessionHelp}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tplBody">{labels.body}</Label>
        <textarea
          id="tplBody"
          name="bodyEs"
          required
          rows={6}
          maxLength={TEMPLATE_BODY_MAX_LENGTH}
          aria-describedby="tplBodyHelp"
          className={TEXTAREA_CLASS}
        />
        <p id="tplBodyHelp" className="text-xs text-muted-foreground">
          {labels.bodyHelp}
        </p>
      </div>

      <VariableHints
        title={labels.variablesTitle}
        audience={audience}
        channelNote={labels.channelVariablesNote}
      />

      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

export function EditTemplateForm({
  templateId,
  current,
  labels,
}: {
  templateId: string;
  current: {
    nameEs: string;
    bodyEs: string;
    active: boolean;
    /** Not editable: re-scoping a template staff already use changes what is legal in it. */
    audience: CommunicationAudience;
    sessionTemplateId: string | null;
  };
  labels: TemplateLabels & { active: string };
}) {
  const [state, action, pending] = useActionState(updateTemplateAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="templateId" value={templateId} />
      <div className="space-y-1.5">
        <Label htmlFor={`name-${templateId}`}>{labels.name}</Label>
        <Input
          id={`name-${templateId}`}
          name="nameEs"
          required
          maxLength={120}
          defaultValue={current.nameEs}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`body-${templateId}`}>{labels.body}</Label>
        <textarea
          id={`body-${templateId}`}
          name="bodyEs"
          required
          rows={6}
          maxLength={TEMPLATE_BODY_MAX_LENGTH}
          defaultValue={current.bodyEs}
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`session-${templateId}`}>{labels.session}</Label>
        <select
          id={`session-${templateId}`}
          name="sessionTemplateId"
          defaultValue={current.sessionTemplateId ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">{labels.sessionNone}</option>
          {labels.sessions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={current.active}
          className="size-4 rounded border-input accent-primary"
        />
        {labels.active}
      </label>

      <VariableHints
        title={labels.variablesTitle}
        audience={current.audience}
        channelNote={labels.channelVariablesNote}
      />

      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
