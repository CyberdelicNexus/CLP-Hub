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
  renderDragPreview,
  getGlowColor,
  tintColumns = false,
  isValidTarget,
  confirmMove,
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
  /** The card under the pointer, for a card whose controls can't exist twice. */
  renderDragPreview?: (item: T) => React.ReactNode;
  /**
   * Passing this gives the cards the cohort cards' edge glow (`.edge-glow`).
   * Returns the card's colour, or null for the default one.
   */
  getGlowColor?: (item: T) => string | null;
  /** Wash each column's background lightly in its `tone` colour. */
  tintColumns?: boolean;
  /** Drag-time hint only — see the component doc comment. Omit to allow any column. */
  isValidTarget?: (item: T, toColumnId: string) => boolean;
  /**
   * Runs on a drop, before the card moves, for a board that has to ask something
   * first. Resolving false cancels the drop. It sits outside the transition
   * because a dialog opened inside one would not render until the transition
   * ended, which is waiting for that dialog.
   */
  confirmMove?: (item: T, toColumnId: string) => Promise<boolean>;
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
  const glowFor = (item: T) => (getGlowColor ? edgeGlow(getGlowColor(item)) : undefined);

  if (readOnly) {
    return (
      <div className="grid auto-cols-[18rem] grid-flow-col gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <StaticColumn key={column.id} column={column} tint={tintColumns}>
            {(byColumn.get(column.id) ?? []).map((item) => {
              const glow = glowFor(item);
              return (
                <div
                  key={getId(item)}
                  style={glow?.style}
                  onPointerMove={glow?.onPointerMove}
                  className={cn("rounded-xl bg-card p-3 shadow-soft", glow?.className)}
                >
                  {renderCard(item)}
                </div>
              );
            })}
          </StaticColumn>
        ))}
      </div>
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const itemId = String(event.active.id);
    const toColumnId = event.over?.id ? String(event.over.id) : null;
    const item = items.find((i) => getId(i) === itemId);
    if (!item || !toColumnId) return;
    if (getColumnId(item) === toColumnId) return;
    if (isValidTarget && !isValidTarget(item, toColumnId)) return;
    if (confirmMove && !(await confirmMove(item, toColumnId))) return;

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
            tint={tintColumns}
          >
            {(byColumn.get(column.id) ?? []).map((item) => (
              <KanbanCard key={getId(item)} id={getId(item)} glow={glowFor(item)}>
                {renderCard(item)}
              </KanbanCard>
            ))}
          </KanbanColumnBody>
        ))}
      </div>
      <DragOverlay>
        {activeItem ? (
          <div className="rotate-1 rounded-xl bg-card p-3 opacity-90 shadow-soft">
            {(renderDragPreview ?? renderCard)(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** The props that turn a card into a `.edge-glow` one, whose light follows the pointer. */
function edgeGlow(color: string | null) {
  return {
    className: "edge-glow",
    style: color ? ({ "--glow-color": color } as React.CSSProperties) : undefined,
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
    },
  };
}

/** A column's status colour as a CSS colour, for `tintColumns`. Neutral has
 * no status token of its own, so it borrows the muted ink. */
const TONE_INK: Record<NonNullable<KanbanColumnDef["tone"]>, string> = {
  neutral: "var(--muted-foreground)",
  success: "var(--status-success-fg)",
  warning: "var(--status-warning-fg)",
  critical: "var(--status-critical-fg)",
  info: "var(--status-info-fg)",
};

/**
 * The column's background lightly washed in its status colour (2026-11-09,
 * participants board), mixed against --card so it holds in both themes; a
 * little stronger while a card is dragged over it. Undefined keeps the plain
 * muted column.
 */
function columnTint(column: KanbanColumnDef, tint: boolean, over = false): React.CSSProperties | undefined {
  if (!tint || !column.tone) return undefined;
  const pct = column.tone === "neutral" ? (over ? 12 : 6) : over ? 20 : 10;
  return { backgroundColor: `color-mix(in oklch, ${TONE_INK[column.tone]} ${pct}%, var(--card))` };
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
function StaticColumn({
  column,
  tint,
  children,
}: {
  column: KanbanColumnDef;
  tint: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-24 flex-col gap-2 rounded-2xl bg-muted/40 p-3" style={columnTint(column, tint)}>
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
  tint,
  children,
}: {
  column: KanbanColumnDef;
  disabled: boolean;
  isDragging: boolean;
  tint: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled });
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;

  return (
    <div
      ref={setNodeRef}
      style={columnTint(column, tint, isOver && !disabled)}
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

function KanbanCard({
  id,
  glow,
  children,
}: {
  id: string;
  glow?: ReturnType<typeof edgeGlow>;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...glow?.style }}
      {...listeners}
      {...attributes}
      onPointerMove={glow?.onPointerMove}
      className={cn(
        "cursor-grab touch-none rounded-xl bg-card p-3 shadow-soft transition-shadow duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
        isDragging && "opacity-30",
        glow?.className,
      )}
    >
      {children}
    </div>
  );
}
