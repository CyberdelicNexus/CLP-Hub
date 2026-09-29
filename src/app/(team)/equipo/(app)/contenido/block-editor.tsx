"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bookmark,
  CircleCheck,
  CircleHelp,
  Columns3,
  GripVertical,
  Image as ImageIcon,
  Info,
  LifeBuoy,
  ListChecks,
  ListOrdered,
  Megaphone,
  MousePointerClick,
  Plus,
  Quote,
  SeparatorHorizontal,
  Trash2,
  TriangleAlert,
  Type as TypeIcon,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentBlocks } from "@/components/content/blocks";
import { cn } from "@/lib/utils";
import {
  BLOCK_ALIGNMENTS,
  BLOCK_TYPES,
  CALLOUT_TONES,
  DIVIDER_STYLES,
  DIVIDER_THICKNESSES,
  TOKEN_COLORS,
  type BlockAlign,
  type BlockType,
  type CalloutTone,
  type ContentBlock,
  type LeafContentBlock,
  type TokenColor,
} from "@/domain/content";
import { emptyRichTextDoc, toRichTextDoc } from "@/domain/rich-text";
import { ImageUploadButton } from "./image-upload-button";
import { RichTextField, type RichTextFieldLabels } from "./rich-text-field";

const CALLOUT_STYLES: Record<CalloutTone, { surface: string; Icon: typeof Info }> = {
  INFO: { surface: "bg-surface-sky text-surface-sky-ink", Icon: Info },
  WARNING: { surface: "bg-surface-peach text-surface-peach-ink", Icon: TriangleAlert },
  SUPPORT: { surface: "bg-surface-mint text-surface-mint-ink", Icon: LifeBuoy },
};

/** The closed color palette (`domain/content.ts`'s `TOKEN_COLORS`) mapped to
 * the Tailwind classes each token actually paints — reused for every
 * swatch picker (DIVIDER, TECHNICAL_STEP's badge, BUTTON's background) and
 * for the corresponding render classes in `components/content/blocks.tsx`. */
const TOKEN_COLOR_BG: Record<TokenColor, string> = {
  default: "bg-muted-foreground/30",
  primary: "bg-primary",
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

const BLOCK_ICON: Record<BlockType, typeof TypeIcon> = {
  TEXT: TypeIcon,
  VIDEO: Video,
  IMAGE: ImageIcon,
  BOOKMARK: Bookmark,
  CHECKLIST: ListChecks,
  CALLOUT: Megaphone,
  CONTEMPLATION: Quote,
  BUTTON: MousePointerClick,
  TECHNICAL_STEP: ListOrdered,
  SUPPORT_BOX: LifeBuoy,
  DIVIDER: SeparatorHorizontal,
  COLUMNS: Columns3,
};

/** Seamless text input styling shared by every inline-editable field below —
 * no border, no background, so a block reads as part of the page and not as
 * a form until the reader's cursor is actually in it. */
const SEAMLESS = "w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/50";

function emptyBlock(type: BlockType, stepCount: number): ContentBlock {
  switch (type) {
    case "TEXT":
      return { type, content: emptyRichTextDoc(), align: "left" };
    case "VIDEO":
      return { type, url: "", align: "left" };
    case "IMAGE":
      return { type, url: "", alt: "", align: "left" };
    case "BOOKMARK":
      return { type, url: "", title: "", align: "left" };
    case "CHECKLIST":
      return { type, items: [""] };
    case "CALLOUT":
      return { type, tone: "INFO", content: emptyRichTextDoc() };
    case "CONTEMPLATION":
      return { type, content: emptyRichTextDoc() };
    case "BUTTON":
      return { type, label: "", url: "", color: "primary", align: "left" };
    case "TECHNICAL_STEP":
      return { type, step: stepCount + 1, title: "", content: emptyRichTextDoc(), color: "primary" };
    case "SUPPORT_BOX":
      return { type, content: emptyRichTextDoc() };
    case "DIVIDER":
      return { type, style: "solid", thickness: "thin", color: "default" };
    case "COLUMNS":
      return {
        type,
        columns: [
          { width: 50, blocks: [] },
          { width: 50, blocks: [] },
        ],
      };
  }
}

export interface Labels {
  empty: string;
  drag: string;
  insert: string;
  remove: string;
  done: string;
  addMedia: string;
  blockType: Record<BlockType, string>;
  calloutTone: Record<CalloutTone, string>;
  dividerStyle: Record<(typeof DIVIDER_STYLES)[number], string>;
  dividerThickness: Record<(typeof DIVIDER_THICKNESSES)[number], string>;
  richText: RichTextFieldLabels;
  field: {
    md: string;
    url: string;
    caption: string;
    alt: string;
    title: string;
    description: string;
    items: string;
    addItem: string;
    removeItem: string;
    step: string;
    label: string;
    contactLabel: string;
    contactUrl: string;
    width: string;
    addColumn: string;
    removeColumn: string;
    upload: string;
    uploadErrors: Record<string, string>;
  };
}

/**
 * A single-column, edit-in-place canvas — "just like Notion pages": you
 * type directly on what looks like the final page, not into a form next to
 * a separate preview (2026-09-19 follow-up; the original two-column
 * version, D-071, is what this replaces). Every block renders in (close to)
 * its real published shape:
 *   - Purely-text blocks (TEXT, CONTEMPLATION, CALLOUT, CHECKLIST,
 *     TECHNICAL_STEP, SUPPORT_BOX, BUTTON) are hand-styled to match
 *     `components/content/blocks.tsx`'s own classes, with plain `<input>`/
 *     `<textarea>` elements standing in for the static text.
 *   - IMAGE, VIDEO and BOOKMARK instead render through `ContentBlocks`
 *     itself (`body={[block]}`, the same component the public page uses)
 *     so what an author sees IS the real render — a real image, a real
 *     playing video — not a hand-approximated stand-in. A small pencil
 *     toggle opens the URL/alt/caption fields those three still need,
 *     since there is no seamless-text way to edit "which image".
 * Nothing about the data model changed to get here: this still serialises
 * to the exact same typed `ContentBlock[]` `blockSchema` already validates,
 * so the "no HTML escape hatch" guarantee (`domain/content.ts`) holds
 * exactly as before — a TEXT block is still the tiny Markdown subset, not
 * contentEditable, not rich HTML.
 */
export function BlockEditor({
  blocks,
  onChange,
  labels,
  allowColumns = true,
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
  labels: Labels;
  /** false inside a COLUMNS block's own column — a column cannot contain
   * another COLUMNS (`domain/content.ts`'s `leafBlockSchema` enforces this
   * server-side too; this just keeps the type out of the insert menu so a
   * staff member never sees an option the server would reject). */
  allowColumns?: boolean;
}) {
  const [ids, setIds] = useState<string[]>(() => blocks.map(() => crypto.randomUUID()));
  const stepCount = blocks.filter((b) => b.type === "TECHNICAL_STEP").length;
  const insertTypes = allowColumns ? BLOCK_TYPES : BLOCK_TYPES.filter((t) => t !== "COLUMNS");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function update(i: number, block: ContentBlock) {
    onChange(blocks.map((b, idx) => (idx === i ? block : b)));
  }
  function remove(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i));
    setIds(ids.filter((_, idx) => idx !== i));
  }
  function insertAt(index: number, type: BlockType) {
    const id = crypto.randomUUID();
    onChange([...blocks.slice(0, index), emptyBlock(type, stepCount), ...blocks.slice(index)]);
    setIds([...ids.slice(0, index), id, ...ids.slice(index)]);
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
    setIds(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="space-y-0.5">
      {blocks.length === 0 ? <p className="mb-2 text-sm text-muted-foreground">{labels.empty}</p> : null}

      <InsertRow onSelect={(type) => insertAt(0, type)} label={labels.insert} blockTypeLabels={labels.blockType} types={insertTypes} />

      <DndContext
        id="content-block-editor"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {blocks.map((block, i) => (
            <div key={ids[i]}>
              <SortableBlock id={ids[i]} dragLabel={labels.drag} removeLabel={labels.remove} onRemove={() => remove(i)}>
                <InlineBlock block={block} onChange={(b) => update(i, b)} labels={labels} />
              </SortableBlock>
              <InsertRow
                onSelect={(type) => insertAt(i + 1, type)}
                label={labels.insert}
                blockTypeLabels={labels.blockType}
                types={insertTypes}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

/** Wraps one block with drag machinery and a left-margin hover gutter
 * (handle + delete) — Notion's own placement — instead of a header row
 * inside the block, which is what made the D-071 version look like a stack
 * of form cards rather than a page. */
function SortableBlock({
  id,
  dragLabel,
  removeLabel,
  onRemove,
  children,
}: {
  id: string;
  dragLabel: string;
  removeLabel: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={cn("group/block relative flex gap-1", isDragging && "z-10 opacity-60")}>
      <div className="flex w-6 shrink-0 flex-col items-center gap-0.5 pt-1.5 opacity-0 transition-opacity group-hover/block:opacity-100">
        <button
          type="button"
          aria-label={dragLabel}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="min-w-0 flex-1 py-1">{children}</div>
    </div>
  );
}

/** The "+" between (and around) blocks — pick a type and it lands at
 * exactly that position, Notion's own insertion pattern. */
function InsertRow({
  onSelect,
  label,
  blockTypeLabels,
  types = BLOCK_TYPES,
}: {
  onSelect: (type: BlockType) => void;
  label: string;
  blockTypeLabels: Record<BlockType, string>;
  types?: readonly BlockType[];
}) {
  return (
    <div className="group/insert relative ml-6 flex h-3 items-center">
      <div className="absolute inset-x-0 h-px bg-transparent transition-colors group-hover/insert:bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="relative z-10 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-soft transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/insert:opacity-100 data-popup-open:opacity-100"
            />
          }
        >
          <Plus className="size-3" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuGroup>
            {types.map((type) => {
              const Icon = BLOCK_ICON[type];
              return (
                <DropdownMenuItem key={type} onClick={() => onSelect(type)}>
                  <Icon className="size-3.5" aria-hidden />
                  {blockTypeLabels[type]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Border-side class maps for DIVIDER, kept in this file rather than shared
 * with `components/content/blocks.tsx` — same duplication the CALLOUT tone
 * styles already use, so the staff editor and the public renderer stay
 * independently editable. */
const TOKEN_COLOR_BORDER: Record<TokenColor, string> = {
  default: "border-foreground/10",
  primary: "border-primary",
  "chart-1": "border-chart-1",
  "chart-2": "border-chart-2",
  "chart-3": "border-chart-3",
  "chart-4": "border-chart-4",
  "chart-5": "border-chart-5",
};
const DIVIDER_THICKNESS_CLASS: Record<(typeof DIVIDER_THICKNESSES)[number], string> = {
  thin: "border-t",
  medium: "border-t-2",
  thick: "border-t-4",
};
const DIVIDER_STYLE_CLASS: Record<(typeof DIVIDER_STYLES)[number], string> = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
};
const SELECT_CLASS =
  "h-7 rounded-md border border-input bg-card px-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const ALIGN_ICON: Record<BlockAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

/** A small left/center/right picker shown above the block types where
 * alignment is a meaningful, standalone choice (`domain/content.ts`'s
 * `ALIGN` field: TEXT, IMAGE, VIDEO, BOOKMARK, BUTTON). */
function AlignControl({ value, onChange }: { value: BlockAlign; onChange: (a: BlockAlign) => void }) {
  return (
    <div className="mb-1 flex items-center justify-end gap-0.5">
      {BLOCK_ALIGNMENTS.map((a) => {
        const Icon = ALIGN_ICON[a];
        return (
          <button
            key={a}
            type="button"
            title={a}
            onClick={() => onChange(a)}
            className={cn(
              "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
              value === a && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** A row of color swatches, same visual language as CALLOUT's tone picker —
 * used for DIVIDER, TECHNICAL_STEP's numbered badge and BUTTON's background. */
function ColorSwatches({ value, onChange }: { value: TokenColor; onChange: (c: TokenColor) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {TOKEN_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={cn(
            "size-3.5 rounded-full ring-1 ring-inset ring-foreground/15",
            TOKEN_COLOR_BG[c],
            value === c && "ring-2 ring-foreground/60",
          )}
        />
      ))}
    </div>
  );
}

function InlineBlock({
  block,
  onChange,
  labels,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  labels: Labels;
}) {
  const f = labels.field;

  switch (block.type) {
    case "TEXT":
      return (
        <div>
          <AlignControl value={block.align} onChange={(align) => onChange({ ...block, align })} />
          <RichTextField
            value={toRichTextDoc(block)}
            onChange={(content) => onChange({ ...block, content, md: undefined })}
            placeholder={f.md}
            labels={labels.richText}
            className={cn("text-base leading-relaxed", block.align === "center" && "text-center", block.align === "right" && "text-right")}
          />
        </div>
      );

    case "CONTEMPLATION":
      return (
        <blockquote className="border-l-2 border-chart-1 py-1 pl-5">
          <RichTextField
            value={toRichTextDoc(block)}
            onChange={(content) => onChange({ ...block, content, md: undefined })}
            placeholder={f.md}
            labels={labels.richText}
            className="text-lg leading-relaxed text-pretty italic"
          />
        </blockquote>
      );

    case "CALLOUT": {
      const { surface, Icon } = CALLOUT_STYLES[block.tone];
      return (
        <aside className={cn("flex gap-3 rounded-2xl p-5", surface)}>
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <input
                value={block.title ?? ""}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
                placeholder={f.title}
                className={cn(SEAMLESS, "text-lg font-semibold")}
              />
              <div className="flex shrink-0 items-center gap-1">
                {CALLOUT_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    title={labels.calloutTone[tone]}
                    onClick={() => onChange({ ...block, tone })}
                    className={cn(
                      "size-3.5 rounded-full ring-1 ring-inset ring-foreground/15",
                      CALLOUT_STYLES[tone].surface,
                      block.tone === tone && "ring-2 ring-foreground/60",
                    )}
                  />
                ))}
              </div>
            </div>
            <RichTextField
              value={toRichTextDoc(block)}
              onChange={(content) => onChange({ ...block, content, md: undefined })}
              placeholder={f.md}
              labels={labels.richText}
              className="text-sm leading-relaxed"
            />
          </div>
        </aside>
      );
    }

    case "CHECKLIST":
      return (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <input
            value={block.title ?? ""}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder={f.title}
            className={cn(SEAMLESS, "mb-3 font-semibold")}
          />
          <ul className="flex flex-col gap-2.5">
            {block.items.map((item, i) => (
              <li key={i} className="group/item flex items-start gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden />
                <input
                  value={item}
                  onChange={(e) =>
                    onChange({ ...block, items: block.items.map((it, idx) => (idx === i ? e.target.value : it)) })
                  }
                  className={cn(SEAMLESS, "leading-relaxed")}
                />
                <button
                  type="button"
                  aria-label={f.removeItem}
                  onClick={() => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })}
                  className="mt-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onChange({ ...block, items: [...block.items, ""] })}
            className="mt-2.5 flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden />
            {f.addItem}
          </button>
        </div>
      );

    case "TECHNICAL_STEP":
      return (
        <div className="flex gap-4">
          <input
            type="number"
            min={1}
            value={block.step}
            onChange={(e) => onChange({ ...block, step: Number(e.target.value) || 1 })}
            aria-label={f.step}
            data-numeric
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-center text-sm font-semibold text-primary-foreground outline-none",
              TOKEN_COLOR_BG[block.color],
            )}
          />
          <div className="min-w-0 flex-1 space-y-1 pt-1">
            <div className="flex items-center gap-2">
              <input
                value={block.title}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
                placeholder={f.title}
                className={cn(SEAMLESS, "font-semibold")}
              />
              <ColorSwatches value={block.color} onChange={(color) => onChange({ ...block, color })} />
            </div>
            <RichTextField
              value={toRichTextDoc(block)}
              onChange={(content) => onChange({ ...block, content, md: undefined })}
              placeholder={f.md}
              labels={labels.richText}
              className="text-sm leading-relaxed"
            />
          </div>
        </div>
      );

    case "SUPPORT_BOX":
      return (
        <aside className="rounded-2xl bg-surface-lilac p-5 text-surface-lilac-ink">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <input
                value={block.title ?? ""}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
                placeholder={f.title}
                className={cn(SEAMLESS, "font-semibold")}
              />
              <RichTextField
                value={toRichTextDoc(block)}
                onChange={(content) => onChange({ ...block, content, md: undefined })}
                placeholder={f.md}
                labels={labels.richText}
                className="text-sm leading-relaxed"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={block.contactLabel ?? ""}
                  onChange={(e) => onChange({ ...block, contactLabel: e.target.value })}
                  placeholder={f.contactLabel}
                  className="rounded-lg bg-card/70 px-3 py-1.5 text-sm font-medium outline-none placeholder:text-current/50"
                />
                <input
                  value={block.contactUrl ?? ""}
                  onChange={(e) => onChange({ ...block, contactUrl: e.target.value })}
                  placeholder={f.contactUrl}
                  className={cn(SEAMLESS, "min-w-0 flex-1 text-xs opacity-80")}
                />
              </div>
            </div>
          </div>
        </aside>
      );

    case "BUTTON":
      return (
        <div className="space-y-1">
          <AlignControl value={block.align} onChange={(align) => onChange({ ...block, align })} />
          <div
            className={cn(
              "flex items-center gap-2",
              block.align === "center" && "justify-center",
              block.align === "right" && "justify-end",
            )}
          >
            <div className={cn("inline-flex rounded-xl px-5 py-2.5", TOKEN_COLOR_BG[block.color])}>
              <input
                value={block.label}
                onChange={(e) => onChange({ ...block, label: e.target.value })}
                placeholder={f.label}
                className={cn(SEAMLESS, "text-sm font-medium text-primary-foreground placeholder:text-primary-foreground/50")}
                size={Math.max(block.label.length, f.label.length, 6)}
              />
            </div>
            <ColorSwatches value={block.color} onChange={(color) => onChange({ ...block, color })} />
          </div>
          <input
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder={f.url}
            className={cn(SEAMLESS, "block max-w-sm text-xs text-muted-foreground")}
          />
        </div>
      );

    case "IMAGE":
    case "VIDEO":
    case "BOOKMARK":
      return (
        <div>
          <AlignControl value={block.align} onChange={(align) => onChange({ ...block, align } as ContentBlock)} />
          <MediaBlock block={block} onChange={onChange} labels={labels} />
        </div>
      );

    case "DIVIDER":
      return (
        <div className="flex flex-wrap items-center gap-3 py-2">
          <hr
            className={cn(
              "flex-1",
              DIVIDER_THICKNESS_CLASS[block.thickness],
              DIVIDER_STYLE_CLASS[block.style],
              TOKEN_COLOR_BORDER[block.color],
            )}
          />
          <select
            value={block.style}
            onChange={(e) => onChange({ ...block, style: e.target.value as typeof block.style })}
            className={SELECT_CLASS}
          >
            {DIVIDER_STYLES.map((s) => (
              <option key={s} value={s}>
                {labels.dividerStyle[s]}
              </option>
            ))}
          </select>
          <select
            value={block.thickness}
            onChange={(e) => onChange({ ...block, thickness: e.target.value as typeof block.thickness })}
            className={SELECT_CLASS}
          >
            {DIVIDER_THICKNESSES.map((t) => (
              <option key={t} value={t}>
                {labels.dividerThickness[t]}
              </option>
            ))}
          </select>
          <ColorSwatches value={block.color} onChange={(color) => onChange({ ...block, color })} />
        </div>
      );

    case "COLUMNS": {
      // Captured in a type-annotated const rather than read from the closed-over
      // `block` param inside the nested functions below: TS's switch narrowing
      // doesn't survive into a nested function body, so `block` would widen
      // back to the full ContentBlock union there.
      const columnsBlock: Extract<ContentBlock, { type: "COLUMNS" }> = block;
      const columns = columnsBlock.columns;
      function updateColumn(i: number, next: (typeof columns)[number]) {
        onChange({ ...columnsBlock, columns: columns.map((c, idx) => (idx === i ? next : c)) });
      }
      function removeColumn(i: number) {
        onChange({ ...columnsBlock, columns: columns.filter((_, idx) => idx !== i) });
      }
      return (
        <div className="space-y-3 rounded-2xl border border-dashed border-border p-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            {columns.map((col, ci) => (
              <div key={ci} className="min-w-0 flex-1 space-y-2" style={{ flexBasis: `${col.width}%` }}>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={col.width}
                      onChange={(e) => updateColumn(ci, { ...col, width: Number(e.target.value) || col.width })}
                      aria-label={f.width}
                      data-numeric
                      className="w-14 rounded-md border border-input bg-card px-1.5 py-0.5 text-xs outline-none"
                    />
                    %
                  </label>
                  {columns.length > 2 ? (
                    <button
                      type="button"
                      aria-label={f.removeColumn}
                      onClick={() => removeColumn(ci)}
                      className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <BlockEditor
                  blocks={col.blocks}
                  // Safe: allowColumns={false} keeps "COLUMNS" out of this
                  // nested editor's own insert menu, so it can never produce
                  // a block outside LeafContentBlock — and the server
                  // re-validates the whole tree against leafBlockSchema
                  // regardless (bodySchema.safeParse in saveVersionAction).
                  onChange={(next) => updateColumn(ci, { ...col, blocks: next as LeafContentBlock[] })}
                  labels={labels}
                  allowColumns={false}
                />
              </div>
            ))}
          </div>
          {columns.length < 4 ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...columnsBlock,
                  columns: [...columns, { width: Math.max(10, Math.floor(100 / (columns.length + 1))), blocks: [] }],
                })
              }
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden />
              {f.addColumn}
            </button>
          ) : null}
        </div>
      );
    }
  }
}

/** IMAGE, VIDEO and BOOKMARK render through the real `ContentBlocks`
 * component — an actual image, an actual playing video — not a hand-styled
 * stand-in, since faking a media player convincingly is more work and less
 * honest than just rendering the real one the public page will show. */
function MediaBlock({
  block,
  onChange,
  labels,
}: {
  block: Extract<ContentBlock, { type: "IMAGE" | "VIDEO" | "BOOKMARK" }>;
  onChange: (b: ContentBlock) => void;
  labels: Labels;
}) {
  const f = labels.field;
  const hasUrl = Boolean(block.url);
  const [open, setOpen] = useState(!hasUrl);
  const Icon = BLOCK_ICON[block.type];

  return (
    <div className="group/media relative">
      {hasUrl ? (
        <>
          <ContentBlocks body={[block]} />
          <button
            type="button"
            aria-label={labels.field.url}
            onClick={() => setOpen((o) => !o)}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-card/90 text-muted-foreground opacity-0 shadow-soft ring-1 ring-border transition-opacity group-hover/media:opacity-100"
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 py-10 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          <Icon className="size-4" aria-hidden />
          {labels.addMedia} {labels.blockType[block.type]}
        </button>
      )}

      {open ? (
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-card p-3">
          <Input
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value } as ContentBlock)}
            placeholder={f.url}
          />
          {block.type === "IMAGE" ? (
            <>
              <ImageUploadButton
                onUploaded={(url) => onChange({ ...block, url })}
                label={f.upload}
                errorLabels={f.uploadErrors}
              />
              <Input
                value={block.alt}
                onChange={(e) => onChange({ ...block, alt: e.target.value })}
                placeholder={f.alt}
              />
              <Input
                value={block.caption ?? ""}
                onChange={(e) => onChange({ ...block, caption: e.target.value })}
                placeholder={f.caption}
              />
            </>
          ) : null}
          {block.type === "VIDEO" ? (
            <Input
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              placeholder={f.caption}
            />
          ) : null}
          {block.type === "BOOKMARK" ? (
            <>
              <Input
                value={block.title}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
                placeholder={f.title}
              />
              <Input
                value={block.description ?? ""}
                onChange={(e) => onChange({ ...block, description: e.target.value })}
                placeholder={f.description}
              />
            </>
          ) : null}
          {hasUrl ? (
            <Button type="button" size="xs" variant="outline" className="rounded-md" onClick={() => setOpen(false)}>
              {labels.done}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

