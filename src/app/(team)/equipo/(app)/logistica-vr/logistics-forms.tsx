"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INCIDENT_DESCRIPTION_MAX_LENGTH } from "@/domain/logistics";
import {
  assignDeviceAction,
  closeAssignmentAction,
  createDeviceAction,
  recordMilestoneAction,
  reportIncidentAction,
  reportReadinessAction,
  resolveIncidentAction,
  setDeviceStatusAction,
  type LogisticsState,
} from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: LogisticsState = { error: null };

export interface LogLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function ErrorLine({ state, errors }: { state: LogisticsState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

export function CreateDeviceForm({
  labels,
}: {
  labels: LogLabels & { code: string; model: string; serial: string };
}) {
  const [state, action, pending] = useActionState(createDeviceAction, initial);
  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="deviceCode">{labels.code}</Label>
        <Input id="deviceCode" name="code" required maxLength={32} placeholder="VR-01" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deviceModel">{labels.model}</Label>
        <Input id="deviceModel" name="model" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deviceSerial">{labels.serial}</Label>
        <Input id="deviceSerial" name="serial" maxLength={120} />
      </div>
      <div className="sm:col-span-3">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

/** Move a device between inventory states. Only legal next states are offered. */
export function DeviceStatusForm({
  deviceId,
  options,
  labels,
}: {
  deviceId: string;
  options: { value: string; label: string }[];
  labels: LogLabels & { status: string };
}) {
  const [state, action, pending] = useActionState(setDeviceStatusAction, initial);
  if (options.length === 0) return null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="space-y-1.5">
        <Label htmlFor={`status-${deviceId}`} className="sr-only">
          {labels.status}
        </Label>
        <select
          id={`status-${deviceId}`}
          name="status"
          required
          defaultValue=""
          className={`${SELECT_CLASS} w-48`}
        >
          <option value="" disabled />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <div className="w-full">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

export function AssignDeviceForm({
  devices,
  participants,
  labels,
}: {
  devices: { id: string; label: string }[];
  participants: { id: string; label: string }[];
  labels: LogLabels & {
    device: string;
    participant: string;
    expectedReturn: string;
    expectedReturnHelp: string;
    noDevices: string;
  };
}) {
  const [state, action, pending] = useActionState(assignDeviceAction, initial);
  if (devices.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.noDevices}</p>;
  }

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="assignDevice">{labels.device}</Label>
        <select id="assignDevice" name="deviceId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled />
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assignParticipant">{labels.participant}</Label>
        <select
          id="assignParticipant"
          name="participantId"
          required
          defaultValue=""
          className={SELECT_CLASS}
        >
          <option value="" disabled />
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expectedReturnAt">{labels.expectedReturn}</Label>
        <Input id="expectedReturnAt" name="expectedReturnAt" type="date" />
        <p className="text-xs text-muted-foreground">{labels.expectedReturnHelp}</p>
      </div>
      <div className="sm:col-span-3">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

/**
 * Record a milestone and the device status that goes with it.
 *
 * The status is a choice, not a consequence: "handed over" could mean posted or
 * given in person, and inferring one would put a fact in the database that
 * nobody stated.
 */
export function MilestoneForm({
  assignmentId,
  milestone,
  statuses,
  labels,
}: {
  assignmentId: string;
  milestone: "HANDED_OVER" | "RECEIVED" | "RETURNED";
  statuses: { value: string; label: string }[];
  labels: LogLabels & { status: string };
}) {
  const [state, action, pending] = useActionState(recordMilestoneAction, initial);
  if (statuses.length === 0) return null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="milestone" value={milestone} />
      <div className="space-y-1.5">
        <Label htmlFor={`ms-${assignmentId}-${milestone}`} className="text-xs">
          {labels.status}
        </Label>
        <select
          id={`ms-${assignmentId}-${milestone}`}
          name="deviceStatus"
          required
          defaultValue={statuses[0]?.value ?? ""}
          className={`${SELECT_CLASS} w-44`}
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
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

/** Reported readiness. Never inferred — a person says how the setup went. */
export function ReadinessForm({
  assignmentId,
  options,
  labels,
}: {
  assignmentId: string;
  options: { value: string; label: string }[];
  labels: LogLabels & { readiness: string };
}) {
  const [state, action, pending] = useActionState(reportReadinessAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="space-y-1.5">
        <Label htmlFor={`rd-${assignmentId}`} className="text-xs">
          {labels.readiness}
        </Label>
        <select
          id={`rd-${assignmentId}`}
          name="readiness"
          required
          defaultValue=""
          className={`${SELECT_CLASS} w-44`}
        >
          <option value="" disabled />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <div className="w-full">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

export function CloseAssignmentForm({
  assignmentId,
  labels,
}: {
  assignmentId: string;
  labels: LogLabels;
}) {
  const [state, action, pending] = useActionState(closeAssignmentAction, initial);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/**
 * Report an equipment problem.
 *
 * The help text is doing real work: this is the field where "se mareó" would end
 * up if nobody said that this is about the headset and not about the person.
 */
export function ReportIncidentForm({
  devices,
  labels,
}: {
  devices: { id: string; label: string; assignmentId: string | null }[];
  labels: LogLabels & {
    device: string;
    kind: string;
    description: string;
    descriptionHelp: string;
    kinds: { value: string; label: string }[];
  };
}) {
  const [state, action, pending] = useActionState(reportIncidentAction, initial);
  if (devices.length === 0) return null;

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="incidentDevice">{labels.device}</Label>
          <select
            id="incidentDevice"
            name="deviceId"
            required
            defaultValue=""
            className={SELECT_CLASS}
          >
            <option value="" disabled />
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="incidentKind">{labels.kind}</Label>
          <select id="incidentKind" name="kind" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled />
            {labels.kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="incidentDescription">{labels.description}</Label>
        <textarea
          id="incidentDescription"
          name="description"
          rows={2}
          maxLength={INCIDENT_DESCRIPTION_MAX_LENGTH}
          aria-describedby="incidentHelp"
          className="w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p id="incidentHelp" className="text-xs text-muted-foreground">
          {labels.descriptionHelp}
        </p>
      </div>
      <ErrorLine state={state} errors={labels.errors} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

export function ResolveIncidentForm({
  incidentId,
  labels,
}: {
  incidentId: string;
  labels: LogLabels & { resolution: string };
}) {
  const [state, action, pending] = useActionState(resolveIncidentAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="incidentId" value={incidentId} />
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor={`res-${incidentId}`} className="text-xs">
          {labels.resolution}
        </Label>
        <Input
          id={`res-${incidentId}`}
          name="resolution"
          maxLength={INCIDENT_DESCRIPTION_MAX_LENGTH}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <div className="w-full">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}
