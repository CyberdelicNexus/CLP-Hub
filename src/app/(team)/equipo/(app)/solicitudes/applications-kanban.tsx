"use client";

import Link from "next/link";
import { Kanban, type KanbanColumnDef } from "@/components/team/kanban";
import { APPLICATION_TONES } from "@/components/team/application-status-badge";
import {
  APPLICATION_STATUSES,
  canTransitionApplication,
  type ApplicationStatus,
} from "@/domain/recruitment";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { moveApplicationStatus } from "./actions";
import type { ApplicationListRow } from "@/services/recruitment";

/**
 * Kanban view of the applications list — the same rows the table shows, one
 * column per `ApplicationStatus`, dragged between them via `moveApplicationStatus`
 * (the same service call and audit row the detail page's triage buttons use).
 */
export function ApplicationsKanban({
  rows,
  includeContact,
  readOnly,
  statusLabels,
  errorLabels,
  timeZone,
}: {
  rows: ApplicationListRow[];
  includeContact: boolean;
  readOnly: boolean;
  statusLabels: Record<ApplicationStatus, string>;
  errorLabels: Record<string, string>;
  timeZone: string;
}) {
  const columns: KanbanColumnDef[] = APPLICATION_STATUSES.map((s) => ({
    id: s,
    label: statusLabels[s],
    tone: APPLICATION_TONES[s],
  }));

  return (
    <Kanban
      id="applications-kanban"
      columns={columns}
      items={rows}
      getId={(row) => row.id}
      getColumnId={(row) => row.status}
      isValidTarget={(row, toColumnId) =>
        canTransitionApplication(row.status, toColumnId as ApplicationStatus)
      }
      onMove={async (id, toColumnId) => {
        const result = await moveApplicationStatus(id, toColumnId);
        return result.ok
          ? { ok: true }
          : { ok: false, error: (result.error && errorLabels[result.error]) || errorLabels.failed };
      }}
      moveErrorFallback={errorLabels.failed}
      readOnly={readOnly}
      renderCard={(row) => (
        <Link
          href={`${TEAM_BASE_PATH}/solicitudes/${row.id}`}
          className="block space-y-1 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <p data-numeric className="text-sm font-medium">
            {row.participantCode}
          </p>
          {includeContact ? (
            <p className="truncate text-xs text-muted-foreground">{row.fullName ?? "—"}</p>
          ) : null}
          <p data-numeric className="text-[0.7rem] text-muted-foreground">
            {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone }).format(row.submittedAt)}
          </p>
        </Link>
      )}
    />
  );
}
