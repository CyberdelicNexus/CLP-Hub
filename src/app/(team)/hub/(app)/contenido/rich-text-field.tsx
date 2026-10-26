"use client";

import { useState } from "react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold as BoldIcon,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic as ItalicIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Underline as UnderlineIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSafeHref } from "@/domain/markdown";
import { HEADING_LEVELS, TEXT_COLOR_TOKENS, type RichTextDoc, type TextColorToken } from "@/domain/rich-text";

/**
 * A closed-palette text color mark — deliberately NOT `@tiptap/extension-color`
 * (which stores arbitrary hex/CSS via TextStyle, exactly the free color
 * picker this app avoids everywhere else, `domain/content.ts`'s `TOKEN_COLORS`
 * included). `token` is restricted to `TEXT_COLOR_TOKENS`, rendered to a
 * fixed class (never inline `style=`) via `TEXT_COLOR_CLASS` below — written
 * as literal strings, not template-interpolated, so Tailwind's build-time
 * scanner can actually see and generate them.
 */
const TEXT_COLOR_CLASS: Record<TextColorToken, string> = {
  "chart-1": "text-chart-1",
  "chart-2": "text-chart-2",
  "chart-3": "text-chart-3",
  "chart-4": "text-chart-4",
  "chart-5": "text-chart-5",
};
/** Swatch fill, same tokens — used only by this file's own toolbar buttons. */
const SWATCH_BG_CLASS: Record<TextColorToken, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (token: TextColorToken) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-color-token"),
        renderHTML: (attrs: { token?: TextColorToken | null }) => {
          const token = attrs.token;
          if (!token || !(token in TEXT_COLOR_CLASS)) return {};
          return { "data-color-token": token, class: TEXT_COLOR_CLASS[token] };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-color-token]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTextColor:
        (token: TextColorToken) =>
        ({ commands }) =>
          commands.setMark(this.name, { token }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

const HEADING_ICON = { 1: Heading1, 2: Heading2, 3: Heading3, 4: Heading4 } as const;

/**
 * Mirrors the exact classes `components/content/blocks.tsx`'s `RichTextBlock`/
 * `RichTextInline` apply to the same elements on the public page (2026-09-29
 * request: "so you don't have to guess or publish to see how it looks") —
 * targets the real `<h1>`/`<p>`/`<ul>`/`<code>`/etc. tags Tiptap renders into
 * the contentEditable root via Tailwind's descendant-selector variants,
 * since nothing wraps each node individually here the way `RichText` does
 * with its own per-block JSX. `[&>*+*]:mt-3` stands in for that component's
 * `flex flex-col gap-3` — a plain contentEditable can't be a flex container
 * of independently-keyed children, so margin is the equivalent here. The
 * `textColor` mark needs no entry: it renders its own literal class
 * (`text-chart-*`) directly via its `renderHTML`, already identical to the
 * public renderer's.
 */
const PUBLISHED_LOOK_CLASS = [
  "[&>*+*]:mt-3",
  "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-balance",
  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-balance",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-balance",
  "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:tracking-tight [&_h4]:text-balance",
  "[&_p]:leading-relaxed",
  "[&_ul]:ml-5 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5",
  "[&_ol]:ml-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5",
  "[&_li]:leading-relaxed",
  "[&_strong]:font-semibold",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_a]:underline [&_a]:underline-offset-4",
].join(" ");

export interface RichTextFieldLabels {
  paragraph: string;
  heading: string;
  bold: string;
  italic: string;
  underline: string;
  code: string;
  link: string;
  removeLink: string;
  bulletList: string;
  orderedList: string;
  linkUrl: string;
  linkApply: string;
  linkCancel: string;
  color: string;
  removeColor: string;
}

function extensions() {
  return [
    StarterKit.configure({
      // Every sub-extension named explicitly (never relying on StarterKit's
      // own default set) so this allowlist stays reviewable and immune to
      // what a future StarterKit major bundles by default — see
      // docs/decisions.md's lote-4 entry.
      heading: { levels: [...HEADING_LEVELS] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        // Reuse the exact scheme allowlist the legacy Markdown links already
        // used — one validator, not two.
        validate: isSafeHref,
      },
      underline: {},
      // Explicitly OFF: not on the allowlist. A divider is its own block
      // type (lote 3), not a `---` shortcut inside rich text; images have
      // their own IMAGE block with a real upload/validation path; blockquote
      // is CONTEMPLATION's job; code blocks and strikethrough were never
      // requested.
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
    }),
    TextColorMark,
  ];
}

/**
 * A bubble menu that only appears while text is selected (2026-09-29
 * founder feedback: a toolbar visible above every single block, all the
 * time, made a page with several TECHNICAL_STEP/TEXT blocks look cluttered
 * — a genuine "context menu on selection" was the actual ask, not a
 * permanently-docked one). Tradeoff accepted deliberately: switching a
 * paragraph to a heading now needs a text selection first (nothing to put
 * the cursor in and hit "H2" without selecting), which the original
 * fixed-toolbar design avoided — but the visual-noise problem was the more
 * pressing one in practice. `@tiptap/react/menus`' `BubbleMenu` defaults to
 * showing only when the editor is focused AND the selection is non-empty,
 * which is exactly "select text, get a menu."
 */
function Toolbar({ editor, labels }: { editor: Editor; labels: RichTextFieldLabels }) {
  const [linkPrompt, setLinkPrompt] = useState<string | null>(null);

  function toggleLinkPrompt() {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    setLinkPrompt(editor.getAttributes("link").href ?? "");
  }

  function applyLink() {
    if (linkPrompt && isSafeHref(linkPrompt)) {
      editor.chain().focus().setLink({ href: linkPrompt }).run();
    }
    setLinkPrompt(null);
  }

  return (
    <BubbleMenu
      editor={editor}
      // w-max + a generous max-width: everything fits on one row at the
      // widths this toolbar actually needs (~30rem); flex-wrap stays only
      // as a narrow-viewport safety net and so the link-URL row (its own
      // basis-full div, appearing conditionally) still drops to its own line
      // on purpose rather than squeezing into the same row as the buttons.
      className="flex w-max max-w-[min(92vw,36rem)] flex-wrap items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lift"
    >
      {HEADING_LEVELS.map((level) => {
        const Icon = HEADING_ICON[level];
        return (
          <ToolbarButton
            key={level}
            label={`${labels.heading} ${level}`}
            active={editor.isActive("heading", { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <Icon className="size-3.5" aria-hidden />
          </ToolbarButton>
        );
      })}
      <ToolbarButton
        label={labels.paragraph}
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="size-3.5" aria-hidden />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label={labels.bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="size-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={labels.italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="size-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={labels.underline}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={labels.code}
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon className="size-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={labels.link} active={editor.isActive("link")} onClick={toggleLinkPrompt}>
        <LinkIcon className="size-3.5" aria-hidden />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label={labels.bulletList}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={labels.orderedList}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" aria-hidden />
      </ToolbarButton>

      <Divider />

      {TEXT_COLOR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          title={labels.color}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextColor(token).run()}
          className={cn(
            "size-4 shrink-0 rounded-full ring-1 ring-inset ring-foreground/15",
            SWATCH_BG_CLASS[token],
            editor.isActive("textColor", { token }) && "ring-2 ring-foreground/60",
          )}
        />
      ))}
      <button
        type="button"
        title={labels.removeColor}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().unsetTextColor().run()}
        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>

      {linkPrompt !== null ? (
        <div className="mt-1 flex w-full items-center gap-1.5 basis-full">
          <input
            autoFocus
            value={linkPrompt}
            onChange={(e) => setLinkPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkPrompt(null);
            }}
            placeholder={labels.linkUrl}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs outline-none"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
          >
            {labels.linkApply}
          </button>
          <button
            type="button"
            onClick={() => setLinkPrompt(null)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {labels.linkCancel}
          </button>
        </div>
      ) : null}
    </BubbleMenu>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * A Tiptap-backed rich text editing surface for one block's body text
 * (TEXT/CALLOUT/CONTEMPLATION/TECHNICAL_STEP/SUPPORT_BOX), replacing the old
 * plain-textarea `AutoTextarea`. Client-only (Tiptap/ProseMirror is a DOM
 * library); this file and its importers are all under the already-
 * `"use client"` staff editor route, never imported by the public renderer.
 *
 * `value` seeds the editor once at creation — Tiptap is not a controlled
 * `<input value>`-style component, and re-applying external content on every
 * keystroke would fight the user's own cursor. Each block already has a
 * stable React key at the parent (`BlockEditor`'s `ids[i]`), so one editor
 * instance per block for its whole lifetime is the right model, same as the
 * old `AutoTextarea` (also effectively one instance per block).
 */
export function RichTextField({
  value,
  onChange,
  placeholder,
  className,
  labels,
}: {
  value: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  placeholder: string;
  className?: string;
  labels: RichTextFieldLabels;
}) {
  const editor = useEditor({
    extensions: extensions(),
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichTextDoc),
    // No placeholder text: Tiptap needs a dedicated extension for that (an
    // empty <p>'s :before can't read an attribute off an ancestor node), and
    // it's a nice-to-have, not essential — skipped rather than shipped half
    // right. aria-label carries the same hint for screen readers instead.
    editorProps: {
      attributes: { class: cn("outline-none", PUBLISHED_LOOK_CLASS, className), "aria-label": placeholder },
    },
  });

  if (!editor) return null;

  return (
    // min-w-0/flex-1 are inert outside a flex parent (e.g. this field's most
    // common use, its own line) and only matter where a caller places it
    // beside something else in a row (e.g. a CALLOUT title next to its tone
    // swatches) — one wrapper class list serves both without a second prop.
    <div className="min-w-0 flex-1">
      <Toolbar editor={editor} labels={labels} />
      <EditorContent editor={editor} />
    </div>
  );
}
