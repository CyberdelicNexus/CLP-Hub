"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALERT_DETAIL_MAX_LENGTH } from "@/domain/automation";
import { acknowledgeAlertAction, resolveAlertAction, type AlertState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: AlertState = { error: null };

export interface AlertLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: AlertState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/** "I have seen this." Says nothing about whether it is fixed. */
export function AcknowledgeForm({ alertId, labels }: { alertId: string; labels: AlertLabels }) {
  const [state, action, pending] = useActionState(acknowledgeAlertAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="alertId" value={alertId} />
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/**
 * "This is dealt with", with room to say what was done.
 *
 * The note is optional on purpose. Requiring one would produce a column full of
 * "ok" — and the useful half of the record is who resolved it and when, which is
 * captured either way.
 */
export function ResolveForm({
  alertId,
  labels,
}: {
  alertId: string;
  labels: AlertLabels & { note: string };
}) {
  const [state, action, pending] = useActionState(resolveAlertAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="alertId" value={alertId} />
      <Input
        name="note"
        maxLength={ALERT_DETAIL_MAX_LENGTH}
        placeholder={labels.note}
        aria-label={labels.note}
        className="w-full sm:w-72"
      />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
