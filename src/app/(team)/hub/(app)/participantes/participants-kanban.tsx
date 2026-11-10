"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Kanban, type KanbanColumnDef } from "@/components/team/kanban";
import { ELIGIBILITY_TONES } from "@/components/team/participant-status-badge";
import { REASON_NOTE_MAX_LENGTH, requiresReason } from "@/domain/eligibility-reason";
import {
  ELIGIBILITY_STATUSES,
  canTransitionEligibility,
  type EligibilityStatus,
} from "@/domain/participant-state";
import { moveParticipantEligibility } from "./actions";
import {
  ParticipantCard,
  ParticipantCardPreview,
  type ParticipantCardOptions,
} from "./participant-card";
import type { ReasonOption } from "./participant-forms";
import type { ParticipantListRow } from "@/services/participant-ops";

interface ReasonLabels {
  reason: string;
  reasonRequiredHint: string;
  reasonNote: string;
  reasonNoteHelp: string;
  reasonNoneConfigured: string;
  confirm: string;
  cancel: string;
}

/**
 * Kanban view of the participants list, one column per `EligibilityStatus`.
 * A card can be dropped on any column but PENDING: eligibility can't return to
 * "not yet looked at" (domain/participant-state.ts).
 *
 * INELIGIBLE and REVIEW_REQUIRED need a reason (D-030), so dropping there asks
 * for it first, and the card stays where it was until it is given (D-141).
 */
export function ParticipantsKanban({
  rows,
  readOnly,
  reasons,
  statusLabels,
  errorLabels,
  reasonLabels,
  card,
  armGlow,
}: {
  rows: ParticipantListRow[];
  readOnly: boolean;
  reasons: ReasonOption[];
  statusLabels: Record<EligibilityStatus, string>;
  errorLabels: Record<string, string>;
  reasonLabels: ReasonLabels;
  card: ParticipantCardOptions;
  /** By arm id, and only for a viewer who may see the arm. */
  armGlow: Record<string, string>;
}) {
  const [asking, setAsking] = useState<{
    code: string;
    status: EligibilityStatus;
    answer: (confirmed: boolean) => void;
  } | null>(null);
  const reasonForMove = useRef<{ reasonId: string; reasonNote: string | null } | null>(null);

  const columns: KanbanColumnDef[] = ELIGIBILITY_STATUSES.map((s) => ({
    id: s,
    label: statusLabels[s],
    tone: ELIGIBILITY_TONES[s],
  }));

  function answer(confirmed: boolean) {
    asking?.answer(confirmed);
    setAsking(null);
  }

  const applicable = asking ? reasons.filter((r) => r.appliesTo.includes(asking.status)) : [];

  return (
    <>
      <Kanban
        id="participants-kanban"
        columns={columns}
        items={rows}
        getId={(row) => row.id}
        getColumnId={(row) => row.eligibilityStatus}
        // Each column lightly washed in its status colour (2026-11-09).
        tintColumns
        readOnly={readOnly}
        isValidTarget={(row, toColumnId) =>
          canTransitionEligibility(row.eligibilityStatus, toColumnId as EligibilityStatus)
        }
        confirmMove={(row, toColumnId) => {
          reasonForMove.current = null;
          const status = toColumnId as EligibilityStatus;
          if (!requiresReason(status)) return Promise.resolve(true);
          return new Promise((resolve) => setAsking({ code: row.code, status, answer: resolve }));
        }}
        onMove={async (id, toColumnId) => {
          const result = await moveParticipantEligibility(id, toColumnId, reasonForMove.current);
          return result.ok
            ? { ok: true }
            : { ok: false, error: (result.error && errorLabels[result.error]) || errorLabels.failed };
        }}
        moveErrorFallback={errorLabels.failed}
        renderCard={(row) => <ParticipantCard row={row} options={card} />}
        getGlowColor={(row) => (row.armId ? (armGlow[row.armId] ?? null) : null)}
        renderDragPreview={(row) => (
          <ParticipantCardPreview row={row} includeContact={card.includeContact} />
        )}
      />

      <Dialog open={asking !== null} onOpenChange={(open) => !open && answer(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {asking ? (
                <>
                  <span data-numeric>{asking.code}</span> → {statusLabels[asking.status]}
                </>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              reasonForMove.current = {
                reasonId: String(data.get("reasonId")),
                reasonNote: String(data.get("reasonNote") ?? "") || null,
              };
              answer(true);
            }}
          >
            {applicable.length > 0 ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="move-reason">
                    {reasonLabels.reason}
                    <span aria-hidden> *</span>
                  </Label>
                  <select
                    id="move-reason"
                    name="reasonId"
                    required
                    defaultValue=""
                    aria-describedby="move-reason-hint"
                    className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="" disabled />
                    {applicable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p id="move-reason-hint" className="text-xs text-muted-foreground">
                    {reasonLabels.reasonRequiredHint}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="move-note">{reasonLabels.reasonNote}</Label>
                  <Input
                    id="move-note"
                    name="reasonNote"
                    maxLength={REASON_NOTE_MAX_LENGTH}
                    aria-describedby="move-note-help"
                  />
                  <p id="move-note-help" className="text-xs text-muted-foreground">
                    {reasonLabels.reasonNoteHelp}
                  </p>
                </div>
              </>
            ) : (
              <p role="alert" className="text-sm text-destructive">
                {reasonLabels.reasonNoneConfigured}
              </p>
            )}
            <DialogFooter>
              <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => answer(false)}>
                {reasonLabels.cancel}
              </Button>
              {applicable.length > 0 ? (
                <Button type="submit" size="sm" className="rounded-lg">
                  {reasonLabels.confirm}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
