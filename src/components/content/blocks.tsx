import { Fragment } from "react";
import { CircleCheck, CircleHelp, Info, LifeBuoy, TriangleAlert } from "lucide-react";
import type { ContentBlock, ContentBody } from "@/domain/content";
import { parseMarkdown, type Inline } from "@/domain/markdown";
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

const CALLOUT_STYLES = {
  INFO: { surface: "bg-surface-sky text-surface-sky-ink", Icon: Info },
  WARNING: { surface: "bg-surface-peach text-surface-peach-ink", Icon: TriangleAlert },
  SUPPORT: { surface: "bg-surface-mint text-surface-mint-ink", Icon: LifeBuoy },
} as const;

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "TEXT":
      return <Markdown md={block.md} />;

    case "CALLOUT": {
      const { surface, Icon } = CALLOUT_STYLES[block.tone];
      return (
        <aside className={cn("flex gap-3 rounded-2xl p-5", surface)}>
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            {block.title ? <p className="font-semibold">{block.title}</p> : null}
            <Markdown md={block.md} className="mt-1" />
          </div>
        </aside>
      );
    }

    case "CONTEMPLATION":
      // Set apart typographically rather than boxed: this is an invitation to
      // pause, and a bordered card would read as an alert.
      return (
        <blockquote className="border-l-2 border-chart-1 py-1 pl-5 text-lg leading-relaxed text-pretty italic">
          <Markdown md={block.md} />
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
                <span className="leading-relaxed">{item}</span>
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
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {block.step}
          </span>
          <div className="min-w-0 pt-1">
            <p className="font-semibold">
              <span className="sr-only">Paso {block.step}: </span>
              {block.title}
            </p>
            <Markdown md={block.md} className="mt-1.5" />
          </div>
        </div>
      );

    case "SUPPORT_BOX":
      return (
        <aside className="rounded-2xl bg-surface-lilac p-5 text-surface-lilac-ink">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              {block.title ? <p className="font-semibold">{block.title}</p> : null}
              <Markdown md={block.md} className="mt-1" />
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
        <div>
          <a
            href={block.url}
            rel="noopener noreferrer"
            className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {block.label}
          </a>
        </div>
      );

    case "IMAGE":
      return (
        <figure className="flex flex-col gap-2">
          {/* Plain <img>: content images are author-supplied external URLs, which
              next/image would need configured hosts for. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt}
            loading="lazy"
            className="w-full rounded-2xl ring-1 ring-foreground/10"
          />
          {block.caption ? (
            <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
          ) : null}
        </figure>
      );

    case "VIDEO":
      // Linked rather than embedded: an iframe would hand a third party a frame
      // on a participant-facing page, and the study does not need that.
      return (
        <figure className="flex flex-col gap-2">
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
