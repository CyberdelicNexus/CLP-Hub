/**
 * The breathing guide at /meditate (D-120): the timing of a breath and the
 * facilitator's settings. Pure, so the page and the tests share it.
 *
 * These are general relaxation rhythms for anyone who opens the page, not a
 * study protocol: nothing here is a clinical rule, and nothing is stored. The
 * settings travel in the address (`toSearch` / `parseSettings`), so a
 * facilitator can prepare a session on one screen and open the same link on
 * another.
 */

export const PHASES = ["inhale", "holdIn", "exhale", "holdOut"] as const;
export type Phase = (typeof PHASES)[number];

/** Seconds for each part of one breath. A hold of 0 is skipped. */
export type Pattern = Record<Phase, number>;

export const PATTERN_PRESETS = {
  /** The home page's light: four in, one held, four out, one held (D-108). */
  calm: { inhale: 4, holdIn: 1, exhale: 4, holdOut: 1 },
  box: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  coherent: { inhale: 5.5, holdIn: 0, exhale: 5.5, holdOut: 0 },
  relax: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  longExhale: { inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
} as const satisfies Record<string, Pattern>;
export type PresetKey = keyof typeof PATTERN_PRESETS;
export const PRESET_KEYS = Object.keys(PATTERN_PRESETS) as PresetKey[];

export const PHASE_LIMITS = { min: 0, max: 12, step: 0.5 } as const;
/** An inhale and an exhale always take some time, or there is no breath to follow. */
const MIN_MOVE = 1;

export function cycleLength(p: Pattern): number {
  return p.inhale + p.holdIn + p.exhale + p.holdOut;
}

export interface PhaseState {
  phase: Phase;
  /** 0 at the start of the phase, 1 at its end. */
  progress: number;
  /** Seconds left in this phase. */
  remaining: number;
  /** Completed breaths before this one. */
  cycle: number;
}

/** Where in the breath `t` seconds after its start falls. */
export function phaseAt(p: Pattern, t: number): PhaseState {
  const total = cycleLength(p);
  const time = Math.max(0, t);
  const cycle = Math.floor(time / total);
  let within = time - cycle * total;
  for (const phase of PHASES) {
    const length = p[phase];
    if (length <= 0) continue;
    if (within < length) return { phase, progress: within / length, remaining: length - within, cycle };
    within -= length;
  }
  // Floating point at the very end of a cycle.
  return { phase: "inhale", progress: 0, remaining: p.inhale, cycle: cycle + 1 };
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** How full the breath is, 0 (empty) to 1 (full), eased like the home page's light. */
export function breathLevel({ phase, progress }: Pick<PhaseState, "phase" | "progress">): number {
  switch (phase) {
    case "inhale":
      return ease(progress);
    case "holdIn":
      return 1;
    case "exhale":
      return 1 - ease(progress);
    case "holdOut":
      return 0;
  }
}

/* ------------------------------------------------------------- settings */

export const PALETTES = ["numadelic", "aurora", "dawn", "lavender", "moon"] as const;
export type Palette = (typeof PALETTES)[number];

export const TIMER_MINUTES = [0, 1, 3, 5, 10, 15, 20, 30] as const;

export interface MeditateSettings {
  preset: PresetKey | "custom";
  pattern: Pattern;
  /** Words for each phase under the light. */
  guidance: boolean;
  /** Seconds left in the phase. */
  countdown: boolean;
  /** A thin ring around the light that fills with the phase. */
  ring: boolean;
  /** The number of breaths taken. */
  cycles: boolean;
  /** "Prepárate" and three seconds before the first breath. */
  countIn: boolean;
  /** A soft tone at the start of each phase. */
  tones: boolean;
  /** The phase word, spoken by the browser's voice. */
  voice: boolean;
  /** 0 to 1. */
  volume: number;
  /** 0 is open-ended. */
  minutes: number;
  palette: Palette;
  /** Multiplies the light's diameter. */
  size: number;
  /** How far the light grows and shrinks. */
  depth: number;
  /** How fast the cloud inside the light drifts. */
  drift: number;
  /** Strength of the glow around the light. */
  glow: number;
  stars: boolean;
  /** Strength of the coloured light in the background. */
  ambient: number;
}

export const DEFAULT_SETTINGS: MeditateSettings = {
  preset: "calm",
  pattern: { ...PATTERN_PRESETS.calm },
  guidance: true,
  countdown: true,
  ring: true,
  cycles: false,
  countIn: true,
  tones: false,
  voice: false,
  volume: 0.6,
  minutes: 5,
  palette: "numadelic",
  size: 1,
  depth: 1,
  drift: 1,
  glow: 1,
  stars: true,
  ambient: 1,
};

export const RANGES = {
  volume: { min: 0, max: 1, step: 0.05 },
  size: { min: 0.6, max: 1.5, step: 0.05 },
  depth: { min: 0.2, max: 1.5, step: 0.05 },
  drift: { min: 0, max: 3, step: 0.05 },
  glow: { min: 0, max: 2, step: 0.05 },
  ambient: { min: 0, max: 2, step: 0.05 },
} as const;
export type RangeKey = keyof typeof RANGES;

const TOGGLES = { guidance: "g", countdown: "n", ring: "r", cycles: "c", countIn: "i", tones: "t", voice: "v", stars: "st" } as const;
export type ToggleKey = keyof typeof TOGGLES;
const NUMBERS = { volume: "vol", size: "sz", depth: "dp", drift: "dr", glow: "gl", ambient: "am" } as const satisfies Record<RangeKey, string>;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const snap = (n: number, step: number) => Math.round(n / step) * step;
const round = (n: number) => Math.round(n * 1000) / 1000;

export function clampPattern(p: Pattern): Pattern {
  const one = (phase: Phase) => {
    const v = clamp(snap(p[phase], PHASE_LIMITS.step), PHASE_LIMITS.min, PHASE_LIMITS.max);
    return phase === "inhale" || phase === "exhale" ? Math.max(MIN_MOVE, v) : v;
  };
  return { inhale: one("inhale"), holdIn: one("holdIn"), exhale: one("exhale"), holdOut: one("holdOut") };
}

/** The preset a pattern matches, if any: a custom pattern that equals a preset is that preset. */
export function presetOf(p: Pattern): PresetKey | "custom" {
  return PRESET_KEYS.find((k) => PHASES.every((ph) => PATTERN_PRESETS[k][ph] === p[ph])) ?? "custom";
}

/** Only what differs from the defaults, so a plain /meditate stays a plain address. */
export function toSearch(s: MeditateSettings): string {
  const q = new URLSearchParams();
  const d = DEFAULT_SETTINGS;
  if (PHASES.some((ph) => s.pattern[ph] !== d.pattern[ph])) q.set("p", PHASES.map((ph) => s.pattern[ph]).join("-"));
  for (const [key, short] of Object.entries(TOGGLES) as [ToggleKey, string][]) {
    if (s[key] !== d[key]) q.set(short, s[key] ? "1" : "0");
  }
  for (const [key, short] of Object.entries(NUMBERS) as [RangeKey, string][]) {
    if (s[key] !== d[key]) q.set(short, String(round(s[key])));
  }
  if (s.minutes !== d.minutes) q.set("m", String(s.minutes));
  if (s.palette !== d.palette) q.set("pal", s.palette);
  const out = q.toString();
  return out ? `?${out}` : "";
}

/** Reads what `toSearch` wrote. Anything missing, unknown or out of range falls back to the default. */
export function parseSettings(q: URLSearchParams): MeditateSettings {
  const s: MeditateSettings = { ...DEFAULT_SETTINGS, pattern: { ...DEFAULT_SETTINGS.pattern } };

  const parts = q.get("p")?.split("-").map(Number);
  if (parts?.length === 4 && parts.every(Number.isFinite)) {
    s.pattern = clampPattern({ inhale: parts[0], holdIn: parts[1], exhale: parts[2], holdOut: parts[3] });
  }
  s.preset = presetOf(s.pattern);

  for (const [key, short] of Object.entries(TOGGLES) as [ToggleKey, string][]) {
    const v = q.get(short);
    if (v === "1" || v === "0") s[key] = v === "1";
  }
  for (const [key, short] of Object.entries(NUMBERS) as [RangeKey, string][]) {
    const raw = q.get(short);
    const v = raw === null ? NaN : Number(raw);
    if (Number.isFinite(v)) s[key] = round(clamp(v, RANGES[key].min, RANGES[key].max));
  }
  const minutes = Number(q.get("m"));
  if (q.has("m") && Number.isInteger(minutes)) s.minutes = clamp(minutes, 0, 120);
  const palette = q.get("pal");
  if ((PALETTES as readonly (string | null)[]).includes(palette)) s.palette = palette as Palette;
  return s;
}
