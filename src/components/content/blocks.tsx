import { Fragment } from "react";
import { Bookmark, CircleCheck, CircleHelp, Info, LifeBuoy, TriangleAlert } from "lucide-react";
import type { BlockAlign, ContentBlock, ContentBody, TokenColor } from "@/domain/content";
import { parseMarkdown, type Inline } from "@/domain/markdown";
import { inlineOfRichTextDoc } from "@/domain/rich-text";
import type { RichTextBlockNode, RichTextDoc, RichTextInlineNode, TextColorToken } from "@/domain/rich-text";
import { resolveVideoEmbed } from "@/domain/video";
import { cn } from "@/lib/utils";

/**
 * Renders study content blocks.
 *
 * Everything here builds React elements. `dangerouslySetInnerHTML` is never used
 * and no HTML string is ever constructed, so staff-authored content cannot
 * become markup on a public page. Unknown blocks are dropped upstream by
 * `parseBody`, so this component only ever receives shapes it knows.
 */

function InlineNodes({ nodes }: { nodes: readonly Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.kind) {
          case "text":
            return <Fragment key={i}>{node.value}</Fragment>;
          case "strong":
            return (
              <strong key={i} className="font-semibold">
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <InlineNodes nodes={node.children} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
                {node.value}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={node.href}
                // External destinations are opened safely; the href itself was
                // already scheme-checked when the Markdown was parsed.
                rel="noopener noreferrer"
                className="rounded underline underline-offset-4 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <InlineNodes nodes={node.children} />
              </a>
            );
        }
      })}
    </>
  );
}

/** A Markdown subset: paragraphs and lists only. */
export function Markdown({ md, className }: { md: string; className?: string }) {
  const blocks = parseMarkdown(md);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {blocks.map((block, i) =>
        block.kind === "paragraph" ? (
          <p key={i} className="leading-relaxed">
            <InlineNodes nodes={block.children} />
          </p>
        ) : block.ordered ? (
          <ol key={i} className="ml-5 flex list-decimal flex-col gap-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="leading-relaxed">
                <InlineNodes nodes={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="ml-5 flex list-disc flex-col gap-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="leading-relaxed">
                <InlineNodes nodes={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** Same closed palette as `rich-text-field.tsx`'s `TEXT_COLOR_CLASS` —
 * duplicated rather than imported (that file is staff-editor-only and
 * pulls in Tiptap; this one must never do that), written as full literal
 * class strings so Tailwind's build-time scanner can see them. */
const TEXT_COLOR_CLASS: Record<TextColorToken, string> = {
  "chart-1": "text-chart-1",
  "chart-2": "text-chart-2",
  "chart-3": "text-chart-3",
  "chart-4": "text-chart-4",
  "chart-5": "text-chart-5",
};

function RichTextInline({ nodes }: { nodes: readonly RichTextInlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "hardBreak") return <br key={i} />;
        let el: React.ReactNode = node.text;
        for (const mark of node.marks ?? []) {
          switch (mark.type) {
            case "bold":
              el = <strong className="font-semibold">{el}</strong>;
              break;
            case "italic":
              el = <em>{el}</em>;
              break;
            case "underline":
              el = <u>{el}</u>;
              break;
            case "code":
              el = <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{el}</code>;
              break;
            case "link":
              el = (
                <a
                  href={mark.attrs.href}
                  rel="noopener noreferrer"
                  className="rounded underline underline-offset-4 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {el}
                </a>
              );
              break;
            case "textColor":
              el = <span className={TEXT_COLOR_CLASS[mark.attrs.token]}>{el}</span>;
              break;
          }
        }
        return <Fragment key={i}>{el}</Fragment>;
      })}
    </>
  );
}

const HEADING_TAG = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" } as const;
/** Deliberately smaller than the page's own <h1> title (text-3xl/4xl,
 * [key]/page.tsx and the sessions variant) — an in-body heading is
 * structure within the article, not a second page title. */
const HEADING_CLASS = { 1: "text-2xl", 2: "text-xl", 3: "text-lg", 4: "text-base" } as const;

function RichTextBlock({ node }: { node: RichTextBlockNode }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p className="leading-relaxed">
          <RichTextInline nodes={node.content ?? []} />
        </p>
      );
    case "heading": {
      const level = node.attrs.level;
      const Tag = HEADING_TAG[level];
      return (
        <Tag className={cn("font-semibold tracking-tight text-balance", HEADING_CLASS[level])}>
          <RichTextInline nodes={node.content ?? []} />
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul className="ml-5 flex list-disc flex-col gap-1.5">
          {node.content.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <RichTextInline nodes={item.content[0].content ?? []} />
            </li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol className="ml-5 flex list-decimal flex-col gap-1.5">
          {node.content.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <RichTextInline nodes={item.content[0].content ?? []} />
            </li>
          ))}
        </ol>
      );
  }
}

/** The Tiptap-authored replacement for `Markdown` — same technique (a typed
 * tree switched into real React elements, no `generateHTML`, no
 * `dangerouslySetInnerHTML`), walking the richer validated tree
 * `richTextDocSchema` (`domain/rich-text.ts`) produces instead of the old
 * flat Markdown-string AST. */
export function RichText({ content, className }: { content: RichTextDoc; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {content.content.map((node, i) => (
        <RichTextBlock key={i} node={node} />
      ))}
    </div>
  );
}

/** The one call site every rich-text-bearing block's public render goes
 * through: prefers the new `content` shape, falls back to rendering the
 * legacy `md` string through the old `Markdown` component untouched — no
 * upconversion needed just to render a legacy row, only the staff editor
 * needs the upconverted doc (`domain/rich-text.ts`'s `toRichTextDoc`) since
 * it needs something editable, not just something displayable. See
 * docs/decisions.md's lote-4 entry for why both shapes stay readable
 * indefinitely rather than a one-shot data migration. */
function BlockBody({ block, className }: { block: { md?: string; content?: RichTextDoc }; className?: string }) {
  if (block.content) return <RichText content={block.content} className={className} />;
  if (block.md) return <Markdown md={block.md} className={className} />;
  return null;
}

/** A title-like field (`{ title?, titleContent? }` on CALLOUT/TECHNICAL_STEP/
 * SUPPORT_BOX): prefers the rich `titleContent`, rendered inline (marks
 * only — bold/color/link/etc. — never a heading or list, even if a person's
 * edit produced one; `inlineOfRichTextDoc` only looks at the first block),
 * falls back to the legacy plain `title` string. */
function TitleText({ value }: { value: { title?: string; titleContent?: RichTextDoc } }) {
  if (value.titleContent) return <RichTextInline nodes={inlineOfRichTextDoc(value.titleContent)} />;
  if (value.title) return <>{value.title}</>;
  return null;
}

/** A CHECKLIST item: either the legacy plain string or a rich-text doc,
 * rendered inline the same way a title is. */
function ItemText({ item }: { item: string | RichTextDoc }) {
  if (typeof item === "string") return <>{item}</>;
  return <RichTextInline nodes={inlineOfRichTextDoc(item)} />;
}

const CALLOUT_STYLES = {
  INFO: { surface: "bg-surface-sky text-surface-sky-ink", Icon: Info },
  WARNING: { surface: "bg-surface-peach text-surface-peach-ink", Icon: TriangleAlert },
  SUPPORT: { surface: "bg-surface-mint text-surface-mint-ink", Icon: LifeBuoy },
} as const;

/** Same closed token palette as `block-editor.tsx`'s `TOKEN_COLOR_BG` —
 * duplicated rather than imported, matching this file's existing pattern of
 * keeping the public renderer's render-class maps independent of the
 * staff-only editor's. */
const TOKEN_COLOR_BG: Record<TokenColor, string> = {
  default: "bg-muted-foreground/30",
  primary: "bg-primary",
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};
const TOKEN_COLOR_BORDER: Record<TokenColor, string> = {
  default: "border-foreground/10",
  primary: "border-primary",
  "chart-1": "border-chart-1",
  "chart-2": "border-chart-2",
  "chart-3": "border-chart-3",
  "chart-4": "border-chart-4",
  "chart-5": "border-chart-5",
};
const DIVIDER_THICKNESS_CLASS = { thin: "border-t", medium: "border-t-2", thick: "border-t-4" } as const;
const DIVIDER_STYLE_CLASS = { solid: "border-solid", dashed: "border-dashed", dotted: "border-dotted" } as const;

const TEXT_ALIGN_CLASS: Record<BlockAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
/** Standalone media/button blocks default to filling the column when
 * left-aligned (today's look, unchanged); centering or right-aligning them
 * only reads as intentional once the element isn't full-width any more, so
 * those two also cap the width. */
const MEDIA_ALIGN_CLASS: Record<BlockAlign, string> = {
  left: "",
  center: "mx-auto max-w-md",
  right: "ml-auto max-w-md",
};
const ROW_ALIGN_CLASS: Record<BlockAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "TEXT":
      return <BlockBody block={block} className={TEXT_ALIGN_CLASS[block.align]} />;

    case "CALLOUT": {
      const { surface, Icon } = CALLOUT_STYLES[block.tone];
      return (
        <aside className={cn("flex gap-3 rounded-2xl p-5", surface)}>
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            {block.title || block.titleContent ? (
              <p className="text-lg font-semibold">
                <TitleText value={block} />
              </p>
            ) : null}
            <BlockBody block={block} className="mt-1" />
          </div>
        </aside>
      );
    }

    case "CONTEMPLATION":
      // Set apart typographically rather than boxed: this is an invitation to
      // pause, and a bordered card would read as an alert.
      return (
        <blockquote className="border-l-2 border-chart-1 py-1 pl-5 text-lg leading-relaxed text-pretty italic">
          <BlockBody block={block} />
        </blockquote>
      );

    case "CHECKLIST":
      return (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          {block.title ? <p className="mb-3 font-semibold">{block.title}</p> : null}
          <ul className="flex flex-col gap-2.5">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden />
                <span className="leading-relaxed">
                  <ItemText item={item} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "TECHNICAL_STEP":
      return (
        <div className="flex gap-4">
          <span
            data-numeric
            aria-hidden
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground",
              TOKEN_COLOR_BG[block.color],
            )}
          >
            {block.step}
          </span>
          <div className="min-w-0 pt-1">
            <p className="font-semibold">
              <span className="sr-only">Paso {block.step}: </span>
              <TitleText value={block} />
            </p>
            <BlockBody block={block} className="mt-1.5" />
          </div>
        </div>
      );

    case "SUPPORT_BOX":
      return (
        <aside className="rounded-2xl bg-surface-lilac p-5 text-surface-lilac-ink">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              {block.title || block.titleContent ? (
                <p className="font-semibold">
                  <TitleText value={block} />
                </p>
              ) : null}
              <BlockBody block={block} className="mt-1" />
              {block.contactUrl && block.contactLabel ? (
                <a
                  href={block.contactUrl}
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-lg bg-card/70 px-3 py-1.5 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {block.contactLabel}
                </a>
              ) : null}
            </div>
          </div>
        </aside>
      );

    case "BUTTON":
      return (
        <div className={cn("flex", ROW_ALIGN_CLASS[block.align])}>
          <a
            href={block.url}
            rel="noopener noreferrer"
            className={cn(
              "inline-flex rounded-xl px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              TOKEN_COLOR_BG[block.color],
            )}
          >
            {block.label}
          </a>
        </div>
      );

    case "IMAGE":
      return (
        <figure className={cn("flex flex-col gap-2", MEDIA_ALIGN_CLASS[block.align])}>
          {/* Plain <img>: content images are author-supplied external URLs, which
              next/image would need configured hosts for. A fixed aspect-ratio
              box with object-cover (2026-09-19) keeps a mis-sized or
              partially-broken source image from distorting the layout the
              way an unconstrained w-full/h-auto image could. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt}
            loading="lazy"
            className="aspect-video w-full rounded-2xl object-cover ring-1 ring-foreground/10"
          />
          {block.caption ? (
            <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
          ) : null}
        </figure>
      );

    case "VIDEO": {
      // Plays where it is, not on a page the reader has to navigate to
      // (2026-09-19: "we don't want users to go to another page to watch
      // the video"). Three cases, in `resolveVideoEmbed`: a direct media
      // file gets a native <video> (a media element pointed at a URL, not
      // an embed — no third party involved at all); a YouTube or Vimeo URL
      // gets THEIR OWN iframe embed, on the privacy-leaning domain each
      // offers where one exists (`youtube-nocookie.com`) — a deliberate
      // reversal of the "never embed a third party" stance VIDEO/BOOKMARK
      // held before this request, made because playing in place was asked
      // for explicitly and repeatedly; an unrecognised host still falls
      // back to a link card, since embedding an arbitrary page's iframe
      // with no idea what it does is a different risk than a named,
      // deliberately-chosen video host's own embed product.
      const embed = resolveVideoEmbed(block.url);

      if (embed.kind === "file") {
        return (
          <figure className={cn("flex flex-col gap-2", MEDIA_ALIGN_CLASS[block.align])}>
            <video
              src={block.url}
              controls
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-black ring-1 ring-foreground/10"
            />
            {block.caption ? (
              <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
            ) : null}
          </figure>
        );
      }

      if (embed.kind === "youtube" || embed.kind === "vimeo") {
        return (
          <figure className={cn("flex flex-col gap-2", MEDIA_ALIGN_CLASS[block.align])}>
            <iframe
              src={embed.embedUrl}
              title={block.caption ?? "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="aspect-video w-full rounded-2xl bg-black ring-1 ring-foreground/10"
            />
            {block.caption ? (
              <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
            ) : null}
          </figure>
        );
      }

      return (
        <figure className={cn("flex flex-col gap-2", MEDIA_ALIGN_CLASS[block.align])}>
          <a
            href={block.url}
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              ▶
            </span>
            <span className="min-w-0 font-medium">{block.caption ?? block.url}</span>
          </a>
        </figure>
      );
    }

    case "BOOKMARK":
      // Same "link card, never an embed" principle as VIDEO — no fetched
      // third-party preview image either, since that would mean this app
      // calling out to whatever the author linked just to render a page.
      return (
        <a
          href={block.url}
          rel="noopener noreferrer"
          className={cn(
            "flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            MEDIA_ALIGN_CLASS[block.align],
          )}
        >
          <Bookmark className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{block.title}</p>
            {block.description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{block.description}</p>
            ) : null}
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{block.url}</p>
          </div>
        </a>
      );

    case "DIVIDER":
      return (
        <hr
          className={cn(
            DIVIDER_THICKNESS_CLASS[block.thickness],
            DIVIDER_STYLE_CLASS[block.style],
            TOKEN_COLOR_BORDER[block.color],
          )}
        />
      );

    case "COLUMNS":
      return (
        <div className="flex flex-col gap-6 sm:flex-row">
          {block.columns.map((col, i) => (
            <div key={i} className="min-w-0 flex-1" style={{ flexBasis: `${col.width}%` }}>
              <ContentBlocks body={col.blocks} />
            </div>
          ))}
        </div>
      );
  }
}

export function ContentBlocks({ body }: { body: ContentBody }) {
  if (body.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      {body.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
