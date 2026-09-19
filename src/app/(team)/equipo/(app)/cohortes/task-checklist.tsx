"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { closeTaskAction, type TaskState } from "../tareas/actions";

const initial: TaskState = { error: null };

/**
 * One reminder in a cohort's checklist — a task rendered as a checkbox
 * instead of the tareas board's buttons (2026-09-18 request: tasks should
 * read as reminders inside the process they belong to, not a separate
 * to-do app). Checking it calls the exact same `closeTaskAction` the Tareas
 * page's "Marcar hecha" button does — same permission, same audit row.
 */
export function TaskChecklistItem({
  taskId,
  title,
  detail,
  errorLabels,
}: {
  taskId: string;
  title: string;
  detail: string | null;
  errorLabels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(closeTaskAction, initial);

  useEffect(() => {
    if (state.error) toast.error(errorLabels[state.error] ?? errorLabels.failed);
  }, [state.error, errorLabels]);

  return (
    <form action={action} className="flex items-start gap-2.5 py-1.5">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value="DONE" />
      <button
        type="submit"
        disabled={pending}
        aria-label={title}
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input bg-card transition-colors hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{title}</span>
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </form>
  );
}
