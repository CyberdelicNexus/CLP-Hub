"use client";

import { useActionState, useState } from "react";
import { Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/domain/recruitment";
import { correctApplicationStatus, type StatusActionState } from "./actions";
import type { StatusOption } from "./status-form";

const initialState: StatusActionState = { error: null };

/**
 * Escape valve for a staff mistake, separate from the normal triage buttons
 * (StatusForm): any status to any other, not limited by the forward-only
 * transition graph. Collapsed by default, and moving to a status takes two
 * clicks (pick it, then confirm) rather than one, so it can't be triggered by
 * the same stray click that a single triage button would catch. The service
 * audits it under its own action (application.status_corrected, D-066), so it
 * never reads as an ordinary transition in the history.
 */
export function CorrectStatusForm({
  applicationId,
  currentStatus,
  options,
  labels,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
  options: StatusOption[];
  labels: {
    trigger: string;
    help: string;
    confirm: string;
    cancel: string;
    submitting: string;
    errors: Record<string, string>;
  };
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ApplicationStatus | null>(null);
  const [state, action, pending] = useActionState(correctApplicationStatus, initialState);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Wrench className="size-3.5" aria-hidden />
        {labels.trigger}
      </Button>
    );
  }

  const choices = options.filter((o) => o.value !== currentStatus);

  return (
    <form
      action={action}
      className="space-y-2 rounded-xl p-3"
      style={{ background: "var(--status-warning-bg)" }}
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--status-warning-fg)" }}>
          {labels.help}
        </p>
        <button
          type="button"
          aria-label={labels.cancel}
          onClick={() => {
            setOpen(false);
            setPicked(null);
          }}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <fieldset className="flex flex-wrap gap-2" disabled={pending}>
        <legend className="sr-only">{labels.trigger}</legend>
        {choices.map((option) =>
          picked === option.value ? (
            <Button
              key={option.value}
              type="submit"
              name="status"
              value={option.value}
              variant="destructive"
              size="sm"
              className="rounded-lg"
            >
              {pending ? labels.submitting : `${labels.confirm}: ${option.label}`}
            </Button>
          ) : (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setPicked(option.value)}
            >
              {option.label}
            </Button>
          ),
        )}
      </fieldset>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
