import { describe, expect, it } from "vitest";
import { markdownAstToRichTextDoc, richTextDocSchema } from "@/domain/rich-text";

/**
 * The rich-text schema is the same "closed, server-validated JSON" posture
 * `domain/markdown.ts` already used, now for a tree instead of a flat
 * string — these tests assert the closedness held. The migration-converter
 * tests exist because docs/decisions.md's lote-4 entry leans on the
 * "mechanical and lossless" claim to justify NOT running a one-shot database
 * rewrite; that claim needs to be asserted, not just believed.
 */
describe("rich text schema", () => {
  it("accepts a well-formed doc with every allowed node and mark", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "normal " },
            { type: "text", text: "negrita", marks: [{ type: "bold" }] },
            { type: "text", text: " enlace", marks: [{ type: "link", attrs: { href: "https://example.org" } }] },
            { type: "text", text: " color", marks: [{ type: "textColor", attrs: { token: "chart-2" } }] },
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }] }],
        },
      ],
    };
    expect(richTextDocSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects a node type outside the allowlist", () => {
    const doc = { type: "doc", content: [{ type: "image", attrs: { src: "https://e.org/a.png" } }] };
    expect(richTextDocSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a heading level outside 1-4", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 5 }, content: [] }] };
    expect(richTextDocSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a link mark with an unsafe scheme, same rule as legacy Markdown", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ],
    };
    expect(richTextDocSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a text color token outside the closed palette", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textColor", attrs: { token: "hotpink" } }] }] },
      ],
    };
    expect(richTextDocSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a list item with more than one paragraph (no nested block content)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "a" }] },
                { type: "paragraph", content: [{ type: "text", text: "b" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(richTextDocSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an oversized doc rather than let it through unbounded", () => {
    const hugeText = "x".repeat(2500); // over the per-node cap
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: hugeText }] }] };
    expect(richTextDocSchema.safeParse(doc).success).toBe(false);
  });
});

describe("legacy Markdown -> rich text migration", () => {
  it("converts bold, italic, code and a link into marks on flattened text leaves", () => {
    const doc = markdownAstToRichTextDoc("Hola **mundo** y *cursiva* con `code` y [enlace](https://e.org)");
    expect(richTextDocSchema.safeParse(doc).success).toBe(true);

    const paragraph = doc.content[0];
    if (paragraph.type !== "paragraph") throw new Error("expected paragraph");
    const marksByText = new Map((paragraph.content ?? []).filter((n) => n.type === "text").map((n) => [n.text, n.marks ?? []]));

    expect(marksByText.get("mundo")?.map((m) => m.type)).toEqual(["bold"]);
    expect(marksByText.get("cursiva")?.map((m) => m.type)).toEqual(["italic"]);
    expect(marksByText.get("code")?.map((m) => m.type)).toEqual(["code"]);
    const link = marksByText.get("enlace")?.[0];
    expect(link?.type).toBe("link");
    expect(link?.type === "link" && link.attrs.href).toBe("https://e.org");
  });

  it("converts both list kinds into bulletList/orderedList with one paragraph per item", () => {
    const doc = markdownAstToRichTextDoc("- uno\n- dos\n\n1. primero\n2. segundo");
    expect(richTextDocSchema.safeParse(doc).success).toBe(true);
    expect(doc.content.map((n) => n.type)).toEqual(["bulletList", "orderedList"]);

    const bullets = doc.content[0];
    if (bullets.type !== "bulletList") throw new Error("expected bulletList");
    expect(bullets.content).toHaveLength(2);
    expect(bullets.content[0].content[0].content?.[0]).toMatchObject({ type: "text", text: "uno" });
  });

  it("drops an unsafe-scheme link's mark but keeps the literal text, same as the legacy renderer", () => {
    const doc = markdownAstToRichTextDoc("Pulsa [aquí](javascript:alert(1)) ahora");
    expect(richTextDocSchema.safeParse(doc).success).toBe(true);
    const paragraph = doc.content[0];
    if (paragraph.type !== "paragraph") throw new Error("expected paragraph");
    const hasLinkMark = (paragraph.content ?? []).some((n) => n.type === "text" && n.marks?.some((m) => m.type === "link"));
    expect(hasLinkMark).toBe(false);
  });

  it("never throws and always produces a schema-valid doc, even for odd input", () => {
    for (const input of ["", "**", "[a](", "*".repeat(200), "`unclosed", "- \n- \n"]) {
      const doc = markdownAstToRichTextDoc(input);
      expect(richTextDocSchema.safeParse(doc).success).toBe(true);
    }
  });
});
