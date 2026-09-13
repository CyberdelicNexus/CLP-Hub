"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TASK_DETAIL_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from "@/domain/automation";
import { assignTaskAction, closeTaskAction, createTaskAction, type TaskState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: TaskState = { error: null };

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export interface TaskLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: TaskState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

export function CreateTaskForm({
  labels,
  priorities,
  staff,
  participants,
  cohorts,
}: {
  labels: TaskLabels & {
    title: string;
    detail: string;
    detailHelp: string;
    priority: string;
    dueAt: string;
    assignedTo: string;
    unassigned: string;
    subject: string;
    none: string;
  };
  priorities: { value: string; label: string }[];
  staff: { value: string; label: string }[];
  participants: { value: string; label: string }[];
  cohorts: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createTaskAction, initial);

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="taskTitle">{labels.title}</Label>
        <Input id="taskTitle" name="titleEs" required maxLength={TASK_TITLE_MAX_LENGTH} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="taskDetail">{labels.detail}</Label>
        <textarea
          id="taskDetail"
          name="detail"
          rows={3}
          maxLength={TASK_DETAIL_MAX_LENGTH}
          className={TEXTAREA_CLASS}
        />
        {/*
          Said next to the box rather than in a policy page. The boundary this
          warns about is the one people cross by accident, at the moment they are
          typing (docs/research-data-boundaries.md).
        */}
        <p className="text-xs text-muted-foreground">{labels.detailHelp}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="taskPriority">{labels.priority}</Label>
        <select id="taskPriority" name="priority" defaultValue="NORMAL" className={SELECT_CLASS}>
          {priorities.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="taskDue">{labels.dueAt}</Label>
        <Input id="taskDue" name="dueAt" type="date" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="taskAssignee">{labels.assignedTo}</Label>
        <select id="taskAssignee" name="assignedTo" defaultValue="" className={SELECT_CLASS}>
          <option value="">{labels.unassigned}</option>
          {staff.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="taskSubject">{labels.subject}</Label>
        {/*
          One subject or none. A task about a participant and a cohort at once is
          really two tasks, and the list would show it under whichever it felt
          like.
        */}
        <select id="taskSubject" name="participantId" defaultValue="" className={SELECT_CLASS}>
          <option value="">{labels.none}</option>
          {participants.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="taskCohort">{labels.subject}</Label>
        <select id="taskCohort" name="cohortId" defaultValue="" className={SELECT_CLASS}>
          <option value="">{labels.none}</option>
          {cohorts.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
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

/** Close a task, or cancel it. Both are a person's statement about the work. */
export function CloseTaskForm({
  taskId,
  status,
  labels,
}: {
  taskId: string;
  status: "DONE" | "CANCELLED";
  labels: TaskLabels;
}) {
  const [state, action, pending] = useActionState(closeTaskAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value={status} />
      <Button
        type="submit"
        size="sm"
        variant={status === "DONE" ? "default" : "ghost"}
        className="rounded-lg"
        disabled={pending}
      >
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

/** Hand a task to somebody, or take the name off it. */
export function AssignTaskForm({
  taskId,
  current,
  staff,
  labels,
}: {
  taskId: string;
  current: string | null;
  staff: { value: string; label: string }[];
  labels: TaskLabels & { unassigned: string };
}) {
  const [state, action, pending] = useActionState(assignTaskAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="assignedTo"
        defaultValue={current ?? ""}
        className={`${SELECT_CLASS} w-auto min-w-40`}
        aria-label={labels.submit}
      >
        <option value="">{labels.unassigned}</option>
        {staff.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
