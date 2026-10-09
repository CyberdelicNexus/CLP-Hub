import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { HOME_COPY, HOME_PAPERS, HOME_SITES } from "@/content/home";
import { PUBLIC_LOCALES } from "@/domain/locale";
import { HOME_RETURN, PUBLIC_BASE_PATH } from "@/domain/navigation";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the numadelic.org home page (D-105)", () => {
  it("says the same things in every language, with four breath phases", () => {
    const shape = (v: unknown): unknown =>
      v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    for (const locale of PUBLIC_LOCALES) {
      expect(shape(HOME_COPY[locale]), locale).toEqual(shape(HOME_COPY.es));
      expect(HOME_COPY[locale].breath.phases, locale).toHaveLength(4);
      expect(HOME_COPY[locale].definition.origin, locale).toMatch(/numen.*delos/);
    }
    expect(HOME_COPY.en.title).toBe("Making the invisible visible");
  });

  it("lists every paper once, newest first, each with a secure link", () => {
    expect(new Set(HOME_PAPERS.map((p) => p.href)).size).toBe(HOME_PAPERS.length);
    for (const p of HOME_PAPERS) expect(p.href).toMatch(/^https:\/\//);
    const years = HOME_PAPERS.map((p) => p.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    // Every paper has a drawn thumbnail, and no two share one.
    const css = read("src/components/landing/landing.css") + read("src/components/landing/home.css");
    expect(new Set(HOME_PAPERS.map((p) => p.art)).size).toBe(HOME_PAPERS.length);
    for (const p of HOME_PAPERS) expect(css).toContain(`.research__thumbnail--${p.art} `);
    for (const s of HOME_SITES) expect(s.href).toMatch(/^https:\/\//);
  });

  it("offers Clear Light and the two sites, and opens the outside links safely", () => {
    const page = read("src/app/(public)/page.tsx");
    expect(page).toMatch(/href=\{PUBLIC_BASE_PATH\} className="cl-btn"/);
    expect(page.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(page.match(/target="_blank"/g)).toHaveLength(2);
    expect(PUBLIC_BASE_PATH).toBe("/clearlight");
  });

  it("keeps the breath in step and stoppable", () => {
    const css = read("src/components/landing/home.css");
    // One cycle of four equal phases drives the light, its glow and the words.
    expect(css).toMatch(/--breath-cycle: calc\(var\(--breath-phase\) \* 4\)/);
    expect(css.match(/var\(--breath-cycle\)/g)!.length).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/\.home\[data-still\][^{]*\{ animation-play-state: paused; \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("returns the language switch to the home page, not to Clear Light", async () => {
    const { GET } = await import("@/app/(public)/clearlight/idioma/[locale]/route");
    const res = await GET(new NextRequest(`https://example.org/clearlight/idioma/en?desde=${HOME_RETURN}`), {
      params: Promise.resolve({ locale: "en" }),
    });
    expect(res.headers.get("location")).toBe("https://example.org/");
  });
});
