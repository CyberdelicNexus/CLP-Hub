"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REASON_NOTE_MAX_LENGTH } from "@/domain/eligibility-reason";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import {
  closeScreeningAction,
  completeExclusionReasonAction,
  completeScreeningAction,
  recordConsentAction,
  scheduleScreeningAction,
  setContactEmailAction,
  setContactNameAction,
  setContactPhoneAction,
  setEnrollmentAction,
  setPhysicalConsentAction,
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

const CONTACT_FIELD_ACTIONS = {
  fullName: setContactNameAction,
  email: setContactEmailAction,
  phone: setContactPhoneAction,
} as const;

/**
 * One field of a participant's contact info (name, email, or phone),
 * editable inline — click the pencil, type, Enter or blur to save
 * (2026-09-19: name only, "bring back the ability to add names to the
 * participants for the demo"; extended 2026-09-20 to email and phone: "I
 * need to be able to edit the person name, email and phone... we do need
 * to know who is the participant... in case we need to reach out
 * directly"). Same pattern as `CoverBanner`'s inline URL field: no
 * separate edit page for one text value.
 *
 * Every call site already gates rendering this at all on
 * `participants.manage` (ADMIN/STUDY_MANAGER only) — `participants.
 * contact.read` alone (also held by LOGISTICS, for shipping) shows the
 * read-only value elsewhere, never this editable one.
 */
export function ContactField({
  field,
  participantId,
  value,
  inputType = "text",
  maxLength = 200,
  labels,
}: {
  field: keyof typeof CONTACT_FIELD_ACTIONS;
  participantId: string;
  value: string | null;
  inputType?: "text" | "email" | "tel";
  maxLength?: number;
  labels: FormLabels & { empty: string; edit: string };
}) {
  const [state, action, pending] = useActionState(CONTACT_FIELD_ACTIONS[field], initial);
  const [editing, setEditing] = useState(false);

  // Drop back to the read view once a save lands — adjusted during render
  // (comparing against the previous `state` object) rather than in an
  // effect, per React's guidance on deriving state from a prop/state change
  // without the extra render an effect-based setState would cost.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <dd className="break-words">{value || labels.empty}</dd>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={labels.edit}
          className="inline-flex rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Pencil className="size-3" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="participantId" value={participantId} />
      <Input
        name={field}
        type={inputType}
        autoFocus
        defaultValue={value ?? ""}
        maxLength={maxLength}
        className="h-7 min-w-0 flex-1 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button type="submit" size="sm" variant="outline" className="h-7 rounded-lg px-2 text-xs" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      {state.error ? (
        <span role="alert" className="basis-full text-xs text-destructive">
          {labels.errors[state.error] ?? state.error}
        </span>
      ) : null}
    </form>
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

/**
 * Add the missing reason to a completed exclusion (D-150): exclusions saved
 * before reasons were required. Shown only on such a screening, collapsed
 * behind one button so the history stays a list. Only reasons that apply to
 * that result are offered; the server re-checks.
 */
export function CompleteReasonForm({
  participantId,
  screeningId,
  result,
  reasons,
  labels,
}: {
  participantId: string;
  screeningId: string;
  result: string;
  reasons: ReasonOption[];
  labels: FormLabels & {
    open: string;
    cancel: string;
    reason: string;
    reasonNote: string;
    reasonNoteHelp: string;
    reasonNoneConfigured: string;
  };
}) {
  const [state, action, pending] = useActionState(completeExclusionReasonAction, initial);
  const [open, setOpen] = useState(false);
  const applicable = reasons.filter((r) => r.appliesTo.includes(result));

  if (state.ok) return null; // the page revalidates and shows the reason
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => setOpen(true)}>
        {labels.open}
      </Button>
    );
  }

  return (
    <form action={action} className="mt-2 w-full space-y-3 rounded-xl bg-muted/50 p-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="screeningId" value={screeningId} />
      {applicable.length === 0 ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.reasonNoneConfigured}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`addreason-${screeningId}`}>
              {labels.reason}
              <span aria-hidden> *</span>
            </Label>
            <select
              id={`addreason-${screeningId}`}
              name="reasonId"
              required
              defaultValue=""
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled />
              {applicable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`addnote-${screeningId}`}>{labels.reasonNote}</Label>
            <Input
              id={`addnote-${screeningId}`}
              name="reasonNote"
              maxLength={REASON_NOTE_MAX_LENGTH}
              aria-describedby={`addnotehelp-${screeningId}`}
            />
            <p id={`addnotehelp-${screeningId}`} className="text-xs text-muted-foreground">
              {labels.reasonNoteHelp}
            </p>
          </div>
        </>
      )}
      <ErrorLine state={state} errors={labels.errors} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending || applicable.length === 0}>
          {pending ? labels.submitting : labels.submit}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => setOpen(false)}>
          {labels.cancel}
        </Button>
      </div>
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

/** A configured authorization the physical consent may grant. */
export interface ScopeOption {
  code: string;
  label: string;
}

/**
 * The physical consent as one tick (D-139), on the participant and on the card
 * of the visit where it is signed. Ticking reveals the study's configured
 * authorizations, each left unticked: a pre-ticked box is not consent. Parents
 * key this by the consent's id, so it starts clean after a tick or an undo.
 *
 * "Undo" is for a tick made by mistake. A person changing their mind is a
 * withdrawal, recorded on the participant.
 */
export function PhysicalConsentCheck({
  participantId,
  signed,
  scopes,
  canManage,
  labels,
}: {
  participantId: string;
  signed: { dateLabel: string; scopes: string[] } | null;
  scopes: ScopeOption[];
  canManage: boolean;
  labels: { check: string; scopes: string; save: string; undo: string; errors: Record<string, string> };
}) {
  const [state, action, pending] = useActionState(setPhysicalConsentAction, initial);
  const [ticked, setTicked] = useState(false);

  if (signed) {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-2 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 leading-snug">
            {labels.check}
            <span data-numeric className="block text-xs text-muted-foreground">
              {signed.dateLabel}
            </span>
            {signed.scopes.length > 0 ? (
              <span className="block text-xs text-muted-foreground">{signed.scopes.join(" · ")}</span>
            ) : null}
          </span>
          {canManage ? (
            <form action={action}>
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="signed" value="off" />
              <button
                type="submit"
                disabled={pending}
                className="rounded text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {labels.undo}
              </button>
            </form>
          ) : null}
        </div>
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="signed" value="on" />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={ticked}
          disabled={!canManage}
          onChange={(e) => setTicked(e.target.checked)}
          className="mt-0.5 size-4 rounded border-input accent-primary"
        />
        <span className="leading-snug">{labels.check}</span>
      </label>
      {ticked ? (
        <div className="space-y-1.5 pl-6">
          {scopes.length > 0 ? (
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-muted-foreground">{labels.scopes}</legend>
              {scopes.map((sc) => (
                <label key={sc.code} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="grantedScopes"
                    value={sc.code}
                    // Never defaultChecked. A pre-ticked box is not consent.
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <span className="leading-snug">{sc.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
            {labels.save}
          </Button>
        </div>
      ) : null}
      <ErrorLine state={state} errors={labels.errors} />
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
