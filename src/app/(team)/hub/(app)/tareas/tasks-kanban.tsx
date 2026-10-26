"use client";

import { Kanban, type KanbanColumnDef } from "@/components/team/kanban";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import type { TaskPriority, TaskStatus } from "@/domain/automation";
import { moveTaskStatus } from "./actions";
import type { TaskRow } from "@/services/automation";

const COLUMN_TONE: Record<TaskStatus, StatusTone> = {
  OPEN: "info",
  DONE: "success",
  CANCELLED: "neutral",
};

/**
 * Kanban view of the tasks list, one column per `TaskStatus`. `closeTask`
 * only moves OPEN to DONE or CANCELLED (both terminal), so those are the only
 * valid drags — DONE and CANCELLED are display-only columns, same as the list
 * view offers no close/reopen control for them either.
 *
 * PARTICIPANT CODES ONLY, same rule as the list view (see page.tsx's doc
 * comment): a task card never names anyone.
 */
export function TasksKanban({
  rows,
  readOnly,
  statusLabels,
  priorityLabels,
  errorLabels,
  unassignedLabel,
}: {
  rows: TaskRow[];
  readOnly: boolean;
  statusLabels: Record<TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  errorLabels: Record<string, string>;
  unassignedLabel: string;
}) {
  const columns: KanbanColumnDef[] = (["OPEN", "DONE", "CANCELLED"] as const).map((s) => ({
    id: s,
    label: statusLabels[s],
    tone: COLUMN_TONE[s],
  }));

  return (
    <Kanban
      id="tasks-kanban"
      columns={columns}
      items={rows}
      getId={(row) => row.id}
      getColumnId={(row) => row.status}
      readOnly={readOnly}
      isValidTarget={(row, toColumnId) => row.status === "OPEN" && toColumnId !== "OPEN"}
      onMove={async (id, toColumnId) => {
        const result = await moveTaskStatus(id, toColumnId);
        return result.ok
          ? { ok: true }
          : { ok: false, error: (result.error && errorLabels[result.error]) || errorLabels.failed };
      }}
      moveErrorFallback={errorLabels.failed}
      renderCard={(row) => (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{row.titleEs}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={row.priority === "HIGH" ? "warning" : row.priority === "LOW" ? "neutral" : "info"}>
              {priorityLabels[row.priority]}
            </StatusBadge>
            {row.participantCode ? (
              <span data-numeric className="text-[0.7rem] text-muted-foreground">
                {row.participantCode}
              </span>
            ) : null}
            {row.cohortCode ? (
              <span data-numeric className="text-[0.7rem] text-muted-foreground">
                {row.cohortCode}
              </span>
            ) : null}
          </div>
          <p className="text-[0.7rem] text-muted-foreground">{row.assignedToName ?? unassignedLabel}</p>
        </div>
      )}
    />
  );
}
