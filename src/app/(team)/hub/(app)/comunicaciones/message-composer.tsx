"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import {
  renderTemplate,
  variablesFor,
  type CommunicationAudience,
  type TemplateValues,
  type TemplateVariable,
} from "@/domain/communication";
import { markSentAction, type CommsState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: CommsState = { error: null };

export interface ComposerTemplate {
  id: string;
  name: string;
  stageLabel: string;
  /** Session this message belongs to, or null when it is not about one. */
  sessionName: string | null;
  body: string;
}

/**
 * Pick a template, fill the gaps, preview it, copy it, then say you sent it.
 *
 * THE RENDERED MESSAGE NEVER LEAVES THE BROWSER. It is built here from the
 * template and the values, shown, and copied to the clipboard. The form that
 * marks it as sent submits the template id and the subject id — never the text,
 * because a hidden field is how a rendered message containing someone's name
 * ends up in the database (D-039).
 *
 * The same component serves both audiences. For a cohort channel it simply
 * offers fewer variables: `nombre` and `codigo` are not in `variablesFor`, so
 * there is no input for them and nothing to accidentally paste into a group
 * where everyone can read it (D-041).
 */
export function MessageComposer({
  subject,
  audience,
  templates,
  suggested,
  canReadContact,
  actionId,
  initialTemplateId,
  labels,
}: {
  subject: { kind: "PARTICIPANT" | "COHORT_CHANNEL"; id: string };
  audience: CommunicationAudience;
  templates: ComposerTemplate[];
  suggested: TemplateValues;
  canReadContact: boolean;
  /**
   * The prepared action this send answers, when the composer was opened from
   * the queue. Submitted so the queue item closes and the timeline can say
   * which scheduled reminder this particular message was (Phase 8).
   */
  actionId?: string;
  /** The template the queue item is for, so the right one is already chosen. */
  initialTemplateId?: string;
  labels: {
    template: string;
    values: string;
    preview: string;
    copy: string;
    copied: string;
    markSent: string;
    markSkipped: string;
    skipReason: string;
    missing: string;
    redacted: string;
    noTemplates: string;
    submitting: string;
    errors: Record<string, string>;
    variable: Record<string, string>;
  };
}) {
  const [state, action, pending] = useActionState(markSentAction, initial);
  const [templateId, setTemplateId] = useState(
    initialTemplateId && templates.some((t) => t.id === initialTemplateId)
      ? initialTemplateId
      : (templates[0]?.id ?? ""),
  );
  const [values, setValues] = useState<TemplateValues>(suggested);
  const [copied, setCopied] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? null;

  const rendered = useMemo(
    () =>
      template
        ? renderTemplate(template.body, values, { canReadContact })
        : { text: "", missing: [], redacted: [] },
    [template, values, canReadContact],
  );

  // Only the variables this template uses AND this audience allows. Showing all
  // nine for a two-line reminder buries the two that matter.
  const used = useMemo(() => {
    if (!template) return [] as TemplateVariable[];
    const allowed = variablesFor(audience);
    return allowed.filter((v) => template.body.includes(`{{${v}}}`));
  }, [template, audience]);

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.noTemplates}</p>;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(rendered.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (permissions, insecure context). The textarea
      // below is selectable, so there is always a manual way out; silently
      // failing here is better than an alert that blocks the page.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="templateId">{labels.template}</Label>
        <select
          id="templateId"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.sessionName
                ? `${t.stageLabel} · ${t.sessionName} · ${t.name}`
                : `${t.stageLabel} · ${t.name}`}
            </option>
          ))}
        </select>
      </div>

      {used.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {labels.values}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {used.map((v) => (
              <div key={v} className="space-y-1.5">
                <Label htmlFor={`val-${v}`} className="text-xs">
                  {labels.variable[v] ?? v}
                </Label>
                <Input
                  id={`val-${v}`}
                  value={values[v] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  maxLength={200}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="preview">{labels.preview}</Label>
          {rendered.missing.length > 0 ? (
            <StatusBadge tone="warning">
              {labels.missing}: {rendered.missing.join(", ")}
            </StatusBadge>
          ) : null}
          {rendered.redacted.length > 0 ? (
            <StatusBadge tone="info">{labels.redacted}</StatusBadge>
          ) : null}
        </div>

        {/*
          readOnly rather than disabled: the text stays selectable, so a viewer
          whose clipboard API is blocked can still select and copy by hand.
        */}
        <textarea
          id="preview"
          readOnly
          value={rendered.text}
          rows={8}
          className="w-full rounded-xl border border-input bg-muted/40 px-3 py-2 font-mono text-sm whitespace-pre-wrap outline-none"
        />

        <Button type="button" onClick={copy} size="sm" className="rounded-lg">
          {copied ? (
            <>
              <Check className="mr-1.5 size-4" aria-hidden />
              {labels.copied}
            </>
          ) : (
            <>
              <Copy className="mr-1.5 size-4" aria-hidden />
              {labels.copy}
            </>
          )}
        </Button>
      </div>

      {/*
        Note what this form does NOT carry: the rendered text. Only the template
        id and the one subject id are submitted.
      */}
      <form action={action} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        {subject.kind === "PARTICIPANT" ? (
          <input type="hidden" name="participantId" value={subject.id} />
        ) : (
          <input type="hidden" name="cohortId" value={subject.id} />
        )}
        <input type="hidden" name="templateId" value={templateId} />
        {actionId ? <input type="hidden" name="actionId" value={actionId} /> : null}
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="skipReason" className="text-xs">
            {labels.skipReason}
          </Label>
          <Input id="skipReason" name="skipReason" maxLength={280} />
        </div>
        <Button
          type="submit"
          name="status"
          value="SENT"
          size="sm"
          className="rounded-lg"
          disabled={pending || !templateId}
        >
          {pending ? labels.submitting : labels.markSent}
        </Button>
        <Button
          type="submit"
          name="status"
          value="SKIPPED"
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={pending || !templateId}
        >
          {labels.markSkipped}
        </Button>
        {state.error ? (
          <p role="alert" className="w-full text-sm text-destructive">
            {labels.errors[state.error] ?? state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
