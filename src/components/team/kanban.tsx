"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface KanbanColumnDef {
  id: string;
  label: string;
  tone?: "neutral" | "success" | "warning" | "critical" | "info";
}

/**
 * Generic drag-and-drop board: any list of items grouped into columns by a
 * status field, moved by dragging. Not tied to solicitudes, participantes or
 * tareas — those pages supply `columns`/`getColumnId`/`onMove`, this only
 * knows about dragging and optimistic UI.
 *
 * Two things this deliberately does NOT replace:
 * - The ordinary per-record status form remains the primary, fully keyboard-
 *   and screen-reader-accessible path. This is an additional view, not a
 *   substitute — dnd-kit's keyboard sensor gives basic reachability, but nothing
 *   here should be the only way to change a status.
 * - Validation. `onMove` is the same server action a form would call
 *   (assertPermission + the domain transition check + recordAuditEvent, all
 *   inside one transaction); a drop that the domain forbids is rejected there,
 *   the optimistic move rolls back, and a toast explains why. `isValidTarget`
 *   is purely a drag-time hint (dims columns that would be rejected) so a
 *   forbidden drop is rare, not a second source of truth for what's allowed.
 */
export function Kanban<T>({
  id,
  columns,
  items,
  getId,
  getColumnId,
  renderCard,
  isValidTarget,
  onMove,
  moveErrorFallback,
  readOnly = false,
}: {
  /**
   * A stable id for dnd-kit's internal accessibility announcer, so its
   * auto-generated element id is the same on the server and the client.
   * Without one, dnd-kit falls back to a module-level counter that a second
   * board on the same page (or React 19's dev double-render) can advance
   * differently between the SSR pass and hydration, producing a benign but
   * noisy `aria-describedby` hydration-mismatch warning.
   */
  id: string;
  columns: KanbanColumnDef[];
  items: T[];
  getId: (item: T) => string;
  getColumnId: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  /** Drag-time hint only — see the component doc comment. Omit to allow any column. */
  isValidTarget?: (item: T, toColumnId: string) => boolean;
  onMove: (itemId: string, toColumnId: string) => Promise<{ ok: boolean; error?: string }>;
  moveErrorFallback: string;
  /** Viewer lacks the manage permission: render the board without drag handles. */
  readOnly?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticColumns, moveOptimistic] = useOptimistic(
    new Map(items.map((item) => [getId(item), getColumnId(item)])),
    (state, move: { id: string; columnId: string }) => {
      const next = new Map(state);
      next.set(move.id, move.columnId);
      return next;
    },
  );

  const byColumn = useMemo(() => {
    const grouped = new Map<string, T[]>(columns.map((c) => [c.id, []]));
    for (const item of items) {
      const columnId = optimisticColumns.get(getId(item)) ?? getColumnId(item);
      grouped.get(columnId)?.push(item);
    }
    return grouped;
  }, [items, columns, optimisticColumns, getId, getColumnId]);

  const activeItem = activeId ? items.find((i) => getId(i) === activeId) : null;

  if (readOnly) {
    return (
      <div className="grid auto-cols-[18rem] grid-flow-col gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <StaticColumn key={column.id} column={column}>
            {(byColumn.get(column.id) ?? []).map((item) => (
              <div key={getId(item)} className="rounded-xl bg-card p-3 shadow-soft">
                {renderCard(item)}
              </div>
            ))}
          </StaticColumn>
        ))}
      </div>
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const itemId = String(event.active.id);
    const toColumnId = event.over?.id ? String(event.over.id) : null;
    const item = items.find((i) => getId(i) === itemId);
    if (!item || !toColumnId) return;
    if (getColumnId(item) === toColumnId) return;
    if (isValidTarget && !isValidTarget(item, toColumnId)) return;

    startTransition(async () => {
      moveOptimistic({ id: itemId, columnId: toColumnId });
      const result = await onMove(itemId, toColumnId);
      if (!result.ok) {
        toast.error(result.error ?? moveErrorFallback);
      }
    });
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid auto-cols-[18rem] grid-flow-col gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <KanbanColumnBody
            key={column.id}
            column={column}
            disabled={Boolean(activeItem && isValidTarget && !isValidTarget(activeItem, column.id))}
            isDragging={activeId !== null}
          >
            {(byColumn.get(column.id) ?? []).map((item) => (
              <KanbanCard key={getId(item)} id={getId(item)}>
                {renderCard(item)}
              </KanbanCard>
            ))}
          </KanbanColumnBody>
        ))}
      </div>
      <DragOverlay>{activeItem ? <div className="rotate-1 opacity-90">{renderCard(activeItem)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

const TONE_DOT: Record<NonNullable<KanbanColumnDef["tone"]>, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-[var(--status-success-fg)]",
  warning: "bg-[var(--status-warning-fg)]",
  critical: "bg-[var(--status-critical-fg)]",
  info: "bg-[var(--status-info-fg)]",
};

/** Non-interactive column shell for `readOnly`, with no `useDroppable` — it
 * never renders without a surrounding `DndContext`, which the read-only path
 * skips entirely rather than mounting an inert one. */
function StaticColumn({ column, children }: { column: KanbanColumnDef; children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 flex-col gap-2 rounded-2xl bg-muted/40 p-3">
      <h3 className="flex items-center gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {column.tone ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[column.tone])} aria-hidden />
        ) : null}
        <span className="truncate">{column.label}</span>
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function KanbanColumnBody({
  column,
  disabled,
  isDragging,
  children,
}: {
  column: KanbanColumnDef;
  disabled: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled });
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col gap-2 rounded-2xl bg-muted/40 p-3 transition-colors duration-150",
        isOver && !disabled && "bg-muted/70 ring-2 ring-ring/50",
        isDragging && disabled && "opacity-40",
      )}
    >
      <h3 className="flex items-center gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {column.tone ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[column.tone])} aria-hidden />
        ) : null}
        <span className="truncate">{column.label}</span>
        <span className="ml-auto shrink-0 tabular-nums">{count}</span>
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function KanbanCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab touch-none rounded-xl bg-card p-3 shadow-soft transition-shadow duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      {children}
    </div>
  );
}
