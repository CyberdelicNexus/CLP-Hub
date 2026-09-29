import { describe, expect, it } from "vitest";
import {
  bodySchema,
  canTransitionContent,
  CONTENT_STATUSES,
  CONTENT_TRANSITIONS,
  isEditable,
  isPublicContentType,
  parseBody,
  publicPathFor,
} from "@/domain/content";
import { inlineToText, isSafeHref, parseInline, parseMarkdown } from "@/domain/markdown";

/**
 * Study content is authored by staff and rendered on PUBLIC pages, so these
 * tests are the safety net for the one thing that must not go wrong: nothing an
 * author writes may become markup or script.
 */
describe("markdown safety", () => {
  it("refuses javascript: and data: links", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeHref("vbscript:msgbox")).toBe(false);
  });

  it("allows the schemes study content actually needs", () => {
    expect(isSafeHref("https://example.org/guia")).toBe(true);
    expect(isSafeHref("http://example.org")).toBe(true);
    expect(isSafeHref("mailto:equipo@example.org")).toBe(true);
    expect(isSafeHref("/estudio/ayuda")).toBe(true);
  });

  it("renders an unsafe link as literal text rather than dropping it", () => {
    // Silently deleting an author's text would be confusing; linking it would
    // be dangerous. Showing it plainly is neither.
    const nodes = parseInline("Pulsa [aquí](javascript:alert(1)) ahora");
    expect(nodes.some((n) => n.kind === "link")).toBe(false);
    expect(inlineToText(nodes)).toContain("javascript:alert(1)");
  });

  it("treats raw HTML as ordinary text", () => {
    const blocks = parseMarkdown("<script>alert(1)</script> y <b>negrita</b>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("paragraph");
    // No node type can produce an element from this — it is all text.
    if (blocks[0].kind === "paragraph") {
      expect(blocks[0].children.every((n) => n.kind === "text")).toBe(true);
      expect(inlineToText(blocks[0].children)).toContain("<script>");
    }
  });

  it("parses the small set of inline marks it supports", () => {
    const nodes = parseInline("Hola **mundo** y *cursiva* con `code`");
    expect(nodes.map((n) => n.kind)).toEqual(["text", "strong", "text", "em", "text", "code"]);
  });

  it("parses paragraphs and both list kinds", () => {
    const blocks = parseMarkdown("Uno\n\n- a\n- b\n\n1. primero\n2. segundo");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "list", "list"]);
    expect(blocks[1].kind === "list" && blocks[1].ordered).toBe(false);
    expect(blocks[2].kind === "list" && blocks[2].ordered).toBe(true);
  });

  it("never throws on odd input", () => {
    for (const input of ["", "**", "[a](", "*".repeat(200), "`unclosed", "- \n- \n"]) {
      expect(() => parseMarkdown(input)).not.toThrow();
    }
  });
});

describe("block validation", () => {
  it("rejects an unknown block type", () => {
    expect(bodySchema.safeParse([{ type: "SCRIPT", md: "x" }]).success).toBe(false);
  });

  it("rejects a block whose url uses an unsafe scheme", () => {
    expect(
      bodySchema.safeParse([{ type: "BUTTON", label: "Ir", url: "javascript:alert(1)" }]).success,
    ).toBe(false);
  });

  it("requires alt text on images", () => {
    expect(bodySchema.safeParse([{ type: "IMAGE", url: "https://e.org/a.png" }]).success).toBe(false);
    expect(
      bodySchema.safeParse([{ type: "IMAGE", url: "https://e.org/a.png", alt: "Casco" }]).success,
    ).toBe(true);
  });

  it("accepts all twelve block types", () => {
    const body = [
      { type: "TEXT", md: "Hola" },
      { type: "VIDEO", url: "https://e.org/v" },
      { type: "IMAGE", url: "https://e.org/a.png", alt: "a" },
      { type: "BOOKMARK", url: "https://e.org", title: "Recurso" },
      { type: "CHECKLIST", items: ["uno"] },
      { type: "CALLOUT", tone: "INFO", md: "ojo" },
      { type: "CONTEMPLATION", md: "respira" },
      { type: "BUTTON", label: "Ir", url: "https://e.org" },
      { type: "TECHNICAL_STEP", step: 1, title: "Enciende", md: "pulsa" },
      { type: "SUPPORT_BOX", md: "escríbenos" },
      { type: "DIVIDER" },
      {
        type: "COLUMNS",
        columns: [
          { width: 50, blocks: [{ type: "TEXT", md: "izquierda" }] },
          { width: 50, blocks: [{ type: "TEXT", md: "derecha" }] },
        ],
      },
    ];
    const parsed = bodySchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toHaveLength(12);
  });

  it("a text-bearing block accepts legacy md, new content, or both", () => {
    expect(bodySchema.safeParse([{ type: "TEXT", md: "legacy" }]).success).toBe(true);
    expect(
      bodySchema.safeParse([
        { type: "TEXT", content: { type: "doc", content: [{ type: "paragraph" }] } },
      ]).success,
    ).toBe(true);
    // Neither is also accepted (parseBody's silent-drop-on-invalid means an
    // extra "must have exactly one" refine would be one more way to lose a
    // real block to a subtle bug for a property nothing downstream needs —
    // see docs/decisions.md's lote-4 entry).
    expect(bodySchema.safeParse([{ type: "TEXT" }]).success).toBe(true);
  });

  it("rejects a COLUMNS block nested inside another COLUMNS block", () => {
    const nested = {
      type: "COLUMNS",
      columns: [
        {
          width: 50,
          blocks: [
            {
              type: "COLUMNS",
              columns: [
                { width: 50, blocks: [] },
                { width: 50, blocks: [] },
              ],
            },
          ],
        },
        { width: 50, blocks: [] },
      ],
    };
    expect(bodySchema.safeParse([nested]).success).toBe(false);
  });

  it("drops malformed blocks on read instead of taking a page down", () => {
    // A row hand-edited in the database must not break the public page.
    const { blocks, dropped } = parseBody([
      { type: "TEXT", md: "bien" },
      { type: "NONSENSE" },
      { type: "BUTTON", label: "Ir", url: "javascript:alert(1)" },
    ]);
    expect(blocks).toHaveLength(1);
    expect(dropped).toBe(2);
  });

  it("returns nothing for a body that is not an array", () => {
    expect(parseBody(null).blocks).toEqual([]);
    expect(parseBody({ type: "TEXT" }).blocks).toEqual([]);
  });
});

describe("publishing workflow", () => {
  it("makes published and archived terminal", () => {
    expect(CONTENT_TRANSITIONS.PUBLISHED).toEqual([]);
    expect(CONTENT_TRANSITIONS.ARCHIVED).toEqual([]);
  });

  it("never lets a published version be edited or reopened", () => {
    expect(isEditable("PUBLISHED")).toBe(false);
    expect(isEditable("ARCHIVED")).toBe(false);
    for (const to of CONTENT_STATUSES) {
      expect(canTransitionContent("PUBLISHED", to)).toBe(false);
    }
  });

  it("allows drafting and review round-trips before publication", () => {
    expect(canTransitionContent("DRAFT", "REVIEW")).toBe(true);
    expect(canTransitionContent("REVIEW", "DRAFT")).toBe(true);
    expect(canTransitionContent("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionContent("REVIEW", "PUBLISHED")).toBe(true);
  });
});

describe("public routing", () => {
  it("never exposes message templates as web pages", () => {
    for (const type of ["EMAIL_TEMPLATE", "WHATSAPP_TEMPLATE"] as const) {
      expect(isPublicContentType(type)).toBe(false);
      expect(publicPathFor({ type, key: "algo", sessionCode: null })).toBeNull();
    }
  });

  it("builds the documented paths", () => {
    expect(publicPathFor({ type: "VR_GUIDE", key: "preparacion-vr", sessionCode: null })).toBe(
      "/estudio/preparacion-vr",
    );
    expect(
      publicPathFor({ type: "SESSION_PREPARATION", key: "s1-prep", sessionCode: "demo_intro" }),
    ).toBe("/estudio/sesiones/demo_intro/preparacion");
    expect(
      publicPathFor({ type: "SESSION_INTEGRATION", key: "s1-int", sessionCode: "demo_intro" }),
    ).toBe("/estudio/sesiones/demo_intro/integracion");
  });

  it("has no path for session content with no session", () => {
    expect(
      publicPathFor({ type: "SESSION_PREPARATION", key: "x", sessionCode: null }),
    ).toBeNull();
  });
});
