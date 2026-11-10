"use client";

import Link from "next/link";
import { Kanban, type KanbanColumnDef } from "@/components/team/kanban";
import {
  HEADSET_BOARD_STATUSES,
  canTransitionDevice,
  type DeviceStatus,
} from "@/domain/logistics";
import { moveDeviceStatus } from "./actions";

/** The column of someone with no headset. A card there has nothing to move. */
const NO_HEADSET = "NO_HEADSET";

export interface HeadsetBoardRow {
  participantId: string;
  participantCode: string;
  /** Null when the viewer may not see names. */
  participantName: string | null;
  cohortCode: string;
  deviceId: string | null;
  deviceCode: string | null;
  deviceStatus: DeviceStatus | null;
  href: string;
}

/**
 * The headset each person has, one column per device status. Dropping a card
 * sets the device's status, the same write as the inventory's form. It records
 * no hand-over or return: those are dated milestones a person confirms in the
 * participant's panel, because a status can be planned and a milestone cannot.
 */
export function HeadsetBoard({
  rows,
  readOnly,
  statusLabels,
  noHeadset,
  errorLabels,
}: {
  rows: HeadsetBoardRow[];
  readOnly: boolean;
  statusLabels: Record<DeviceStatus, string>;
  noHeadset: string;
  errorLabels: Record<string, string>;
}) {
  const statuses: DeviceStatus[] = [...HEADSET_BOARD_STATUSES];
  for (const row of rows) {
    if (row.deviceStatus && !statuses.includes(row.deviceStatus)) statuses.push(row.deviceStatus);
  }
  const columns: KanbanColumnDef[] = [
    { id: NO_HEADSET, label: noHeadset, tone: "neutral" },
    ...statuses.map((s) => ({ id: s, label: statusLabels[s] })),
  ];

  return (
    <Kanban
      id="headset-board"
      columns={columns}
      items={rows}
      getId={(row) => row.participantId}
      getColumnId={(row) => row.deviceStatus ?? NO_HEADSET}
      getGlowColor={() => null}
      readOnly={readOnly}
      isValidTarget={(row, toColumnId) =>
        row.deviceStatus !== null &&
        toColumnId !== NO_HEADSET &&
        canTransitionDevice(row.deviceStatus, toColumnId as DeviceStatus)
      }
      onMove={async (participantId, toColumnId) => {
        const row = rows.find((r) => r.participantId === participantId);
        if (!row?.deviceId) return { ok: false, error: errorLabels.invalid };
        const result = await moveDeviceStatus(row.deviceId, toColumnId);
        return result.ok
          ? { ok: true }
          : { ok: false, error: (result.error && errorLabels[result.error]) || errorLabels.failed };
      }}
      moveErrorFallback={errorLabels.failed}
      renderCard={(row) => (
        <Link
          href={row.href}
          className="block space-y-1 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <p className="flex items-baseline justify-between gap-2">
            <span data-numeric className="text-sm font-medium">
              {row.participantCode}
            </span>
            <span data-numeric className="text-[0.7rem] text-muted-foreground">
              {row.cohortCode}
            </span>
          </p>
          {row.participantName ? (
            <p className="truncate text-xs text-muted-foreground">{row.participantName}</p>
          ) : null}
          {row.deviceCode ? (
            <p data-numeric className="text-xs font-semibold">
              {row.deviceCode}
            </p>
          ) : null}
        </Link>
      )}
    />
  );
}
