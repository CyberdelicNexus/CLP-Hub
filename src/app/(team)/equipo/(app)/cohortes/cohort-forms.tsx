"use client";

import { useActionState } from "react";
import { Archive, ArchiveRestore, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import {
  advanceCohortAction,
  archiveCohortAction,
  assignStaffAction,
  assignToCohortAction,
  createCohortAction,
  deleteCohortAction,
  recordRandomizationAction,
  removeFromCohortAction,
  revokeStaffAction,
  transferCohortAction,
  unarchiveCohortAction,
  updateCohortAction,
  type CohortState,
} from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: CohortState = { error: null };

export interface Labels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: CohortState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function CreateCohortForm({
  arms,
  labels,
}: {
  /** Empty when the study has no arms configured; the field is then hidden. */
  arms: { id: string; label: string }[];
  labels: Labels & {
    code: string;
    name: string;
    start: string;
    end: string;
    minSize: string;
    maxSize: string;
    sizeHelp: string;
    arm: string;
    armHelp: string;
    armAny: string;
  };
}) {
  const [state, action, pending] = useActionState(createCohortAction, initial);
  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">{labels.code}</Label>
        <Input id="code" name="code" required maxLength={32} placeholder="C-2026-A" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">{labels.name}</Label>
        <Input id="name" name="name" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plannedStartDate">{labels.start}</Label>
        <Input id="plannedStartDate" name="plannedStartDate" type="date" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plannedEndDate">{labels.end}</Label>
        <Input id="plannedEndDate" name="plannedEndDate" type="date" />
      </div>

      {arms.length > 0 ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="armId">{labels.arm}</Label>
          {/*
            Defaults to "any arm", which is what every cohort created before this
            phase is. Naming an arm is an added restriction, so it is opt-in.
          */}
          <select id="armId" name="armId" defaultValue="" className={SELECT_CLASS}>
            <option value="">{labels.armAny}</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{labels.armHelp}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="minSize">{labels.minSize}</Label>
        <Input id="minSize" name="minSize" type="number" min={1} inputMode="numeric" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxSize">{labels.maxSize}</Label>
        <Input id="maxSize" name="maxSize" type="number" min={1} inputMode="numeric" />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">{labels.sizeHelp}</p>

      <div className="flex items-end sm:col-span-2">
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

/**
 * Edit a cohort's own configuration. Same fields and shape as
 * `CreateCohortForm`, pre-filled and pointed at `updateCohortAction` instead —
 * status and programme stage are not here, because each moves through its own
 * action with its own rules (`AdvanceCohortForm`, the timeline's stage buttons).
 */
export function EditCohortForm({
  cohort,
  arms,
  labels,
}: {
  cohort: {
    id: string;
    code: string;
    name: string;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    armId: string | null;
    minSize: number | null;
    maxSize: number | null;
  };
  arms: { id: string; label: string }[];
  labels: Labels & {
    code: string;
    name: string;
    start: string;
    end: string;
    minSize: string;
    maxSize: string;
    sizeHelp: string;
    arm: string;
    armHelp: string;
    armAny: string;
    saved: string;
  };
}) {
  const [state, action, pending] = useActionState(updateCohortAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="cohortId" value={cohort.id} />
      <div className="space-y-1.5">
        <Label htmlFor="edit-code">{labels.code}</Label>
        <Input id="edit-code" name="code" required maxLength={32} defaultValue={cohort.code} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-name">{labels.name}</Label>
        <Input id="edit-name" name="name" required maxLength={120} defaultValue={cohort.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-plannedStartDate">{labels.start}</Label>
        <Input
          id="edit-plannedStartDate"
          name="plannedStartDate"
          type="date"
          defaultValue={cohort.plannedStartDate ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-plannedEndDate">{labels.end}</Label>
        <Input
          id="edit-plannedEndDate"
          name="plannedEndDate"
          type="date"
          defaultValue={cohort.plannedEndDate ?? ""}
        />
      </div>

      {arms.length > 0 ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="edit-armId">{labels.arm}</Label>
          <select id="edit-armId" name="armId" defaultValue={cohort.armId ?? ""} className={SELECT_CLASS}>
            <option value="">{labels.armAny}</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{labels.armHelp}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="edit-minSize">{labels.minSize}</Label>
        <Input
          id="edit-minSize"
          name="minSize"
          type="number"
          min={1}
          inputMode="numeric"
          defaultValue={cohort.minSize ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-maxSize">{labels.maxSize}</Label>
        <Input
          id="edit-maxSize"
          name="maxSize"
          type="number"
          min={1}
          inputMode="numeric"
          defaultValue={cohort.maxSize ?? ""}
        />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">{labels.sizeHelp}</p>

      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
        {state.ok ? <p className="text-sm text-muted-foreground">{labels.saved}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

/**
 * Hide a cohort from the ordinary workspace list without touching anything it
 * carries. Reversible from the archived section (`UnarchiveCohortForm`).
 */
export function ArchiveCohortForm({ cohortId, labels }: { cohortId: string; labels: Labels }) {
  const [state, action, pending] = useActionState(archiveCohortAction, initial);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="cohortId" value={cohortId} />
      <Button type="submit" variant="outline" size="xs" className="gap-1 rounded-md" disabled={pending}>
        <Archive className="size-3" aria-hidden />
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

export function UnarchiveCohortForm({ cohortId, labels }: { cohortId: string; labels: Labels }) {
  const [state, action, pending] = useActionState(unarchiveCohortAction, initial);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="cohortId" value={cohortId} />
      <Button type="submit" variant="outline" size="xs" className="gap-1 rounded-md" disabled={pending}>
        <ArchiveRestore className="size-3" aria-hidden />
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/**
 * Permanently remove a cohort. See `deleteCohort` (services/cohorts.ts, D-089)
 * for what this destroys. A one-line reason is required and is submitted with
 * the deletion itself — there is no separate confirmation step here because
 * the dialog this lives in (opened deliberately, never by accident) already
 * is one, the same reasoning `size.confirmSubmit` uses for activating an
 * out-of-bounds cohort.
 */
export function DeleteCohortForm({
  cohortId,
  labels,
}: {
  cohortId: string;
  labels: Labels & { warning: string; reason: string };
}) {
  const [state, action, pending] = useActionState(deleteCohortAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="cohortId" value={cohortId} />
      <p className="rounded-xl bg-surface-peach px-3 py-2 text-xs leading-relaxed text-surface-peach-ink">
        {labels.warning}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="delete-reason">{labels.reason}</Label>
        <Input id="delete-reason" name="reason" required maxLength={280} />
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" variant="destructive" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/**
 * Advance a cohort's lifecycle.
 *
 * The size rule bites here (D-033). When the server refuses, it hands back the
 * counts and this form turns into a confirmation: the same button, plus a
 * required one-line reason that lands on the audit row. It is a speed bump, not
 * a wall — the humans decide whether a cohort of five runs, and the record then
 * says they decided it.
 */
export function AdvanceCohortForm({
  cohortId,
  next,
  labels,
}: {
  cohortId: string;
  next: { value: string; label: string } | null;
  labels: Labels & {
    terminal: string;
    confirmUnder: string;
    confirmOver: string;
    overrideReason: string;
    confirmSubmit: string;
  };
}) {
  const [state, action, pending] = useActionState(advanceCohortAction, initial);
  if (!next) return <p className="text-sm text-muted-foreground">{labels.terminal}</p>;

  const blocked = state.error === "sizeUnder" || state.error === "sizeOver";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="cohortId" value={cohortId} />

      {blocked ? (
        <div className="space-y-2 rounded-xl bg-surface-peach p-3 text-surface-peach-ink">
          <p role="alert" className="text-xs leading-relaxed">
            {state.error === "sizeUnder" ? labels.confirmUnder : labels.confirmOver}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`override-${cohortId}`} className="text-xs">
              {labels.overrideReason}
            </Label>
            <Input
              id={`override-${cohortId}`}
              name="overrideReason"
              required
              maxLength={280}
              className="bg-card"
            />
          </div>
        </div>
      ) : null}

      <Button
        type="submit"
        name="status"
        value={next.value}
        variant={blocked ? "default" : "outline"}
        size="sm"
        className="rounded-lg"
        disabled={pending}
      >
        {pending ? labels.submitting : blocked ? labels.confirmSubmit : next.label}
      </Button>

      {/* The size refusal is rendered above with its own form, not as a plain error. */}
      {blocked ? null : <ErrorLine state={state} errors={labels.errors} />}
    </form>
  );
}

/**
 * Move a participant to a different cohort as one action.
 *
 * Not "remove, then assign": that leaves a moment with no cohort and, if the
 * second step fails, an unexplained departure. The reason is optional but goes
 * on the audit row when given.
 */
export function TransferCohortForm({
  participantId,
  cohorts,
  labels,
}: {
  participantId: string;
  cohorts: { id: string; label: string }[];
  labels: Labels & { target: string; reason: string; reasonHelp: string };
}) {
  const [state, action, pending] = useActionState(transferCohortAction, initial);
  if (cohorts.length === 0) return null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="space-y-1.5">
        <Label htmlFor="toCohortId">{labels.target}</Label>
        <select id="toCohortId" name="toCohortId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled />
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="transferReason">{labels.reason}</Label>
        <Input id="transferReason" name="reason" maxLength={280} />
        <p className="text-xs text-muted-foreground">{labels.reasonHelp}</p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

export function AssignStaffForm({
  cohortId,
  staff,
  labels,
}: {
  cohortId: string;
  staff: { id: string; displayName: string }[];
  labels: Labels & { person: string; note: string };
}) {
  const [state, action, pending] = useActionState(assignStaffAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="space-y-1.5">
        <Label htmlFor="userId">{labels.person}</Label>
        <select id="userId" name="userId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled />
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{labels.note}</p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/**
 * `iconOnly` swaps the labelled button for a small × — the team line's
 * hover-to-remove chip (2026-09-19 request) — with `labels.submit` moved to
 * `aria-label` so it stays announced despite losing its visible text.
 */
export function RevokeStaffForm({
  cohortId,
  userId,
  labels,
  iconOnly,
  className,
}: {
  cohortId: string;
  userId: string;
  labels: Labels;
  iconOnly?: boolean;
  className?: string;
}) {
  const [state, action, pending] = useActionState(revokeStaffAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="userId" value={userId} />
      {iconOnly ? (
        <Button
          type="submit"
          variant="ghost"
          size="icon-xs"
          className={cn("rounded-full", className)}
          disabled={pending}
          aria-label={labels.submit}
        >
          <X className="size-3" aria-hidden />
        </Button>
      ) : (
        <Button type="submit" variant="ghost" size="xs" className="rounded-md" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      )}
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/**
 * Record an allocation produced by the approved mechanism. The form asks which
 * arm was allocated — it never suggests or picks one.
 */
export function RecordRandomizationForm({
  participantId,
  arms,
  labels,
}: {
  participantId: string;
  arms: { id: string; label: string }[];
  labels: Labels & {
    arm: string;
    when: string;
    reference: string;
    boundary: string;
  };
}) {
  const [state, action, pending] = useActionState(recordRandomizationAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <p className="text-xs text-muted-foreground">{labels.boundary}</p>
      <div className="space-y-1.5">
        <Label htmlFor="armId">{labels.arm}</Label>
        <select id="armId" name="armId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled />
          {arms.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="allocatedAt">{labels.when}</Label>
        <Input id="allocatedAt" name="allocatedAt" type="datetime-local" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="allocRef">{labels.reference}</Label>
        <Input id="allocRef" name="externalRecordId" maxLength={EXTERNAL_RECORD_ID_MAX_LENGTH} />
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

export function AssignCohortForm({
  participantId,
  cohorts,
  labels,
}: {
  participantId: string;
  cohorts: { id: string; label: string }[];
  labels: Labels & { cohort: string; none: string };
}) {
  const [state, action, pending] = useActionState(assignToCohortAction, initial);
  if (cohorts.length === 0) return <p className="text-sm text-muted-foreground">{labels.none}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="space-y-1.5">
        <Label htmlFor="cohortId">{labels.cohort}</Label>
        <select id="cohortId" name="cohortId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled />
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

/**
 * The cohort-centric mirror of `AssignCohortForm`: pick a participant to add
 * to THIS cohort, rather than picking a cohort for a given participant. Same
 * action (`assignToCohortAction`, same schema, same server-side checks —
 * arm compatibility and cohort acceptance are enforced there, not duplicated
 * here), just the other direction, so adding someone from the cohort page
 * doesn't need a detour through their own page.
 */
export function AddMemberForm({
  cohortId,
  participants,
  labels,
}: {
  cohortId: string;
  participants: { id: string; label: string }[];
  labels: Labels & { participant: string; none: string };
}) {
  const [state, action, pending] = useActionState(assignToCohortAction, initial);
  if (participants.length === 0) return <p className="text-sm text-muted-foreground">{labels.none}</p>;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="member-participantId">{labels.participant}</Label>
        <select id="member-participantId" name="participantId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled />
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <div className="w-full">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

export function RemoveFromCohortForm({
  participantId,
  labels,
}: {
  participantId: string;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState(removeFromCohortAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="participantId" value={participantId} />
      <Button type="submit" variant="outline" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
