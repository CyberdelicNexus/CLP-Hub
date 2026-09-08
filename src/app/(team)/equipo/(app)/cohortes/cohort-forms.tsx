"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import {
  advanceCohortAction,
  assignStaffAction,
  assignToCohortAction,
  createCohortAction,
  recordRandomizationAction,
  removeFromCohortAction,
  revokeStaffAction,
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
  labels,
}: {
  labels: Labels & {
    code: string;
    name: string;
    start: string;
    end: string;
    capacity: string;
    capacityHelp: string;
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
      <div className="space-y-1.5">
        <Label htmlFor="capacity">{labels.capacity}</Label>
        <Input id="capacity" name="capacity" type="number" min={1} />
        <p className="text-xs text-muted-foreground">{labels.capacityHelp}</p>
      </div>
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

export function AdvanceCohortForm({
  cohortId,
  next,
  labels,
}: {
  cohortId: string;
  next: { value: string; label: string } | null;
  labels: Labels & { terminal: string };
}) {
  const [state, action, pending] = useActionState(advanceCohortAction, initial);
  if (!next) return <p className="text-sm text-muted-foreground">{labels.terminal}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <Button
        type="submit"
        name="status"
        value={next.value}
        variant="outline"
        size="sm"
        className="rounded-lg"
        disabled={pending}
      >
        {pending ? labels.submitting : next.label}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
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

export function RevokeStaffForm({
  cohortId,
  userId,
  labels,
}: {
  cohortId: string;
  userId: string;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState(revokeStaffAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="ghost" size="xs" className="rounded-md" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
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
