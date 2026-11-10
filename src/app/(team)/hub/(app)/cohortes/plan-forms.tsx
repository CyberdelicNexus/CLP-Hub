"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, Mail, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  setParticipantVisitAction,
  setPlannedMessageAction,
  setVisitQuestionnaireAction,
  type PlanState,
} from "./plan-actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: PlanState = { error: null };

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function useErrorToast(state: PlanState, errors: Record<string, string>, saved?: string) {
  useEffect(() => {
    if (state.error) toast.error(errors[state.error] ?? errors.failed);
    else if (state.ok && saved) toast.success(saved);
  }, [state, errors, saved]);
}

/**
 * One participant's date for an individual session (S0's home visit, the POST
 * pickup). Clearing the field and saving removes the date.
 */
export function VisitDateForm({
  cohortId,
  participantId,
  templateId,
  value,
  labels,
  saveAction = setParticipantVisitAction,
}: {
  cohortId: string;
  participantId: string;
  templateId: string;
  /** `datetime-local` in the study's timezone, or "" when not set. */
  value: string;
  labels: { when: string; save: string; saved: string; errors: Record<string, string> };
  /** VR logistics saves through its own action; the visit is the same one. */
  saveAction?: typeof setParticipantVisitAction;
}) {
  const [state, action, pending] = useActionState(saveAction, initial);
  const [current, setCurrent] = useState(value);
  useErrorToast(state, labels.errors, labels.saved);
  const dirty = current !== value;
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="templateId" value={templateId} />
      <Input
        type="datetime-local"
        name="scheduledAt"
        aria-label={labels.when}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="h-8 min-w-0 flex-1 text-sm"
      />
      <Button
        type="submit"
        size="sm"
        variant={dirty ? "default" : "outline"}
        className="rounded-lg"
        disabled={pending || !dirty}
      >
        {labels.save}
      </Button>
    </form>
  );
}

/**
 * That the questionnaire was filled in at the visit. Saves as it is ticked, and
 * waits for a date: the record lives on the booked visit.
 */
export function VisitQuestionnaireCheck({
  participantId,
  templateId,
  capturedLabel,
  booked,
  canManage,
  labels,
}: {
  participantId: string;
  templateId: string;
  /** The formatted date it was recorded, or null when it has not been. */
  capturedLabel: string | null;
  booked: boolean;
  canManage: boolean;
  labels: { check: string; needsDate: string; errors: Record<string, string> };
}) {
  const [state, action, pending] = useActionState(setVisitQuestionnaireAction, initial);
  useErrorToast(state, labels.errors);
  const captured = capturedLabel !== null;
  return (
    <form action={action}>
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="captured" value={captured ? "off" : "on"} />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={captured}
          disabled={!canManage || !booked || pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="mt-0.5 size-4 rounded border-input accent-primary"
        />
        <span className="leading-snug">
          {labels.check}
          {capturedLabel ? (
            <span data-numeric className="block text-xs text-muted-foreground">
              {capturedLabel}
            </span>
          ) : !booked ? (
            <span className="block text-xs text-muted-foreground">{labels.needsDate}</span>
          ) : null}
        </span>
      </label>
    </form>
  );
}

export interface PlanEntryView {
  id: string;
  templateId: string;
  name: string;
  body: string;
  channel: "EMAIL" | "WHATSAPP" | string;
  /** `datetime-local` in the study's timezone. */
  sendAt: string;
  /** Formatted for display. */
  sendAtLabel: string;
  status: "PLANNED" | "SENT" | "PARTIAL" | "FAILED" | "CANCELLED";
  /** Null when it will go out on its own; else a short reason it is copy-only. */
  manualReason: string | null;
}

/**
 * The control group's plan (2026-10-28): each message with its date, whether
 * it sends itself or is a reminder to copy, and the text ready to paste.
 */
export function PlanEntryRow({
  cohortId,
  entry,
  canManage,
  labels,
}: {
  cohortId: string;
  entry: PlanEntryView;
  canManage: boolean;
  labels: {
    automatic: string;
    manual: string;
    status: Record<PlanEntryView["status"], string>;
    save: string;
    remove: string;
    copy: string;
    copied: string;
    saved: string;
    errors: Record<string, string>;
  };
}) {
  const [state, action, pending] = useActionState(setPlannedMessageAction, initial);
  const [when, setWhen] = useState(entry.sendAt);
  const [copied, setCopied] = useState(false);
  useErrorToast(state, labels.errors, labels.saved);
  const locked = entry.status !== "PLANNED";
  const Icon = entry.channel === "EMAIL" ? Mail : MessageSquare;

  return (
    <li className="space-y-2 rounded-xl bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={entry.name}>
          {entry.name}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
            entry.manualReason ? "bg-surface-peach text-surface-peach-ink" : "bg-surface-mint text-surface-mint-ink",
          )}
          title={entry.manualReason ?? undefined}
        >
          {entry.manualReason ? labels.manual : labels.automatic}
        </span>
        {locked ? (
          <span className="rounded-full bg-card px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-foreground/10">
            {labels.status[entry.status]}
          </span>
        ) : null}
      </div>
      {entry.manualReason ? <p className="text-xs text-muted-foreground">{entry.manualReason}</p> : null}

      <form action={action} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="cohortId" value={cohortId} />
        <input type="hidden" name="templateId" value={entry.templateId} />
        {canManage && !locked ? (
          <>
            <Input
              type="datetime-local"
              name="sendAt"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="h-8 w-auto text-sm"
              required
            />
            <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending || when === entry.sendAt}>
              {labels.save}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="remove"
              size="icon-sm"
              variant="ghost"
              aria-label={labels.remove}
              title={labels.remove}
              disabled={pending}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </>
        ) : (
          <span data-numeric className="text-sm text-muted-foreground">
            {entry.sendAtLabel}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto gap-1 rounded-lg"
          onClick={async () => {
            await navigator.clipboard.writeText(entry.body);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? labels.copied : labels.copy}
        </Button>
      </form>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{labels.copy}…</summary>
        <p className="mt-2 rounded-lg bg-card p-3 leading-relaxed whitespace-pre-wrap ring-1 ring-foreground/5">
          {entry.body}
        </p>
      </details>
    </li>
  );
}

/** Add a template to the plan with its date. */
export function AddPlanEntryForm({
  cohortId,
  options,
  labels,
}: {
  cohortId: string;
  options: { id: string; label: string }[];
  labels: { template: string; when: string; add: string; added: string; errors: Record<string, string> };
}) {
  const [state, action, pending] = useActionState(setPlannedMessageAction, initial);
  useErrorToast(state, labels.errors, labels.added);
  if (options.length === 0) return null;
  return (
    <form key={state.ok ? "done" : "new"} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        {labels.template}
        <select name="templateId" required defaultValue="" className={cn(SELECT_CLASS, "w-full")}>
          <option value="" disabled />
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {labels.when}
        <Input type="datetime-local" name="sendAt" required className="h-8 w-auto text-sm" />
      </label>
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {labels.add}
      </Button>
    </form>
  );
}
