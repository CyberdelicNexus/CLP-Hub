"use client";

import Link from "next/link";
import { Kanban, type KanbanColumnDef } from "@/components/team/kanban";
import { ELIGIBILITY_TONES } from "@/components/team/participant-status-badge";
import {
  ELIGIBILITY_STATUSES,
  canTransitionEligibility,
  type EligibilityStatus,
} from "@/domain/participant-state";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { moveParticipantEligibility } from "./actions";
import type { ParticipantListRow } from "@/services/participant-ops";

/**
 * Kanban view of the participants list, one column per `EligibilityStatus`.
 *
 * Only ELIGIBLE and WAITLIST are draggable targets, and only for a participant
 * with an open screening (`openScreeningByParticipant`): INELIGIBLE and
 * REVIEW_REQUIRED require a reason (`completeScreening`'s `reasonId`, D-030),
 * which a drag gesture has nowhere to collect. Moving to those two — and every
 * move for a participant with no open screening — stays on the detail page,
 * where the reason picker lives. PENDING is never a target: eligibility can't
 * return to "not yet looked at" (domain/participant-state.ts).
 */
export function ParticipantsKanban({
  rows,
  includeContact,
  readOnly,
  openScreeningByParticipant,
  statusLabels,
  errorLabels,
}: {
  rows: ParticipantListRow[];
  includeContact: boolean;
  readOnly: boolean;
  openScreeningByParticipant: Record<string, string>;
  statusLabels: Record<EligibilityStatus, string>;
  errorLabels: Record<string, string>;
}) {
  const columns: KanbanColumnDef[] = ELIGIBILITY_STATUSES.map((s) => ({
    id: s,
    label: statusLabels[s],
    tone: ELIGIBILITY_TONES[s],
  }));

  const draggableResult = (target: string): target is Extract<EligibilityStatus, "ELIGIBLE" | "WAITLIST"> =>
    target === "ELIGIBLE" || target === "WAITLIST";

  return (
    <Kanban
      id="participants-kanban"
      columns={columns}
      items={rows}
      getId={(row) => row.id}
      getColumnId={(row) => row.eligibilityStatus}
      readOnly={readOnly}
      isValidTarget={(row, toColumnId) =>
        Boolean(openScreeningByParticipant[row.id]) &&
        draggableResult(toColumnId) &&
        canTransitionEligibility(row.eligibilityStatus, toColumnId as EligibilityStatus)
      }
      onMove={async (id, toColumnId) => {
        const screeningId = openScreeningByParticipant[id];
        if (!screeningId || !draggableResult(toColumnId)) {
          return { ok: false, error: errorLabels.invalid };
        }
        const result = await moveParticipantEligibility(id, screeningId, toColumnId);
        return result.ok
          ? { ok: true }
          : { ok: false, error: (result.error && errorLabels[result.error]) || errorLabels.failed };
      }}
      moveErrorFallback={errorLabels.failed}
      renderCard={(row) => (
        <Link
          href={`${TEAM_BASE_PATH}/participantes/${row.id}`}
          className="block space-y-1 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <p data-numeric className="text-sm font-medium">
            {row.code}
          </p>
          {includeContact ? (
            <p className="truncate text-xs text-muted-foreground">{row.fullName ?? "—"}</p>
          ) : null}
          {row.cohortCode ? (
            <p data-numeric className="text-[0.7rem] text-muted-foreground">
              {row.cohortCode}
            </p>
          ) : null}
        </Link>
      )}
    />
  );
}
