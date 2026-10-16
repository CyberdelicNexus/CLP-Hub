import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { MEDITATE_COPY } from "@/content/meditate";
import {
  breathLevel,
  cycleLength,
  DEFAULT_SETTINGS,
  parseSettings,
  PATTERN_PRESETS,
  phaseAt,
  presetOf,
  toSearch,
  type MeditateSettings,
} from "@/domain/breathing";
import { PUBLIC_LOCALES } from "@/domain/locale";
import { MEDITATE_PATH, MEDITATE_RETURN } from "@/domain/navigation";
import { GET as switchLanguage } from "@/app/(public)/clearlight/idioma/[locale]/route";

describe("the breathing guide (D-120)", () => {
  it("walks through a breath in order and skips a hold of zero", () => {
    const calm = PATTERN_PRESETS.calm;
    expect(cycleLength(calm)).toBe(10);
    expect(phaseAt(calm, 0)).toMatchObject({ phase: "inhale", progress: 0, cycle: 0 });
    expect(phaseAt(calm, 2)).toMatchObject({ phase: "inhale", progress: 0.5, remaining: 2 });
    expect(phaseAt(calm, 4.5).phase).toBe("holdIn");
    expect(phaseAt(calm, 5).phase).toBe("exhale");
    expect(phaseAt(calm, 9.5).phase).toBe("holdOut");
    expect(phaseAt(calm, 10)).toMatchObject({ phase: "inhale", cycle: 1 });

    const coherent = PATTERN_PRESETS.coherent;
    expect(phaseAt(coherent, 5.4).phase).toBe("inhale");
    expect(phaseAt(coherent, 5.6).phase).toBe("exhale");
    expect(phaseAt(coherent, 11.1)).toMatchObject({ phase: "inhale", cycle: 1 });
  });

  it("fills the breath on the inhale and empties it on the exhale", () => {
    expect(breathLevel({ phase: "inhale", progress: 0 })).toBe(0);
    expect(breathLevel({ phase: "inhale", progress: 0.5 })).toBeCloseTo(0.5);
    expect(breathLevel({ phase: "inhale", progress: 1 })).toBe(1);
    expect(breathLevel({ phase: "holdIn", progress: 0.3 })).toBe(1);
    expect(breathLevel({ phase: "exhale", progress: 1 })).toBe(0);
    expect(breathLevel({ phase: "holdOut", progress: 0.3 })).toBe(0);
  });

  it("keeps the defaults out of the address and reads back what it wrote", () => {
    expect(toSearch(DEFAULT_SETTINGS)).toBe("");
    expect(parseSettings(new URLSearchParams())).toEqual(DEFAULT_SETTINGS);

    const custom: MeditateSettings = {
      ...DEFAULT_SETTINGS,
      preset: "custom",
      pattern: { inhale: 3, holdIn: 2.5, exhale: 7, holdOut: 0 },
      guidance: false,
      voice: true,
      minutes: 12,
      palette: "dawn",
      size: 1.25,
      drift: 0,
      stars: false,
    };
    const search = toSearch(custom);
    expect(search).toContain("p=3-2.5-7-0");
    expect(parseSettings(new URLSearchParams(search))).toEqual(custom);
  });

  it("names a pattern by its preset, and ignores nonsense in the address", () => {
    expect(presetOf({ inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 })).toBe("relax");
    expect(parseSettings(new URLSearchParams("p=4-4-4-4")).preset).toBe("box");

    const s = parseSettings(new URLSearchParams("p=0-99-x-1&sz=40&dr=-3&pal=neon&m=abc&g=yes"));
    expect(s.pattern).toEqual(DEFAULT_SETTINGS.pattern);
    expect(s.size).toBe(1.5);
    expect(s.drift).toBe(0);
    expect(s.palette).toBe("numadelic");
    expect(s.minutes).toBe(DEFAULT_SETTINGS.minutes);
    expect(s.guidance).toBe(true);

    // An inhale or exhale of zero would be no breath at all.
    const zero = parseSettings(new URLSearchParams("p=0-0-0-20"));
    expect(zero.pattern).toEqual({ inhale: 1, holdIn: 0, exhale: 1, holdOut: 12 });
  });

  it("says the same things in every language", () => {
    const shape = (v: unknown): unknown =>
      v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    for (const locale of PUBLIC_LOCALES) expect(shape(MEDITATE_COPY[locale]), locale).toEqual(shape(MEDITATE_COPY.es));
  });

  it("comes back to the guide after a change of language", async () => {
    const res = await switchLanguage(new NextRequest(`https://example.test/clearlight/idioma/en?desde=${MEDITATE_RETURN}`), {
      params: Promise.resolve({ locale: "en" }),
    });
    expect(new URL(res.headers.get("location")!).pathname).toBe(MEDITATE_PATH);
  });
});
