"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/domain/recruitment";
import { changeApplicationStatus, type StatusActionState } from "./actions";

const initialState: StatusActionState = { error: null };

export interface StatusOption {
  value: ApplicationStatus;
  label: string;
}

/**
 * Triage control. Only transitions the domain allows are offered, so an
 * impossible move cannot be attempted from the UI; the service re-checks anyway.
 */
export function StatusForm({
  applicationId,
  options,
  labels,
}: {
  applicationId: string;
  options: StatusOption[];
  labels: { legend: string; submit: string; submitting: string; terminal: string; errors: Record<string, string> };
}) {
  const [state, action, pending] = useActionState(changeApplicationStatus, initialState);

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.terminal}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset className="space-y-2" disabled={pending}>
        <legend className="sr-only">{labels.legend}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              type="submit"
              name="status"
              value={option.value}
              variant="outline"
              size="sm"
              className="rounded-lg"
            >
              {pending ? labels.submitting : option.label}
            </Button>
          ))}
        </div>
      </fieldset>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
