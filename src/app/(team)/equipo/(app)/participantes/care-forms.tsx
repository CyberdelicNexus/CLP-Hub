"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VISIT_LOCATION_MAX_LENGTH, VISIT_NOTES_MAX_LENGTH } from "@/domain/responsibility";
import {
  assignResponsibleAction,
  closeInitialVisitAction,
  revokeResponsibleAction,
  scheduleInitialVisitAction,
  updateVisitNotesAction,
  type CareState,
} from "./care-actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: CareState = { error: null };

export interface CareLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function ErrorLine({ state, errors }: { state: CareState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/**
 * Name who is responsible for one aspect of a participant.
 *
 * Assigning replaces whoever held the role before — two people simultaneously
 * responsible for the headset is how a headset ends up with nobody carrying it —
 * so the control is a single select rather than an add-to-list.
 */
export function AssignResponsibleForm({
  participantId,
  role,
  candidates,
  current,
  labels,
}: {
  participantId: string;
  role: string;
  candidates: { id: string; label: string }[];
  current: { userId: string; displayName: string } | null;
  labels: CareLabels & { person: string; replace: string; none: string };
}) {
  const [state, action, pending] = useActionState(assignResponsibleAction, initial);
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.none}</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="role" value={role} />
      <div className="space-y-1.5">
        <Label htmlFor={`user-${role}`}>{labels.person}</Label>
        <select
          id={`user-${role}`}
          name="userId"
          required
          defaultValue={current?.userId ?? ""}
          className={SELECT_CLASS}
        >
          <option value="" disabled />
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : current ? labels.replace : labels.submit}
      </Button>
    </form>
  );
}

/** Step down from a responsibility without naming a successor. */
export function RevokeResponsibleForm({
  participantId,
  role,
  labels,
}: {
  participantId: string;
  role: string;
  labels: CareLabels;
}) {
  const [state, action, pending] = useActionState(revokeResponsibleAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="role" value={role} />
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/**
 * Book the initial visit.
 *
 * The notes field is the most open input in the application, so the help text
 * under it is not decoration: it is the only thing standing between "aparcar
 * detrás" and a clinical narrative that does not belong in this database.
 */
export function ScheduleVisitForm({
  participantId,
  labels,
}: {
  participantId: string;
  labels: CareLabels & {
    when: string;
    location: string;
    notes: string;
    notesHelp: string;
  };
}) {
  const [state, action, pending] = useActionState(scheduleInitialVisitAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="space-y-1.5">
        <Label htmlFor="visitAt">{labels.when}</Label>
        <Input id="visitAt" name="scheduledAt" type="datetime-local" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visitLocation">{labels.location}</Label>
        <Input id="visitLocation" name="location" maxLength={VISIT_LOCATION_MAX_LENGTH} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visitNotes">{labels.notes}</Label>
        <textarea
          id="visitNotes"
          name="notes"
          rows={3}
          maxLength={VISIT_NOTES_MAX_LENGTH}
          aria-describedby="visitNotesHelp"
          className="w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p id="visitNotesHelp" className="text-xs text-muted-foreground">
          {labels.notesHelp}
        </p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/** Record what happened at the visit. A visit that happened is never rewritten. */
export function CloseVisitForm({
  participantId,
  visitId,
  options,
  labels,
}: {
  participantId: string;
  visitId: string;
  options: { value: string; label: string }[];
  labels: CareLabels & { outcome: string; notes: string; notesHelp: string };
}) {
  const [state, action, pending] = useActionState(closeInitialVisitAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="visitId" value={visitId} />
      <div className="space-y-1.5">
        <Label htmlFor={`outcome-${visitId}`}>{labels.outcome}</Label>
        <select
          id={`outcome-${visitId}`}
          name="status"
          required
          defaultValue=""
          className={SELECT_CLASS}
        >
          <option value="" disabled />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`closenotes-${visitId}`}>{labels.notes}</Label>
        <textarea
          id={`closenotes-${visitId}`}
          name="notes"
          rows={2}
          maxLength={VISIT_NOTES_MAX_LENGTH}
          aria-describedby={`closehelp-${visitId}`}
          className="w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p id={`closehelp-${visitId}`} className="text-xs text-muted-foreground">
          {labels.notesHelp}
        </p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/** Edit the logistics on an open visit without closing it. */
export function VisitNotesForm({
  participantId,
  visitId,
  currentNotes,
  currentLocation,
  labels,
}: {
  participantId: string;
  visitId: string;
  currentNotes: string | null;
  currentLocation: string | null;
  labels: CareLabels & { location: string; notes: string; notesHelp: string };
}) {
  const [state, action, pending] = useActionState(updateVisitNotesAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="visitId" value={visitId} />
      <div className="space-y-1.5">
        <Label htmlFor={`loc-${visitId}`}>{labels.location}</Label>
        <Input
          id={`loc-${visitId}`}
          name="location"
          maxLength={VISIT_LOCATION_MAX_LENGTH}
          defaultValue={currentLocation ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${visitId}`}>{labels.notes}</Label>
        <textarea
          id={`notes-${visitId}`}
          name="notes"
          rows={3}
          maxLength={VISIT_NOTES_MAX_LENGTH}
          defaultValue={currentNotes ?? ""}
          aria-describedby={`help-${visitId}`}
          className="w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p id={`help-${visitId}`} className="text-xs text-muted-foreground">
          {labels.notesHelp}
        </p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
