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
  Bookmark,
  CircleCheck,
  CircleHelp,
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
import { BLOCK_TYPES, CALLOUT_TONES, type BlockType, type CalloutTone, type ContentBlock } from "@/domain/content";

const CALLOUT_STYLES: Record<CalloutTone, { surface: string; Icon: typeof Info }> = {
  INFO: { surface: "bg-surface-sky text-surface-sky-ink", Icon: Info },
  WARNING: { surface: "bg-surface-peach text-surface-peach-ink", Icon: TriangleAlert },
  SUPPORT: { surface: "bg-surface-mint text-surface-mint-ink", Icon: LifeBuoy },
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
};

/** Seamless text input styling shared by every inline-editable field below —
 * no border, no background, so a block reads as part of the page and not as
 * a form until the reader's cursor is actually in it. */
const SEAMLESS = "w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/50";

function emptyBlock(type: BlockType, stepCount: number): ContentBlock {
  switch (type) {
    case "TEXT":
      return { type, md: "" };
    case "VIDEO":
      return { type, url: "" };
    case "IMAGE":
      return { type, url: "", alt: "" };
    case "BOOKMARK":
      return { type, url: "", title: "" };
    case "CHECKLIST":
      return { type, items: [""] };
    case "CALLOUT":
      return { type, tone: "INFO", md: "" };
    case "CONTEMPLATION":
      return { type, md: "" };
    case "BUTTON":
      return { type, label: "", url: "" };
    case "TECHNICAL_STEP":
      return { type, step: stepCount + 1, title: "", md: "" };
    case "SUPPORT_BOX":
      return { type, md: "" };
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
}: {
  blocks: ContentBlock[];
  onChange: (next: ContentBlock[]) => void;
  labels: Labels;
}) {
  const [ids, setIds] = useState<string[]>(() => blocks.map(() => crypto.randomUUID()));
  const stepCount = blocks.filter((b) => b.type === "TECHNICAL_STEP").length;
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

      <InsertRow onSelect={(type) => insertAt(0, type)} label={labels.insert} blockTypeLabels={labels.blockType} />

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
}: {
  onSelect: (type: BlockType) => void;
  label: string;
  blockTypeLabels: Record<BlockType, string>;
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
            {BLOCK_TYPES.map((type) => {
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
        <AutoTextarea
          value={block.md}
          onChange={(v) => onChange({ ...block, md: v })}
          placeholder={f.md}
          className="text-base leading-relaxed"
        />
      );

    case "CONTEMPLATION":
      return (
        <blockquote className="border-l-2 border-chart-1 py-1 pl-5">
          <AutoTextarea
            value={block.md}
            onChange={(v) => onChange({ ...block, md: v })}
            placeholder={f.md}
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
            <AutoTextarea
              value={block.md}
              onChange={(v) => onChange({ ...block, md: v })}
              placeholder={f.md}
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
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-center text-sm font-semibold text-primary-foreground outline-none"
          />
          <div className="min-w-0 flex-1 space-y-1 pt-1">
            <input
              value={block.title}
              onChange={(e) => onChange({ ...block, title: e.target.value })}
              placeholder={f.title}
              className={cn(SEAMLESS, "font-semibold")}
            />
            <AutoTextarea
              value={block.md}
              onChange={(v) => onChange({ ...block, md: v })}
              placeholder={f.md}
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
              <AutoTextarea
                value={block.md}
                onChange={(v) => onChange({ ...block, md: v })}
                placeholder={f.md}
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
          <div className="inline-flex rounded-xl bg-primary px-5 py-2.5">
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder={f.label}
              className={cn(SEAMLESS, "text-sm font-medium text-primary-foreground placeholder:text-primary-foreground/50")}
              size={Math.max(block.label.length, f.label.length, 6)}
            />
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
      return <MediaBlock block={block} onChange={onChange} labels={labels} />;
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

/**
 * A textarea whose selection can be wrapped in Markdown syntax from a small
 * floating toolbar ("when you highlight text you can format it") and that
 * grows with its content instead of scrolling inside a fixed box — Notion's
 * own paragraph behaviour. Still plain Markdown at rest — **bold**,
 * *italic*, `code`, a link — the same tiny subset `domain/markdown.ts`
 * already parses; no contentEditable, no HTML. The toolbar mutates the
 * textarea's own value via selectionStart/selectionEnd, same as any
 * plain-text editor's "wrap selection" command.
 */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [ref, setRef] = useState<HTMLTextAreaElement | null>(null);

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function wrap(before: string, after: string = before) {
    if (!ref || !selection || selection.start === selection.end) return;
    const { start, end } = selection;
    const next = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ref.focus();
      ref.setSelectionRange(start + before.length, end + before.length);
    });
  }

  const showToolbar = selection && selection.start !== selection.end;

  return (
    <div className="relative">
      {showToolbar ? (
        <div className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lift">
          <ToolbarButton label="Bold" onClick={() => wrap("**")}>
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => wrap("*")}>
            <span className="italic">i</span>
          </ToolbarButton>
          <ToolbarButton label="Code" onClick={() => wrap("`")}>
            <span className="font-mono">{"</>"}</span>
          </ToolbarButton>
          <ToolbarButton label="Link" onClick={() => wrap("[", "](https://)")}>
            <span className="underline">🔗</span>
          </ToolbarButton>
        </div>
      ) : null}
      <textarea
        ref={(el) => {
          setRef(el);
          if (el) autosize(el);
        }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autosize(e.currentTarget);
        }}
        onSelect={(e) => {
          const el = e.currentTarget;
          setSelection({ start: el.selectionStart, end: el.selectionEnd });
        }}
        onBlur={() => setSelection(null)}
        rows={1}
        placeholder={placeholder}
        className={cn(SEAMLESS, "resize-none overflow-hidden", className)}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded text-xs text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}
