import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { HOME_COPY, HOME_FILM, HOME_PAPERS, HOME_PRESS, HOME_PRESS_LOGOS, HOME_SITES } from "@/content/home";
import { PUBLIC_LOCALES } from "@/domain/locale";
import { HOME_RETURN, PUBLIC_BASE_PATH } from "@/domain/navigation";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the numadelic.org home page (D-105)", () => {
  it("says the same things in every language", () => {
    const shape = (v: unknown): unknown =>
      v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    for (const locale of PUBLIC_LOCALES) {
      expect(shape(HOME_COPY[locale]), locale).toEqual(shape(HOME_COPY.es));
      expect(HOME_COPY[locale].definition.origin, locale).toMatch(/numen.*delos/);
    }
    expect(HOME_COPY.en.title).toBe("Making the invisible visible");
    expect(HOME_COPY.en.clearLight).toBe("Clear Light Research Study");
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
    // The two sites, the paper cards and the press cards.
    expect(page.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(3);
    expect(page.match(/target="_blank"/g)).toHaveLength(3);
    expect(PUBLIC_BASE_PATH).toBe("/clearlight");
  });

  it("keeps the breath in step and stoppable", () => {
    const css = read("src/components/landing/home.css");
    // One cycle drives the light and its glow: four seconds in, one held, four out, one held (D-108).
    expect(css).toMatch(/--breath-move: 4s;\s+--breath-hold: 1s;/);
    expect(css).toMatch(/--breath-cycle: calc\(\(var\(--breath-move\) \+ var\(--breath-hold\)\) \* 2\)/);
    expect(css.match(/var\(--breath-cycle\)/g)!.length).toBeGreaterThanOrEqual(2);
    for (const name of ["breath-halo", "breath-orb"]) {
      const frames = css.slice(css.indexOf(`@keyframes ${name}`)).split("\n}")[0];
      expect(frames.match(/^\s+[\d%, ]+(?= \{)/gm)!.map((s) => s.trim()), name).toEqual(["0%", "40%", "50%", "90%, 100%"]);
    }
    // No breathing instruction: the light is the whole of it.
    expect(css).not.toMatch(/breath__phase/);
    expect(read("src/app/(public)/page.tsx")).not.toMatch(/breath__phase|copy\.breath/);
    expect(css).toMatch(/\.home\[data-still\][^{]*\{ animation-play-state: paused; \}/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("shows the film between the hero and the research, through the consent-gated player (D-109)", () => {
    const page = read("src/app/(public)/page.tsx");
    const at = (s: string) => page.indexOf(s);
    expect(at('className="home__hero"')).toBeGreaterThan(-1);
    expect(at('className="home__film"')).toBeGreaterThan(at('className="home__hero"'));
    expect(at('className="home__research"')).toBeGreaterThan(at('className="home__film"'));
    expect(page).toMatch(/<FilmPlayer\s+youtubeId=\{HOME_FILM\.youtubeId\}/);
    expect(HOME_FILM.youtubeId).toBe("r6_VOOe8SMg");
    // The thumbnail is a file of this site's (D-110).
    expect(HOME_FILM.poster.startsWith("/landing/media/")).toBe(true);
    expect(existsSync(join(process.cwd(), "public", HOME_FILM.poster))).toBe(true);
    // No iframe of the page's own, and no thumbnail fetched from YouTube before the click.
    expect(page + read("src/content/home.ts") + read("src/components/landing/home.css")).not.toMatch(/<iframe|ytimg|youtube\.com\/embed/);
  });

  it("lists the press once each, newest first apart from the pinned EL PAÍS, under the research (D-110, D-122)", () => {
    expect(new Set(HOME_PRESS.map((p) => p.href)).size).toBe(HOME_PRESS.length);
    for (const p of HOME_PRESS) {
      expect(p.href.startsWith("https://"), p.title).toBe(true);
      // A piece, never an outlet's front page or an archive listing.
      expect(new URL(p.href).pathname.length, p.title).toBeGreaterThan(1);
      expect(p.href, p.title).not.toMatch(/[/]archive[/]?$|[/]author[/]/);
      if (p.date) expect(p.date, p.title).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
    }
    // Every card has its outlet's logo, a file of this site's (D-111).
    for (const p of HOME_PRESS) expect(existsSync(join(process.cwd(), "public", HOME_PRESS_LOGOS[p.logo].src)), p.outlet).toBe(true);
    expect(new Set(HOME_PRESS.map((p) => p.logo)).size).toBe(Object.keys(HOME_PRESS_LOGOS).length);
    // D-122: the Spanish EL PAÍS interview is pinned second, out of date order.
    expect(HOME_PRESS[1].outlet).toBe("EL PAÍS");
    const dates = HOME_PRESS.filter((_, i) => i !== 1).flatMap((p) => (p.date ? [p.date] : []));
    expect(dates).toEqual([...dates].sort().reverse());
    for (const locale of PUBLIC_LOCALES) {
      for (const kind of new Set(HOME_PRESS.map((p) => p.kind))) expect(HOME_COPY[locale].press[kind], locale).toBeTruthy();
    }
    const page = read("src/app/(public)/page.tsx");
    expect(page.indexOf("home-press-title")).toBeGreaterThan(page.indexOf("home-research-title"));
  });

  it("returns the language switch to the home page, not to Clear Light", async () => {
    const { GET } = await import("@/app/(public)/clearlight/idioma/[locale]/route");
    const res = await GET(new NextRequest(`https://example.org/clearlight/idioma/en?desde=${HOME_RETURN}`), {
      params: Promise.resolve({ locale: "en" }),
    });
    expect(res.headers.get("location")).toBe("https://example.org/");
  });
});
