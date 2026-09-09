/**
 * A deliberately tiny Markdown subset (Phase 5).
 *
 * This exists because study content is authored by staff and rendered on PUBLIC
 * pages. Rather than parse Markdown to an HTML string and then try to sanitise
 * it, this produces a typed token tree that the renderer turns into React
 * elements. No HTML string is ever produced, so `dangerouslySetInnerHTML` is
 * never needed and there is no sanitiser to get wrong.
 *
 * Supported, and nothing else:
 *   **bold**  *italic*  `code`  [text](https://…)
 *   paragraphs (blank-line separated), "- " bullet lists, "1. " ordered lists
 *
 * Anything else — raw HTML, images, headings, tables — is left as literal text.
 * That is the point: an author cannot smuggle markup through this.
 */

export type Inline =
  | { kind: "text"; value: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

/**
 * Schemes a link may use. `javascript:` and `data:` are absent on purpose —
 * they are the two that turn a link into script execution.
 */
const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  // Relative links stay inside the site and cannot carry a scheme.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    return SAFE_SCHEMES.includes(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

/** Matches, in precedence order: code, bold, italic, link. */
const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/;

export function parseInline(input: string): Inline[] {
  const out: Inline[] = [];
  let rest = input;

  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match || match.index === undefined) {
      out.push({ kind: "text", value: rest });
      break;
    }

    if (match.index > 0) {
      out.push({ kind: "text", value: rest.slice(0, match.index) });
    }

    const token = match[0];

    if (token.startsWith("`")) {
      out.push({ kind: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("**")) {
      out.push({ kind: "strong", children: parseInline(token.slice(2, -2)) });
    } else if (token.startsWith("*")) {
      out.push({ kind: "em", children: parseInline(token.slice(1, -1)) });
    } else {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      if (isSafeHref(href)) {
        out.push({ kind: "link", href: href.trim(), children: parseInline(label) });
      } else {
        // An unsafe scheme is not an error and not silently dropped: the reader
        // sees the literal text the author wrote, and nothing is linked.
        out.push({ kind: "text", value: token });
      }
    }

    rest = rest.slice(match.index + token.length);
  }

  return out.filter((n) => n.kind !== "text" || n.value.length > 0);
}

const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;

export function parseMarkdown(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", children: parseInline(paragraph.join(" ").trim()) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((i) => parseInline(i)),
    });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);

    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const text = (bullet?.[1] ?? ordered?.[1] ?? "").trim();
      if (list && list.ordered !== isOrdered) flushList();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push(text);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** Plain text of a parsed tree, for previews and excerpt generation. */
export function inlineToText(nodes: readonly Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case "text":
          return n.value;
        case "code":
          return n.value;
        default:
          return inlineToText(n.children);
      }
    })
    .join("");
}

export function markdownToText(input: string): string {
  return parseMarkdown(input)
    .map((b) =>
      b.kind === "paragraph" ? inlineToText(b.children) : b.items.map(inlineToText).join(" · "),
    )
    .join(" ");
}
