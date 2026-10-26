"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SESSION_LOCATION_MAX_LENGTH } from "@/domain/session";
import {
  recordAttendanceAction,
  refreshRegisterAction,
  scheduleSessionAction,
  setSessionStatusAction,
  type SessionState,
} from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: SessionState = { error: null };

export interface Labels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function ErrorLine({ state, errors }: { state: SessionState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/**
 * Schedule an instance of ONE specific session template for ONE specific
 * cohort — both fixed by the caller (the cohort workspace, which already
 * knows which cohort and which S0–S6 row this is), not re-picked here. The
 * name and modality already exist on the template (2026-09-18 request: "get
 * rid of the name/modality fields, we already know that"), so they travel as
 * hidden inputs rather than editable ones — `scheduleSessionAction` still
 * requires both, this only stops asking the user to retype what the template
 * already says.
 */
export function ScheduleSessionForm({
  cohort,
  template,
  labels,
}: {
  cohort: { id: string; label: string };
  template: { id: string; name: string; modality: string };
  labels: Labels & {
    when: string;
    duration: string;
    location: string;
  };
}) {
  const [state, action, pending] = useActionState(scheduleSessionAction, initial);

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="cohortId" value={cohort.id} />
      <input type="hidden" name="templateId" value={template.id} />
      <input type="hidden" name="name" value={template.name} />
      <input type="hidden" name="modality" value={template.modality} />

      <div className="space-y-1.5">
        <Label htmlFor={`when-${template.id}`}>{labels.when}</Label>
        <Input id={`when-${template.id}`} name="scheduledStart" type="datetime-local" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`duration-${template.id}`}>{labels.duration}</Label>
        <Input id={`duration-${template.id}`} name="durationMinutes" type="number" min={1} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`location-${template.id}`}>{labels.location}</Label>
        <Input id={`location-${template.id}`} name="location" maxLength={SESSION_LOCATION_MAX_LENGTH} />
      </div>

      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

export function SessionStatusForm({
  sessionId,
  options,
  labels,
}: {
  sessionId: string;
  options: { value: string; label: string }[];
  labels: Labels & { terminal: string };
}) {
  const [state, action, pending] = useActionState(setSessionStatusAction, initial);
  if (options.length === 0) return <p className="text-sm text-muted-foreground">{labels.terminal}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sessionId" value={sessionId} />
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

export function RefreshRegisterForm({
  sessionId,
  labels,
}: {
  sessionId: string;
  labels: Labels & { help: string };
}) {
  const [state, action, pending] = useActionState(refreshRegisterAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="outline" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <p className="text-xs text-muted-foreground">{labels.help}</p>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/**
 * One row of the register. Every status in the vocabulary is offered directly,
 * including TECHNICAL_FAILURE — recording it must be as easy as recording
 * ABSENT, or staff will reach for the wrong one when a headset fails.
 */
export function AttendanceRow({
  sessionId,
  participantId,
  current,
  options,
  labels,
}: {
  sessionId: string;
  participantId: string;
  current: string;
  options: { value: string; label: string }[];
  labels: Labels;
}) {
  const [state, action, pending] = useActionState(recordAttendanceAction, initial);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="participantId" value={participantId} />
      <select
        name="status"
        defaultValue={current}
        disabled={pending}
        aria-label={labels.submit}
        className={SELECT_CLASS}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Submit button kept for keyboard and no-JS use; change auto-submits. */}
      <noscript>
        <Button type="submit" size="xs" className="rounded-md">
          {labels.submit}
        </Button>
      </noscript>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
