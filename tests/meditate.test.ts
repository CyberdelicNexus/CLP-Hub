import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { MEDITATE_COPY } from "@/content/meditate";
import {
  breathLevel,
  cycleLength,
  DEFAULT_SETTINGS,
  LOOKS,
  lookOf,
  MUSIC_TRACKS,
  TRANSITION_SOUNDS,
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

  it("carries a custom gradient and its direction in the address", () => {
    const custom: MeditateSettings = {
      ...DEFAULT_SETTINGS,
      palette: "custom",
      colors: { light: "#ff00aa", a: "#00ff88", b: "#123456" },
      angle: 135,
    };
    const search = toSearch(custom);
    expect(search).toContain("cl=ff00aa");
    expect(search).not.toContain("%23");
    expect(parseSettings(new URLSearchParams(search))).toEqual(custom);

    // Anything that is not a six-digit colour is ignored.
    const bad = parseSettings(new URLSearchParams("pal=custom&cl=red&ca=12345&cb=%23zzzzzz&an=999"));
    expect(bad.colors).toEqual(DEFAULT_SETTINGS.colors);
    expect(bad.angle).toBe(360);
  });

  it("keeps the chosen track in the address, but never a local file", () => {
    const chosen: MeditateSettings = { ...DEFAULT_SETTINGS, musicSource: "float", musicVolume: 0.3 };
    expect(toSearch(chosen)).toContain("ms=float");
    expect(parseSettings(new URLSearchParams(toSearch(chosen)))).toEqual(chosen);

    // The file lives in one browser only: whoever opens the link hears the first track.
    expect(toSearch({ ...DEFAULT_SETTINGS, musicSource: "file" })).toBe("");
    for (const bad of ["file", "link", "https://example.test/a.mp3", "toString"]) {
      expect(parseSettings(new URLSearchParams({ ms: bad })).musicSource, bad).toBe("guitar");
    }
  });

  it("ships every track and sound it offers", () => {
    const files = [
      ...[...Object.values(MUSIC_TRACKS), ...Object.values(TRANSITION_SOUNDS)].flatMap((t) => (t ? [t.src] : [])),
      "/audio/meditate/music/sfx/ocean.mp3",
      ...["es", "en"].flatMap((lang) => ["ready", "inhale", "holdIn", "exhale", "holdOut", "done"].map((clip) => `/audio/meditate/${lang}/${clip}.mp3`)),
    ];
    for (const src of files) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
  });

  it("keeps the opening and closing sounds in the address", () => {
    const chosen: MeditateSettings = { ...DEFAULT_SETTINGS, intro: "tone", outro: "none", phaseSound: "ocean" };
    expect(parseSettings(new URLSearchParams(toSearch(chosen)))).toEqual(chosen);
    expect(parseSettings(new URLSearchParams("in=gong&out=__proto__&ps=loud"))).toMatchObject({
      intro: DEFAULT_SETTINGS.intro,
      outro: DEFAULT_SETTINGS.outro,
      phaseSound: DEFAULT_SETTINGS.phaseSound,
    });
    // A link from before the breath sound: "tones on" is the bowl.
    expect(parseSettings(new URLSearchParams("t=1")).phaseSound).toBe("bowl");
  });

  it("starts round and still, keeps the home page's look one tap away, and carries the shape in the link", () => {
    // David's review: symmetrical, no organic movement, by default.
    expect(lookOf(DEFAULT_SETTINGS)).toBe("symmetric");
    expect([DEFAULT_SETTINGS.organic, DEFAULT_SETTINGS.edge, DEFAULT_SETTINGS.texture]).toEqual([0, 0, 0]);

    const asymmetric: MeditateSettings = { ...DEFAULT_SETTINGS, ...LOOKS.asymmetric };
    expect(lookOf(asymmetric)).toBe("asymmetric");
    expect(parseSettings(new URLSearchParams(toSearch(asymmetric)))).toEqual(asymmetric);

    const tuned: MeditateSettings = { ...DEFAULT_SETTINGS, organic: 0.35, texture: 0.6, softness: 1.4, core: 0.8, fringe: 0 };
    expect(lookOf(tuned)).toBeNull();
    expect(parseSettings(new URLSearchParams(toSearch(tuned)))).toEqual(tuned);
    expect(parseSettings(new URLSearchParams("og=9&sf=0")).organic).toBe(1);
    expect(parseSettings(new URLSearchParams("og=9&sf=0")).softness).toBe(0.2);
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
