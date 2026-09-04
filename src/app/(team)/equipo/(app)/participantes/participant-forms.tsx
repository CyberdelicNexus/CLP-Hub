"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import {
  closeScreeningAction,
  completeScreeningAction,
  recordConsentAction,
  scheduleScreeningAction,
  setEnrollmentAction,
  startConsentAction,
  type OpState,
} from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: OpState = { error: null };

export interface FormLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: OpState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/** Book a screening appointment. */
export function ScheduleScreeningForm({
  participantId,
  labels,
}: {
  participantId: string;
  labels: FormLabels & { when: string };
}) {
  const [state, action, pending] = useActionState(scheduleScreeningAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="space-y-1.5">
        <Label htmlFor="scheduledAt">{labels.when}</Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/**
 * Record a screening outcome.
 *
 * The only text input is an external record identifier. There is deliberately no
 * notes field: screening content belongs in the approved system, not here.
 */
export function CompleteScreeningForm({
  participantId,
  screeningId,
  results,
  labels,
}: {
  participantId: string;
  screeningId: string;
  results: { value: string; label: string }[];
  labels: FormLabels & { result: string; reference: string; referenceHelp: string };
}) {
  const [state, action, pending] = useActionState(completeScreeningAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="screeningId" value={screeningId} />

      <div className="space-y-1.5">
        <Label htmlFor={`result-${screeningId}`}>{labels.result}</Label>
        <select
          id={`result-${screeningId}`}
          name="result"
          required
          defaultValue=""
          className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled />
          {results.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ref-${screeningId}`}>{labels.reference}</Label>
        <Input
          id={`ref-${screeningId}`}
          name="externalRecordId"
          maxLength={EXTERNAL_RECORD_ID_MAX_LENGTH}
          inputMode="text"
          aria-describedby={`refhelp-${screeningId}`}
        />
        <p id={`refhelp-${screeningId}`} className="text-xs text-muted-foreground">
          {labels.referenceHelp}
        </p>
      </div>

      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/** Close a screening that produced no result. */
export function CloseScreeningForm({
  participantId,
  screeningId,
  options,
  labels,
}: {
  participantId: string;
  screeningId: string;
  options: { value: string; label: string }[];
  labels: FormLabels;
}) {
  const [state, action, pending] = useActionState(closeScreeningAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="screeningId" value={screeningId} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            type="submit"
            name="status"
            value={o.value}
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={pending}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/** Open a consent process against a named form version. */
export function StartConsentForm({
  participantId,
  labels,
}: {
  participantId: string;
  labels: FormLabels & { version: string; versionHelp: string };
}) {
  const [state, action, pending] = useActionState(startConsentAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="space-y-1.5">
        <Label htmlFor="versionLabel">{labels.version}</Label>
        <Input id="versionLabel" name="versionLabel" maxLength={60} required aria-describedby="versionHelp" />
        <p id="versionHelp" className="text-xs text-muted-foreground">
          {labels.versionHelp}
        </p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/** Record the consent decision itself. */
export function ConsentDecisionForm({
  participantId,
  consentId,
  options,
  labels,
}: {
  participantId: string;
  consentId: string;
  options: { value: string; label: string }[];
  labels: FormLabels & { reference: string };
}) {
  const [state, action, pending] = useActionState(recordConsentAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="consentId" value={consentId} />
      <div className="space-y-1.5">
        <Label htmlFor={`cref-${consentId}`}>{labels.reference}</Label>
        <Input id={`cref-${consentId}`} name="externalRecordId" maxLength={EXTERNAL_RECORD_ID_MAX_LENGTH} />
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            type="submit"
            name="status"
            value={o.value}
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={pending}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/** Withdraw or complete a participant's enrollment. */
export function EnrollmentForm({
  participantId,
  options,
  labels,
}: {
  participantId: string;
  options: { value: string; label: string }[];
  labels: FormLabels;
}) {
  const [state, action, pending] = useActionState(setEnrollmentAction, initial);
  if (options.length === 0) return null;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            type="submit"
            name="status"
            value={o.value}
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={pending}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
