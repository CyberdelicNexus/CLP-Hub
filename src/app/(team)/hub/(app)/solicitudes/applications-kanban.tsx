"use client";

import { Kanban, type KanbanColumnDef } from "@/components/team/kanban";
import { APPLICATION_TONES } from "@/components/team/application-status-badge";
import {
  APPLICATION_STATUSES,
  canTransitionApplication,
  type ApplicationStatus,
} from "@/domain/recruitment";
import { moveApplicationStatus } from "./actions";
import type { ApplicationCardRow } from "@/services/recruitment";
import type { ReasonOption } from "../participantes/participant-forms";
import { ApplicationCard, applicationGlowColor, type ApplicationCardLabels } from "./application-card";

/**
 * Kanban view of the applications list — the same rows the table shows, one
 * column per `ApplicationStatus`, dragged between them via `moveApplicationStatus`
 * (the same service call and audit row the detail page's triage buttons use).
 * Each card is the gallery's card in compact form (2026-10-28): no status
 * dropdown, since dragging does that here, but the screening date and result
 * are still handled on it.
 */
export function ApplicationsKanban({
  rows,
  includeContact,
  readOnly,
  statusLabels,
  errorLabels,
  timeZone,
  canManageScreening,
  reasons,
  cardLabels,
}: {
  rows: ApplicationCardRow[];
  includeContact: boolean;
  readOnly: boolean;
  statusLabels: Record<ApplicationStatus, string>;
  errorLabels: Record<string, string>;
  timeZone: string;
  canManageScreening: boolean;
  reasons: ReasonOption[];
  cardLabels: ApplicationCardLabels;
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
      // Edge glow in the card's status colour (2026-11-09).
      getGlowColor={(row) => applicationGlowColor(row.status)}
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
        <ApplicationCard
          row={row}
          includeContact={includeContact}
          canManageApplication={!readOnly}
          canManageScreening={canManageScreening}
          reasons={reasons}
          labels={cardLabels}
          timeZone={timeZone}
          compact
        />
      )}
    />
  );
}
