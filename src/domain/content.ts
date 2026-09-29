/**
 * Study content vocabularies and the block schema (Phase 5).
 *
 * Study content is NOT UI strings. UI strings live in messages/*.json and are
 * versioned by git; study content lives in the database, is versioned
 * explicitly per locale, and is never overwritten once published
 * (docs/content-model.md).
 *
 * The body is a list of typed blocks, not a page builder and not free HTML.
 * Text-bearing blocks carry a restricted Markdown subset (src/domain/markdown.ts)
 * that is parsed to React elements, so nothing an author writes can become
 * markup on a public page.
 */
import { z } from "zod";
import { isSafeHref } from "./markdown";

/**
 * Content kinds, from docs/content-model.md.
 *
 * EMAIL_TEMPLATE and WHATSAPP_TEMPLATE are RETIRED (D-039). Message templates
 * now live in `communication_templates`, which is the right shape for them: a
 * message is plain text with placeholders, not a page of typed blocks, and it is
 * organised by the stage it belongs to rather than by a URL key.
 *
 * The enum values stay because Postgres cannot drop one safely and any content
 * row already using them must remain readable. `AUTHORABLE_CONTENT_TYPES` is
 * what the UI offers.
 */
export const CONTENT_TYPES = [
  "SESSION_PREPARATION",
  "SESSION_INTEGRATION",
  "VR_GUIDE",
  "TROUBLESHOOTING",
  "FAQ",
  "EMAIL_TEMPLATE",
  "WHATSAPP_TEMPLATE",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Types that are published as public participant pages. Message templates are
 * deliberately excluded: they are drafted for Phase 7 communications and must
 * never be reachable as a web page.
 */
export const PUBLIC_CONTENT_TYPES: readonly ContentType[] = [
  "SESSION_PREPARATION",
  "SESSION_INTEGRATION",
  "VR_GUIDE",
  "TROUBLESHOOTING",
  "FAQ",
];

/**
 * Types a person may create today. Message templates are excluded: they moved to
 * `communication_templates` in Phase 7 (D-039), and offering both would be two
 * places to write the same message.
 */
export const AUTHORABLE_CONTENT_TYPES: readonly ContentType[] = [
  "SESSION_PREPARATION",
  "SESSION_INTEGRATION",
  "VR_GUIDE",
  "TROUBLESHOOTING",
  "FAQ",
];

export function isAuthorableContentType(type: ContentType): boolean {
  return AUTHORABLE_CONTENT_TYPES.includes(type);
}

/** Types attached to a session in the programme rather than standing alone. */
export const SESSION_CONTENT_TYPES: readonly ContentType[] = [
  "SESSION_PREPARATION",
  "SESSION_INTEGRATION",
];

export function isPublicContentType(type: ContentType): boolean {
  return PUBLIC_CONTENT_TYPES.includes(type);
}

export function isSessionContentType(type: ContentType): boolean {
  return SESSION_CONTENT_TYPES.includes(type);
}

/** Editorial workflow for a single version. */
export const CONTENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * Allowed moves.
 *
 * PUBLISHED is terminal here on purpose: publishing never mutates a published
 * row, so "editing published content" means creating a new version, and the old
 * one is archived by the service when the new one goes live. ARCHIVED is the
 * end of a version's life — history, not a workspace.
 */
export const CONTENT_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ["REVIEW", "PUBLISHED"],
  REVIEW: ["DRAFT", "PUBLISHED"],
  PUBLISHED: [],
  ARCHIVED: [],
};

export function canTransitionContent(from: ContentStatus, to: ContentStatus): boolean {
  return CONTENT_TRANSITIONS[from].includes(to);
}

/** A version may only be edited while it is still being worked on. */
export function isEditable(status: ContentStatus): boolean {
  return status === "DRAFT" || status === "REVIEW";
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export const BLOCK_TYPES = [
  "TEXT",
  "VIDEO",
  "IMAGE",
  "BOOKMARK",
  "CHECKLIST",
  "CALLOUT",
  "CONTEMPLATION",
  "BUTTON",
  "TECHNICAL_STEP",
  "SUPPORT_BOX",
  "DIVIDER",
  "COLUMNS",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

const MD = z.string().max(4000);
const LINE = z.string().trim().min(1).max(300);

/** A URL an author may point at. Same scheme rules as inline links. */
const SAFE_URL = z
  .string()
  .trim()
  .max(600)
  .refine(isSafeHref, { message: "unsafeUrl" });

export const CALLOUT_TONES = ["INFO", "WARNING", "SUPPORT"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

/**
 * A closed palette of design tokens (`src/app/globals.css`'s `chart-1`..
 * `chart-5`, plus `primary` and a "default" no-color-applied option) used for
 * every author-chosen block color (DIVIDER, TECHNICAL_STEP's badge, BUTTON's
 * background). Never free hex/CSS: keeps every color on-brand and keeps a
 * color choice from becoming a `style=` injection surface.
 */
export const TOKEN_COLORS = ["default", "primary", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;
export type TokenColor = (typeof TOKEN_COLORS)[number];
const COLOR = z.enum(TOKEN_COLORS);

export const DIVIDER_STYLES = ["solid", "dashed", "dotted"] as const;
export type DividerStyle = (typeof DIVIDER_STYLES)[number];

export const DIVIDER_THICKNESSES = ["thin", "medium", "thick"] as const;
export type DividerThickness = (typeof DIVIDER_THICKNESSES)[number];

/** Left/center/right for the block types where that's a meaningful choice —
 * standalone content (text, media, a button), not full-width cards like
 * CALLOUT or CHECKLIST, where "alignment" has no clear meaning. */
export const BLOCK_ALIGNMENTS = ["left", "center", "right"] as const;
export type BlockAlign = (typeof BLOCK_ALIGNMENTS)[number];
const ALIGN = z.enum(BLOCK_ALIGNMENTS).default("left");

/**
 * The leaf block types — everything except COLUMNS, which nests these (one
 * level only: a column cannot itself contain a COLUMNS block). Each is a
 * closed shape validated on save AND on render, so a row that somehow
 * acquired an unknown block cannot reach a page.
 */
const LEAF_BLOCK_VARIANTS = [
  z.object({ type: z.literal("TEXT"), md: MD, align: ALIGN }),
  z.object({
    type: z.literal("VIDEO"),
    url: SAFE_URL,
    caption: z.string().trim().max(300).optional(),
    align: ALIGN,
  }),
  z.object({
    type: z.literal("IMAGE"),
    url: SAFE_URL,
    /** Required: a decorative-only image has no place in participant guidance. */
    alt: z.string().trim().min(1).max(300),
    caption: z.string().trim().max(300).optional(),
    align: ALIGN,
  }),
  z.object({
    type: z.literal("BOOKMARK"),
    url: SAFE_URL,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(300).optional(),
    align: ALIGN,
  }),
  z.object({
    type: z.literal("CHECKLIST"),
    title: z.string().trim().max(200).optional(),
    items: z.array(LINE).min(1).max(30),
  }),
  z.object({
    type: z.literal("CALLOUT"),
    tone: z.enum(CALLOUT_TONES).default("INFO"),
    title: z.string().trim().max(200).optional(),
    md: MD,
  }),
  z.object({ type: z.literal("CONTEMPLATION"), md: MD }),
  z.object({
    type: z.literal("BUTTON"),
    label: z.string().trim().min(1).max(80),
    url: SAFE_URL,
    color: COLOR.default("primary"),
    align: ALIGN,
  }),
  z.object({
    type: z.literal("TECHNICAL_STEP"),
    /** Step number within its run, so a reader can be told "go back to step 3". */
    step: z.number().int().min(1).max(99),
    title: z.string().trim().min(1).max(200),
    md: MD,
    color: COLOR.default("primary"),
  }),
  z.object({
    type: z.literal("SUPPORT_BOX"),
    title: z.string().trim().max(200).optional(),
    md: MD,
    contactLabel: z.string().trim().max(120).optional(),
    contactUrl: SAFE_URL.optional(),
  }),
  z.object({
    type: z.literal("DIVIDER"),
    style: z.enum(DIVIDER_STYLES).default("solid"),
    thickness: z.enum(DIVIDER_THICKNESSES).default("thin"),
    color: COLOR.default("default"),
  }),
] as const;

const leafBlockSchema = z.discriminatedUnion("type", LEAF_BLOCK_VARIANTS);

/** A column's own content is a leaf block list — a mini page, not a mini
 * rich-text doc, so a column can hold a CALLOUT or CHECKLIST, not just text. */
const columnSchema = z.object({
  width: z.number().int().min(10).max(100),
  blocks: z.array(leafBlockSchema).max(20),
});

export const blockSchema = z.discriminatedUnion("type", [
  ...LEAF_BLOCK_VARIANTS,
  z.object({
    type: z.literal("COLUMNS"),
    columns: z.array(columnSchema).min(2).max(4),
  }),
]);

export type ContentBlock = z.infer<typeof blockSchema>;
/** A leaf block — everything COLUMNS can nest. */
export type LeafContentBlock = z.infer<typeof leafBlockSchema>;

export const bodySchema = z.array(blockSchema).max(120);
export type ContentBody = z.infer<typeof bodySchema>;

/**
 * Parse a stored body defensively. A row written by an older version of the
 * schema, or hand-edited in the database, must not take a public page down:
 * unknown or malformed blocks are dropped and reported rather than thrown.
 */
export function parseBody(value: unknown): { blocks: ContentBody; dropped: number } {
  if (!Array.isArray(value)) return { blocks: [], dropped: 0 };
  const blocks: ContentBody = [];
  let dropped = 0;
  for (const raw of value) {
    const parsed = blockSchema.safeParse(raw);
    if (parsed.success) blocks.push(parsed.data);
    else dropped += 1;
  }
  return { blocks, dropped };
}

/** Content key: the URL slug for public content, e.g. "preparacion-vr". */
export const CONTENT_KEY_PATTERN = /^[a-z][a-z0-9-]{1,60}$/;
export const CONTENT_TITLE_MAX_LENGTH = 200;

/** Public path for a piece of content, or null when it is not web-published. */
export function publicPathFor(params: {
  type: ContentType;
  key: string;
  sessionCode: string | null;
}): string | null {
  if (!isPublicContentType(params.type)) return null;
  if (isSessionContentType(params.type)) {
    if (!params.sessionCode) return null;
    const part = params.type === "SESSION_PREPARATION" ? "preparacion" : "integracion";
    return `/estudio/sesiones/${params.sessionCode}/${part}`;
  }
  return `/estudio/${params.key}`;
}
