/**
 * Rich text (Phase 5, lote 4).
 *
 * Replaces the tiny Markdown-at-rest format (`domain/markdown.ts`) as the
 * editing surface for TEXT/CALLOUT/CONTEMPLATION/TECHNICAL_STEP/SUPPORT_BOX's
 * body text, backing a real Tiptap editor instead of a plain textarea. The
 * security posture from `domain/markdown.ts` carries over unchanged: this is
 * a closed, server-validated JSON shape mirroring Tiptap's own `.getJSON()`
 * output, restricted to a fixed set of node/mark types and attrs. There is
 * still no raw HTML anywhere — `editor.getJSON()` is client editor state, not
 * a trusted payload, so every save re-validates against `richTextDocSchema`
 * exactly as `bodySchema` already re-validates every other block.
 *
 * Deliberately NOT supported (see docs/decisions.md's lote-4 entry for why):
 * nested lists, more than one paragraph per list item, blockquotes, tables,
 * inline images, free/arbitrary text color. `TEXT_COLOR_TOKENS` is the same
 * closed design-token palette `domain/content.ts` uses for block-level
 * colors (DIVIDER, TECHNICAL_STEP, BUTTON) — never a free hex value.
 */
import { z } from "zod";
import { isSafeHref, parseMarkdown, type Block as MdBlock, type Inline as MdInline } from "./markdown";

export const TEXT_COLOR_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;
export type TextColorToken = (typeof TEXT_COLOR_TOKENS)[number];

const LINK_HREF = z.string().trim().max(600).refine(isSafeHref, { message: "unsafeUrl" });

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("code") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href: LINK_HREF }) }),
  z.object({ type: z.literal("textColor"), attrs: z.object({ token: z.enum(TEXT_COLOR_TOKENS) }) }),
]);
export type RichTextMark = z.infer<typeof markSchema>;

const textNodeSchema = z.object({
  type: z.literal("text"),
  // Per-node cap well under the doc-wide total-length refine below; this one
  // mainly guards against one absurd single node rather than overall size.
  text: z.string().min(1).max(2000),
  marks: z.array(markSchema).max(6).optional(),
});
const hardBreakNodeSchema = z.object({ type: z.literal("hardBreak") });
const inlineNodeSchema = z.union([textNodeSchema, hardBreakNodeSchema]);
export type RichTextInlineNode = z.infer<typeof inlineNodeSchema>;

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  content: z.array(inlineNodeSchema).max(100).optional(),
});
/** H1-H4 only, per the founder's request — no H5/H6. */
export const HEADING_LEVELS = [1, 2, 3, 4] as const;
const headingSchema = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }),
  content: z.array(inlineNodeSchema).max(100).optional(),
});
/**
 * A list item holds exactly one paragraph — no nested lists, no multiple
 * paragraphs per item. Matches what the legacy Markdown subset could already
 * express (flat lists only), so this isn't a feature regression, and it
 * keeps the whole doc schema at a fixed, shallow depth with no true
 * self-recursion (doc -> block -> [list -> item -> paragraph] -> inline).
 */
const listItemSchema = z.object({
  type: z.literal("listItem"),
  content: z.tuple([paragraphSchema]),
});
const bulletListSchema = z.object({
  type: z.literal("bulletList"),
  content: z.array(listItemSchema).max(50),
});
const orderedListSchema = z.object({
  type: z.literal("orderedList"),
  content: z.array(listItemSchema).max(50),
});

const blockNodeSchema = z.discriminatedUnion("type", [
  paragraphSchema,
  headingSchema,
  bulletListSchema,
  orderedListSchema,
]);
export type RichTextBlockNode = z.infer<typeof blockNodeSchema>;

function totalTextLength(doc: { content: readonly RichTextBlockNode[] }): number {
  let total = 0;
  const inlineLength = (nodes: readonly RichTextInlineNode[] | undefined) => {
    for (const n of nodes ?? []) if (n.type === "text") total += n.text.length;
  };
  for (const block of doc.content) {
    if (block.type === "paragraph" || block.type === "heading") inlineLength(block.content);
    else for (const item of block.content) inlineLength(item.content[0].content);
  }
  return total;
}

export const richTextDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(blockNodeSchema).min(1).max(150),
  })
  // The per-array caps above bound node *count*; this bounds total character
  // weight directly (roughly 5x the old single-block MD cap of 4000, generous
  // for a page's worth of rich text spread across many blocks/paragraphs).
  .refine((doc) => totalTextLength(doc) <= 20000, { message: "tooLong" });
export type RichTextDoc = z.infer<typeof richTextDocSchema>;

export function emptyRichTextDoc(): RichTextDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** The doc to actually show/edit for a block that may still carry the
 * legacy `md` shape instead of `content` — prefers `content`, upconverts
 * `md` on the fly otherwise, falls back to an empty doc for a brand new
 * block. The one call site every rich-text-bearing block's editor goes
 * through, so the upconversion logic exists in exactly one place. */
export function toRichTextDoc(block: { md?: string; content?: RichTextDoc }): RichTextDoc {
  if (block.content) return block.content;
  if (block.md !== undefined) return markdownAstToRichTextDoc(block.md);
  return emptyRichTextDoc();
}

/**
 * Wraps a plain string as a single-paragraph rich-text doc, with NO markdown
 * parsing — titles and checklist items never supported `**bold**`-style
 * syntax the way body text did, they were always literal text, so there is
 * nothing to interpret here, just a shape change.
 */
export function plainTextToRichTextDoc(text: string): RichTextDoc {
  const trimmed = text.trim();
  if (!trimmed) return emptyRichTextDoc();
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: trimmed }] }] };
}

/** The doc to show/edit for a title-like `{ title?, titleContent? }` pair
 * (CALLOUT/TECHNICAL_STEP/SUPPORT_BOX) — same prefer-new-fall-back-to-legacy
 * shape as `toRichTextDoc`, just plain-text upconversion instead of Markdown
 * parsing. */
export function toTitleRichTextDoc(value: { title?: string; titleContent?: RichTextDoc }): RichTextDoc {
  if (value.titleContent) return value.titleContent;
  if (value.title) return plainTextToRichTextDoc(value.title);
  return emptyRichTextDoc();
}

/** A CHECKLIST item is either the legacy bare string or already a doc. */
export function toItemRichTextDoc(item: string | RichTextDoc): RichTextDoc {
  return typeof item === "string" ? plainTextToRichTextDoc(item) : item;
}

/**
 * For inline-only display contexts (a title, a checklist item) — the first
 * block's inline content only. Titles and items are conceptually a single
 * line; if someone's rich-text edit produced a heading/list/multiple
 * paragraphs anyway (the toolbar doesn't stop them), only the first block
 * shows rather than silently dropping the field or rendering a multi-block
 * layout somewhere text-sized content is expected.
 */
export function inlineOfRichTextDoc(doc: RichTextDoc): readonly RichTextInlineNode[] {
  const first = doc.content[0];
  if (!first) return [];
  if (first.type === "paragraph" || first.type === "heading") return first.content ?? [];
  const item = first.content[0];
  return item?.content[0]?.content ?? [];
}

/**
 * Mechanically upconverts a legacy Markdown string (the old `md` field) to
 * the new rich-text doc shape. Lossless for anything the old subset could
 * express: bold/italic/code/link become marks on flattened text leaves
 * (Tiptap's model has marks as a flat array per text node, not nested
 * wrapper nodes like the old AST, hence the flattening here), paragraphs and
 * lists map directly. Used two ways: (1) the staff editor upconverts a
 * legacy block the moment it's loaded, so any block a person touches again
 * migrates itself with a human looking at the result before saving; (2) it
 * stays available for an optional, unhurried future backfill script once
 * that organic migration has run its course — see docs/decisions.md.
 */
export function markdownAstToRichTextDoc(md: string): RichTextDoc {
  const blocks = parseMarkdown(md);
  if (blocks.length === 0) return emptyRichTextDoc();
  const content: RichTextBlockNode[] = blocks.map(mdBlockToRichText);
  return { type: "doc", content };
}

type RichTextListItem = Extract<RichTextBlockNode, { type: "bulletList" }>["content"][number];

function mdItemToListItem(item: readonly MdInline[]): RichTextListItem {
  const inline = flattenInline(item, []);
  return {
    type: "listItem",
    content: [{ type: "paragraph", content: inline.length > 0 ? inline : undefined }],
  };
}

function mdBlockToRichText(block: MdBlock): RichTextBlockNode {
  if (block.kind === "paragraph") {
    const inline = flattenInline(block.children, []);
    return { type: "paragraph", content: inline.length > 0 ? inline : undefined };
  }
  const content = block.items.map(mdItemToListItem);
  if (block.ordered) return { type: "orderedList", content };
  return { type: "bulletList", content };
}

/** The old AST nests marks as wrapper nodes (`strong` containing children);
 * Tiptap's model flattens them onto each text leaf's `marks` array. This
 * walks the old tree accumulating active marks and only emits leaves. */
function flattenInline(nodes: readonly MdInline[], activeMarks: readonly RichTextMark[]): RichTextInlineNode[] {
  const out: RichTextInlineNode[] = [];
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        if (node.value.length > 0) {
          out.push({ type: "text", text: node.value, marks: activeMarks.length ? [...activeMarks] : undefined });
        }
        break;
      case "code":
        out.push({ type: "text", text: node.value, marks: [...activeMarks, { type: "code" }] });
        break;
      case "strong":
        out.push(...flattenInline(node.children, [...activeMarks, { type: "bold" }]));
        break;
      case "em":
        out.push(...flattenInline(node.children, [...activeMarks, { type: "italic" }]));
        break;
      case "link":
        out.push(...flattenInline(node.children, [...activeMarks, { type: "link", attrs: { href: node.href } }]));
        break;
    }
  }
  return out;
}
