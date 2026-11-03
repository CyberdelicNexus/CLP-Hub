import { describe, expect, it } from "vitest";
import { bodySchema } from "@/domain/content";
import { SESSION_PAGES } from "../scripts/session-materials/pages";
import { BLOCK_SWAPS, CONTACT_PAIRS, FIELD_SWAPS, REVISION_PAIRS } from "../scripts/session-materials/revision-2026-11-03";
import { bodyStrings, revisePage } from "../scripts/session-materials/revise";
import { galicianTranslator, loadGalicianTable } from "../scripts/session-materials/galician";

const pageStrings = (key: string) => {
  const page = SESSION_PAGES.find((p) => `${p.sessionCode}-${p.part}` === key);
  if (!page) throw new Error(key);
  return new Set(bodyStrings(bodySchema.parse(page.body)));
};

describe("2026-11-03 session page revision (D-136)", () => {
  it("pages.ts carries every new string and none of the old ones", () => {
    for (const [key, pairs] of Object.entries(REVISION_PAIRS)) {
      const strings = pageStrings(key);
      for (const [before, after] of pairs) {
        expect(strings.has(after), `${key}: ${after}`).toBe(true);
        expect(strings.has(before), `${key}: ${before}`).toBe(false);
      }
    }
  });

  it("every page's contact box in pages.ts has the WhatsApp line and button (D-137)", () => {
    for (const p of SESSION_PAGES) {
      const strings = pageStrings(`${p.sessionCode}-${p.part}`);
      for (const [before, after] of CONTACT_PAIRS) {
        expect(strings.has(after)).toBe(true);
        expect(strings.has(before)).toBe(false);
      }
      const urls = p.body.flatMap((b) => (b.type === "SUPPORT_BOX" ? [b.contactUrl] : []));
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(url).toBe(FIELD_SWAPS[0].after);
    }
  });

  it("every block swap has its replacement in pages.ts", () => {
    for (const swap of BLOCK_SWAPS) {
      const page = SESSION_PAGES.find((p) => `${p.sessionCode}-${p.part}` === swap.key)!;
      const match = page.body.filter((b) => "title" in b && b.title === swap.title && b.type !== swap.type);
      expect(match).toHaveLength(1);
    }
  });

  it("the Galician table covers every page string and every old and new string", () => {
    const gl = galicianTranslator(loadGalicianTable());
    for (const p of SESSION_PAGES) {
      gl.tr(p.title);
      gl.walk(bodySchema.parse(p.body));
    }
    for (const pairs of [...Object.values(REVISION_PAIRS), CONTACT_PAIRS]) for (const [a, b] of pairs) {
      gl.tr(a);
      gl.tr(b);
    }
    expect([...gl.missing]).toEqual([]);
  });
});

describe("revisePage", () => {
  const para = (text: string) => ({
    type: "TEXT",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  });

  it("swaps listed strings and leaves the rest alone", () => {
    const out = revisePage([para("Hola."), para("Old line.")], [["Old line.", "New line."]]);
    expect(out.applied).toBe(1);
    expect(out.notFound).toEqual([]);
    expect(bodyStrings(out.body)).toEqual(["Hola.", "New line."]);
  });

  it("counts a swap already in place and reports a missing one", () => {
    const out = revisePage([para("New line.")], [
      ["Old line.", "New line."],
      ["Edited in the Hub.", "Whatever."],
    ]);
    expect(out.applied).toBe(0);
    expect(out.alreadyDone).toBe(1);
    expect(out.notFound).toEqual(["Edited in the Hub."]);
  });

  it("replaces a whole block, once", () => {
    const callout = { type: "CALLOUT", title: "Nota" };
    const box = { type: "SUPPORT_BOX", title: "Nota" };
    const swap = { label: "Nota", match: (b: Record<string, unknown>) => b.type === "CALLOUT", replacement: box };
    const first = revisePage([para("a"), callout], [], [swap]);
    expect(first.body).toEqual([para("a"), box]);
    const again = revisePage(first.body, [], [swap]);
    expect(again.applied).toBe(0);
    expect(again.alreadyDone).toBe(1);
  });
  it("swaps a non-text field such as a contact link", () => {
    const box = { type: "SUPPORT_BOX", contactUrl: "mailto:a@b.c" };
    const swap = { field: "contactUrl", before: "mailto:a@b.c", after: "https://wa.me/1" };
    const out = revisePage([box], [], [], [swap]);
    expect(out.body).toEqual([{ type: "SUPPORT_BOX", contactUrl: "https://wa.me/1" }]);
    expect(revisePage(out.body, [], [], [swap]).alreadyDone).toBe(1);
    expect(revisePage([{ type: "X" }], [], [], [swap]).notFound).toEqual(["[contactUrl] mailto:a@b.c"]);
  });
});
