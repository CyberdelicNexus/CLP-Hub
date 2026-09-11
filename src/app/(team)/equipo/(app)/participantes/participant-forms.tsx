"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REASON_NOTE_MAX_LENGTH } from "@/domain/eligibility-reason";
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

/** A reason as the form needs it: which results it may be attached to. */
export interface ReasonOption {
  id: string;
  label: string;
  /** Eligibility statuses this reason applies to. */
  appliesTo: string[];
}

/**
 * Record a screening outcome.
 *
 * Two text inputs, both deliberately narrow: an external record identifier, and
 * a one-line reason note. There is still no general notes field — screening
 * content belongs in the approved system, not here (D-019).
 *
 * The reason select is driven by the chosen result rather than always shown:
 * INELIGIBLE and REVIEW_REQUIRED require one, WAITLIST may carry one, and
 * ELIGIBLE accepts none at all, because a reason recorded beside an inclusion
 * would be a clinical justification (D-030). The server re-checks all of this;
 * the client behaviour exists so staff are not offered an invalid combination.
 */
export function CompleteScreeningForm({
  participantId,
  screeningId,
  results,
  reasons,
  labels,
}: {
  participantId: string;
  screeningId: string;
  results: { value: string; label: string }[];
  reasons: ReasonOption[];
  labels: FormLabels & {
    result: string;
    reference: string;
    referenceHelp: string;
    reason: string;
    reasonRequiredHint: string;
    reasonNote: string;
    reasonNoteHelp: string;
    reasonNoneConfigured: string;
  };
}) {
  const [state, action, pending] = useActionState(completeScreeningAction, initial);
  const [result, setResult] = useState("");

  const applicable = reasons.filter((r) => r.appliesTo.includes(result));
  const required = result === "INELIGIBLE" || result === "REVIEW_REQUIRED";
  const showReason = applicable.length > 0 || required;

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
          value={result}
          onChange={(e) => setResult(e.target.value)}
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

      {showReason ? (
        <div className="space-y-1.5">
          <Label htmlFor={`reason-${screeningId}`}>
            {labels.reason}
            {required ? <span aria-hidden> *</span> : null}
          </Label>
          {applicable.length > 0 ? (
            <select
              id={`reason-${screeningId}`}
              name="reasonId"
              required={required}
              defaultValue=""
              aria-describedby={required ? `reasonhint-${screeningId}` : undefined}
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled={required} />
              {applicable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            /*
              Required but nothing configured. Saying so is better than an empty
              select: the fix is a configuration change, not a retry, and the
              server would refuse the submission anyway.
            */
            <p role="alert" className="text-sm text-destructive">
              {labels.reasonNoneConfigured}
            </p>
          )}
          {required ? (
            <p id={`reasonhint-${screeningId}`} className="text-xs text-muted-foreground">
              {labels.reasonRequiredHint}
            </p>
          ) : null}
        </div>
      ) : null}

      {showReason && applicable.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor={`note-${screeningId}`}>{labels.reasonNote}</Label>
          <Input
            id={`note-${screeningId}`}
            name="reasonNote"
            maxLength={REASON_NOTE_MAX_LENGTH}
            aria-describedby={`notehelp-${screeningId}`}
          />
          <p id={`notehelp-${screeningId}`} className="text-xs text-muted-foreground">
            {labels.reasonNoteHelp}
          </p>
        </div>
      ) : null}

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
/** A configured authorization the physical consent may grant. */
export interface ScopeOption {
  code: string;
  label: string;
}

/**
 * Open a consent process.
 *
 * The type is chosen explicitly because the two are genuinely different events
 * (D-032): DIGITAL was accepted remotely before any data existed, PHYSICAL is
 * signed at the initial visit. Starting one never retires the other.
 *
 * The authorization checkboxes appear only for PHYSICAL, and only when the study
 * has configured any. They are unchecked by default and stay that way — a
 * pre-ticked consent box is not consent, and the labels come from configuration
 * so no trial's media plan is written into this component.
 */
export function StartConsentForm({
  participantId,
  types,
  scopes,
  labels,
}: {
  participantId: string;
  types: { value: string; label: string }[];
  scopes: ScopeOption[];
  labels: FormLabels & {
    version: string;
    versionHelp: string;
    type: string;
    scopes: string;
    scopesHelp: string;
  };
}) {
  const [state, action, pending] = useActionState(startConsentAction, initial);
  const [type, setType] = useState(types[0]?.value ?? "DIGITAL");
  const showScopes = type === "PHYSICAL" && scopes.length > 0;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />

      <div className="space-y-1.5">
        <Label htmlFor="consentType">{labels.type}</Label>
        <select
          id="consentType"
          name="consentType"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {types.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="versionLabel">{labels.version}</Label>
        <Input id="versionLabel" name="versionLabel" maxLength={60} required aria-describedby="versionHelp" />
        <p id="versionHelp" className="text-xs text-muted-foreground">
          {labels.versionHelp}
        </p>
      </div>

      {showScopes ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{labels.scopes}</legend>
          <p className="text-xs text-muted-foreground">{labels.scopesHelp}</p>
          {scopes.map((sc) => (
            <label key={sc.code} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="grantedScopes"
                value={sc.code}
                // Never defaultChecked. A pre-ticked box is not consent.
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span className="leading-relaxed">{sc.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

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
