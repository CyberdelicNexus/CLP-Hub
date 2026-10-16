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

export const PALETTES = ["numadelic", "aurora", "dawn", "lavender", "moon", "custom"] as const;
export type Palette = (typeof PALETTES)[number];

/**
 * The facilitator's own colours, used when the palette is "custom": the light's
 * body, and the two background lights (`a` lower left, `b` upper right, before
 * `angle` turns them). Each is "#rrggbb".
 */
export interface CustomColors {
  light: string;
  a: string;
  b: string;
}
export const COLOR_KEYS = ["light", "a", "b"] as const satisfies readonly (keyof CustomColors)[];
const HEX = /^#[0-9a-f]{6}$/;

/**
 * Background music: one of the studio's three tracks, or a file on the
 * facilitator's device (played in their browser only, never uploaded, and so
 * never in the link: whoever opens a link hears the first track).
 */
export const MUSIC_TRACKS = {
  guitar: { src: "/audio/meditate/music/guitar.mp3", type: "audio/mpeg" },
  relax: { src: "/audio/meditate/music/relax.ogg", type: 'audio/ogg; codecs="vorbis"' },
  float: { src: "/audio/meditate/music/float.ogg", type: 'audio/ogg; codecs="vorbis"' },
} as const;
export type MusicTrack = keyof typeof MUSIC_TRACKS;
export const MUSIC_SOURCES = [...(Object.keys(MUSIC_TRACKS) as MusicTrack[]), "file"] as const;
export type MusicSource = MusicTrack | "file";

/**
 * What plays as a session opens and as it closes: nothing, the soft
 * synthesised tone (bowl.ts), or one of the studio's recordings. An effect plays once;
 * as the opening, a long one is faded out after a few seconds.
 */
export const TRANSITION_SOUNDS = {
  none: null,
  tone: null,
  bell: { src: "/audio/meditate/music/sfx/bell.mp3" },
  bowl: { src: "/audio/meditate/music/sfx/bowl.mp3" },
  ghom: { src: "/audio/meditate/music/sfx/ghom.wav" },
} as const;
export type TransitionSound = keyof typeof TRANSITION_SOUNDS;
export const TRANSITION_KEYS = Object.keys(TRANSITION_SOUNDS) as TransitionSound[];

/**
 * The sound that follows the breath: none, the synthesised bowl on each
 * in-breath and out-breath (bowl.ts), or ocean waves that swell in and draw
 * back out with it (ocean.ts).
 */
export const PHASE_SOUNDS = ["none", "bowl", "ocean"] as const;
export type PhaseSound = (typeof PHASE_SOUNDS)[number];

export const TIMER_MINUTES = [0, 1, 3, 5, 10, 15, 20, 30] as const;

export interface MeditateSettings {
  preset: PresetKey | "custom";
  pattern: Pattern;
  /** Words for each phase under the light. */
  guidance: boolean;
  /** Seconds left in the phase. */
  countdown: boolean;
  /** A thin line above the words that fills with each phase. */
  ring: boolean;
  /** The number of breaths taken. */
  cycles: boolean;
  /** "Prepárate" and three seconds before the first breath. */
  countIn: boolean;
  /** What sounds on each in-breath and out-breath. */
  phaseSound: PhaseSound;
  /** The phase word, spoken by the browser's voice. */
  voice: boolean;
  /** 0 to 1, for the tones, the voice and the opening and closing sounds. */
  volume: number;
  intro: TransitionSound;
  outro: TransitionSound;
  music: boolean;
  musicSource: MusicSource;
  /** 0 to 1. */
  musicVolume: number;
  /** 0 is open-ended. */
  minutes: number;
  palette: Palette;
  colors: CustomColors;
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
  /** Degrees the two background lights are turned round the centre. */
  angle: number;
}

export const DEFAULT_SETTINGS: MeditateSettings = {
  preset: "calm",
  pattern: { ...PATTERN_PRESETS.calm },
  guidance: true,
  countdown: true,
  ring: true,
  cycles: false,
  countIn: true,
  phaseSound: "none",
  voice: false,
  volume: 0.6,
  intro: "bell",
  outro: "ghom",
  music: true,
  musicSource: "guitar",
  musicVolume: 0.45,
  minutes: 5,
  palette: "numadelic",
  // The home page's colours, as a starting point for a custom gradient.
  colors: { light: "#8591ff", a: "#4a7aff", b: "#9670ff" },
  size: 1,
  depth: 1,
  drift: 1,
  glow: 1,
  stars: true,
  ambient: 1,
  angle: 0,
};

export const RANGES = {
  volume: { min: 0, max: 1, step: 0.05 },
  musicVolume: { min: 0, max: 1, step: 0.05 },
  size: { min: 0.6, max: 1.5, step: 0.05 },
  depth: { min: 0.2, max: 1.5, step: 0.05 },
  drift: { min: 0, max: 3, step: 0.05 },
  glow: { min: 0, max: 2, step: 0.05 },
  ambient: { min: 0, max: 2, step: 0.05 },
  angle: { min: 0, max: 360, step: 5 },
} as const;
export type RangeKey = keyof typeof RANGES;

const TOGGLES = { guidance: "g", countdown: "n", ring: "r", cycles: "c", countIn: "i", voice: "v", stars: "st", music: "mu" } as const;
export type ToggleKey = keyof typeof TOGGLES;
const NUMBERS = { volume: "vol", musicVolume: "mv", size: "sz", depth: "dp", drift: "dr", glow: "gl", ambient: "am", angle: "an" } as const satisfies Record<RangeKey, string>;

const COLOR_PARAMS = { light: "cl", a: "ca", b: "cb" } as const satisfies Record<keyof CustomColors, string>;

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
  if (s.phaseSound !== d.phaseSound) q.set("ps", s.phaseSound);
  if (s.intro !== d.intro) q.set("in", s.intro);
  if (s.outro !== d.outro) q.set("out", s.outro);
  if (s.palette !== d.palette) q.set("pal", s.palette);
  // A local file cannot travel in a link; whoever opens it gets the first track.
  if (s.musicSource !== d.musicSource && s.musicSource !== "file") q.set("ms", s.musicSource);
  // Colours without their "#", which would otherwise be escaped in the address.
  for (const key of COLOR_KEYS) {
    if (s.colors[key] !== d.colors[key]) q.set(COLOR_PARAMS[key], s.colors[key].slice(1));
  }
  const out = q.toString();
  return out ? `?${out}` : "";
}

/** Reads what `toSearch` wrote. Anything missing, unknown or out of range falls back to the default. */
export function parseSettings(q: URLSearchParams): MeditateSettings {
  const s: MeditateSettings = { ...DEFAULT_SETTINGS, pattern: { ...DEFAULT_SETTINGS.pattern }, colors: { ...DEFAULT_SETTINGS.colors } };

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
  const phaseSound = q.get("ps");
  if ((PHASE_SOUNDS as readonly (string | null)[]).includes(phaseSound)) s.phaseSound = phaseSound as PhaseSound;
  // Links made before the breath sound existed said only "tones on".
  else if (q.get("t") === "1") s.phaseSound = "bowl";
  for (const key of ["intro", "outro"] as const) {
    const v = q.get(key === "intro" ? "in" : "out");
    if (v && Object.hasOwn(TRANSITION_SOUNDS, v)) s[key] = v as TransitionSound;
  }
  const track = q.get("ms");
  if (track && Object.hasOwn(MUSIC_TRACKS, track)) s.musicSource = track as MusicTrack;
  for (const key of COLOR_KEYS) {
    const hex = `#${q.get(COLOR_PARAMS[key]) ?? ""}`.toLowerCase();
    if (HEX.test(hex)) s.colors[key] = hex;
  }
  return s;
}
