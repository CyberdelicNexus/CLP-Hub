"use client";

import { useState, useSyncExternalStore } from "react";
import { Bookmark, Check, Link2, Music2, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { fill, type MeditateCopy } from "@/content/meditate";
import {
  clampPattern,
  COLOR_KEYS,
  DEFAULT_SETTINGS,
  LOOK_KEYS,
  LOOKS,
  lookOf,
  MUSIC_SOURCES,
  MUSIC_TRACKS,
  PALETTES,
  parseSettings,
  PATTERN_PRESETS,
  PHASE_LIMITS,
  PHASE_SOUNDS,
  PHASES,
  presetOf,
  PRESET_KEYS,
  RANGES,
  toSearch,
  TRANSITION_KEYS,
  type MeditateSettings,
  type MusicTrack,
  type Palette,
  type PhaseSound,
  type PresetKey,
  type RangeKey,
  type ToggleKey,
  type TransitionSound,
} from "@/domain/breathing";
import type { PublicLocale } from "@/domain/locale";
import { localStore } from "./local-store";
import { colorsOf, paletteFor } from "./palettes";

/**
 * The facilitator's settings (D-120). A side panel, not a modal: the light
 * stays in view and every change shows on it at once, so the person setting
 * up a session sees what the participant will see. The settings live in the
 * address, and "Copy link" hands them on.
 *
 * Two modes (founder's request, 2026-10-20). "Sencillo" is for someone who
 * only wants to pick a rhythm, a sound and a colour; "Avanzado" adds every
 * nuance: each phase's seconds, the guidance details, the opening and closing
 * sounds, a custom gradient, the light's shape, the background's direction,
 * and saving settings under a name. Switching mode changes only what is
 * shown, never the settings themselves.
 *
 * Both modes open with the presets: the two shapes of the light (Simétrica,
 * Asimétrica) and every saved setup, one tap each, so whoever runs a session
 * can use what a colleague prepared without opening the advanced tools.
 */
const noSubscription = () => () => {};
const allPlayable = () => PLAYABLE_ALL;
const PLAYABLE_ALL = Object.fromEntries(Object.keys(MUSIC_TRACKS).map((k) => [k, true])) as Record<MusicTrack, boolean>;
let playableCache: Record<MusicTrack, boolean> | null = null;
/** Which tracks this browser can decode, asked once. */
const canPlayTracks = () => {
  if (!playableCache) {
    const probe = document.createElement("audio");
    playableCache = Object.fromEntries(
      (Object.keys(MUSIC_TRACKS) as MusicTrack[]).map((k) => [k, probe.canPlayType(MUSIC_TRACKS[k].type) !== ""]),
    ) as Record<MusicTrack, boolean>;
  }
  return playableCache;
};

type Mode = "simple" | "advanced";
const modeStore = localStore<Mode>("numadelic.meditate.mode", "simple", (v): v is Mode => v === "simple" || v === "advanced");

/** A saved setup: a name and the same query string a shared link carries. */
interface SavedSettings {
  name: string;
  search: string;
}
const MAX_SAVED = 30;
const savedStore = localStore<SavedSettings[]>("numadelic.meditate.saved", [], (v): v is SavedSettings[] =>
  Array.isArray(v) && v.every((x) => x && typeof x.name === "string" && typeof x.search === "string"),
);

/** Whether a saved query string is the setup on screen: compared as settings, so how it was written does not matter. */
const sameSettings = (search: string, current: string) => toSearch(parseSettings(new URLSearchParams(search))) === current;

const SIMPLE_TOGGLES: readonly ToggleKey[] = ["guidance", "voice"];
const ADVANCED_TOGGLES: readonly ToggleKey[] = ["countdown", "ring", "cycles", "countIn"];
const SHAPE_RANGES: readonly RangeKey[] = ["organic", "edge", "texture", "drift", "softness", "core", "fringe"];
const PERCENT: readonly RangeKey[] = ["volume", "musicVolume", "organic", "edge", "texture"];

export function FacilitatorPanel({
  open,
  onClose,
  copy,
  locale,
  settings,
  onChange,
  localTrack,
  onTrack,
  musicError,
}: {
  open: boolean;
  onClose: () => void;
  copy: MeditateCopy;
  locale: PublicLocale;
  settings: MeditateSettings;
  onChange: (next: MeditateSettings) => void;
  /** The name of the facilitator's own track, if they chose one. */
  localTrack: string | null;
  onTrack: (file: File | null) => void;
  musicError: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const t = copy.panel;
  const playable = useSyncExternalStore(noSubscription, canPlayTracks, allPlayable);
  const mode = useSyncExternalStore(modeStore.subscribe, modeStore.get, modeStore.server);
  const advanced = mode === "advanced";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const set = (patch: Partial<MeditateSettings>) => {
    setCopied(false);
    onChange({ ...settings, ...patch });
  };
  const setPalette = (palette: Palette) => {
    // Custom starts from the colours on screen, unless the facilitator has already made their own.
    const untouched = COLOR_KEYS.every((k) => settings.colors[k] === DEFAULT_SETTINGS.colors[k]);
    if (palette === "custom" && settings.palette !== "custom" && untouched) {
      return set({ palette, colors: colorsOf(settings.palette) });
    }
    set({ palette });
  };
  const setPreset = (preset: PresetKey | "custom") => {
    if (preset === "custom") return set({ preset });
    set({ preset, pattern: { ...PATTERN_PRESETS[preset] } });
  };
  const look = lookOf(settings);
  const saved = useSyncExternalStore(savedStore.subscribe, savedStore.get, savedStore.server);
  const current = toSearch(settings);

  return (
    <aside id="m-panel" className="m-panel" aria-label={t.title} hidden={!open} lang={locale}>
      <div className="m-panel__head">
        <h2 className="m-panel__title">{t.title}</h2>
        <button type="button" className="m-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="m-modes" role="radiogroup" aria-label={t.modes.label}>
        {(["simple", "advanced"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className="m-mode" onClick={() => modeStore.set(m)}>
            {t.modes[m]}
          </button>
        ))}
      </div>
      <p className="m-panel__note">{advanced ? t.modes.advancedNote : t.modes.simpleNote}</p>

      <section className="m-panel__section" aria-labelledby="m-s-presets">
        <h3 id="m-s-presets" className="cl-eyebrow">
          {t.sections.presets}
        </h3>
        <div className="m-chips" role="group" aria-label={t.sections.presets}>
          {LOOK_KEYS.map((key) => (
            <button key={key} type="button" aria-pressed={look === key} className="m-chip" onClick={() => set(LOOKS[key])}>
              {t.looks[key]}
            </button>
          ))}
          {saved.map((item) => (
            <button
              key={`saved:${item.name}`}
              type="button"
              aria-pressed={sameSettings(item.search, current)}
              className="m-chip m-chip--saved"
              onClick={() => onChange(parseSettings(new URLSearchParams(item.search)))}
            >
              <Bookmark size={12} aria-hidden />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-breath">
        <h3 id="m-s-breath" className="cl-eyebrow">
          {t.sections.breath}
        </h3>
        <div className="m-chips" role="radiogroup" aria-label={t.pattern}>
          {[...PRESET_KEYS, ...(advanced || settings.preset === "custom" ? (["custom"] as const) : [])].map((key) => (
            <button key={key} type="button" role="radio" aria-checked={settings.preset === key} className="m-chip" onClick={() => setPreset(key)}>
              {t.presets[key]}
            </button>
          ))}
        </div>
        {advanced
          ? PHASES.map((phase) => (
              <label key={phase} className="m-field">
                <span>{copy.phases[phase]}</span>
                <input
                  type="range"
                  min={PHASE_LIMITS.min}
                  max={PHASE_LIMITS.max}
                  step={PHASE_LIMITS.step}
                  value={settings.pattern[phase]}
                  onChange={(e) => {
                    const pattern = clampPattern({ ...settings.pattern, [phase]: Number(e.target.value) });
                    set({ pattern, preset: presetOf(pattern) });
                  }}
                />
                <output>{fill(t.seconds, number.format(settings.pattern[phase]))}</output>
              </label>
            ))
          : null}
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-guide">
        <h3 id="m-s-guide" className="cl-eyebrow">
          {t.sections.guidance}
        </h3>
        {[...SIMPLE_TOGGLES, ...(advanced ? ADVANCED_TOGGLES : [])].map((key) => (
          <Toggle key={key} label={t.toggles[key]} checked={settings[key]} onChange={(v) => set({ [key]: v })} />
        ))}
        <label className="m-field m-field--select">
          <span>{t.phaseSound.label}</span>
          <select value={settings.phaseSound} onChange={(e) => set({ phaseSound: e.target.value as PhaseSound })}>
            {PHASE_SOUNDS.map((k) => (
              <option key={k} value={k}>
                {t.phaseSound.options[k]}
              </option>
            ))}
          </select>
        </label>
        <Range label={t.ranges.volume} k="volume" settings={settings} format={number} set={set} />
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-music">
        <h3 id="m-s-music" className="cl-eyebrow">
          {t.sections.music}
        </h3>
        <Toggle label={t.toggles.music} checked={settings.music} onChange={(v) => set({ music: v })} />
        <div className="m-chips" role="radiogroup" aria-label={t.music.source}>
          {MUSIC_SOURCES.map((source) => {
            // A track this browser cannot decode (Ogg on an older iPhone) is shown, but not offered.
            const unplayable = source !== "file" && !playable[source];
            return (
              <button
                key={source}
                type="button"
                role="radio"
                aria-checked={settings.musicSource === source}
                className="m-chip"
                disabled={unplayable}
                title={unplayable ? t.music.unsupported : undefined}
                onClick={() => set({ musicSource: source })}
              >
                {t.music.sources[source]}
              </button>
            );
          })}
        </div>
        {settings.musicSource === "file" ? (
          <div className="m-music">
            <label className="cl-ghost m-music__pick">
              <Upload size={16} aria-hidden />
              <span>{t.music.choose}</span>
              <input type="file" accept="audio/*" onChange={(e) => onTrack(e.target.files?.[0] ?? null)} />
            </label>
            <p className="m-music__name">
              <Music2 size={14} aria-hidden />
              <span>{localTrack ?? t.music.none}</span>
            </p>
            <p className="m-panel__hint">{t.music.fileNote}</p>
          </div>
        ) : null}
        {musicError ? (
          <p className="m-panel__hint m-panel__hint--error" role="alert">
            {t.music.error}
          </p>
        ) : null}
        <Range label={t.ranges.musicVolume} k="musicVolume" settings={settings} format={number} set={set} disabled={!settings.music} />
        {advanced
          ? (["intro", "outro"] as const).map((which) => (
              <label key={which} className="m-field m-field--select">
                <span>{t.transitions[which]}</span>
                <select value={settings[which]} onChange={(e) => set({ [which]: e.target.value as TransitionSound })}>
                  {TRANSITION_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {t.transitions.sounds[k]}
                    </option>
                  ))}
                </select>
              </label>
            ))
          : null}
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-light">
        <h3 id="m-s-light" className="cl-eyebrow">
          {t.sections.light}
        </h3>
        <div className="m-swatches" role="radiogroup" aria-label={t.palette}>
          {PALETTES.filter((p) => p !== "custom" || advanced || settings.palette === "custom").map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={settings.palette === p}
              className="m-swatch"
              onClick={() => setPalette(p)}
              title={t.palettes[p]}
            >
              <span className="m-swatch__dot" style={{ background: paletteFor({ palette: p, colors: settings.colors }).swatch }} aria-hidden />
              <span className="m-swatch__name">{t.palettes[p]}</span>
            </button>
          ))}
        </div>
        {advanced && settings.palette === "custom" ? (
          <div className="m-custom">
            <div
              className="m-custom__preview"
              aria-hidden
              style={{ "--c-light": settings.colors.light, "--c-a": settings.colors.a, "--c-b": settings.colors.b } as React.CSSProperties}
            />
            <div className="m-custom__colors">
              {COLOR_KEYS.map((key) => (
                <label key={key} className="m-color">
                  <input
                    type="color"
                    value={settings.colors[key]}
                    onChange={(e) => set({ colors: { ...settings.colors, [key]: e.target.value.toLowerCase() } })}
                  />
                  <span>{t.colors[key]}</span>
                  <output>{settings.colors[key]}</output>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <Range label={t.ranges.size} k="size" settings={settings} format={number} set={set} />
        {advanced ? (
          <>
            <Range label={t.ranges.depth} k="depth" settings={settings} format={number} set={set} />
            <Range label={t.ranges.glow} k="glow" settings={settings} format={number} set={set} />
          </>
        ) : null}
      </section>

      {advanced ? (
        <section className="m-panel__section" aria-labelledby="m-s-shape">
          <h3 id="m-s-shape" className="cl-eyebrow">
            {t.sections.shape}
          </h3>
          {SHAPE_RANGES.map((k) => (
            <Range key={k} label={t.ranges[k]} k={k} settings={settings} format={number} set={set} />
          ))}
        </section>
      ) : null}

      <section className="m-panel__section" aria-labelledby="m-s-bg">
        <h3 id="m-s-bg" className="cl-eyebrow">
          {t.sections.background}
        </h3>
        <Toggle label={t.toggles.stars} checked={settings.stars} onChange={(v) => set({ stars: v })} />
        {advanced ? (
          <>
            <Range label={t.ranges.ambient} k="ambient" settings={settings} format={number} set={set} />
            <Range label={t.ranges.angle} k="angle" settings={settings} format={number} set={set} />
          </>
        ) : null}
      </section>

      {advanced ? <SavedSettingsSection copy={copy} saved={saved} current={current} onApply={onChange} /> : null}

      <div className="m-panel__actions">
        <button
          type="button"
          className="cl-ghost"
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}${toSearch(settings)}`;
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
          <span aria-live="polite">{copied ? t.copied : t.copyLink}</span>
        </button>
        <button type="button" className="cl-ghost" onClick={() => set({ ...DEFAULT_SETTINGS, minutes: settings.minutes })}>
          <RotateCcw size={16} aria-hidden />
          <span>{t.reset}</span>
        </button>
      </div>
    </aside>
  );
}

/**
 * Saving settings under a name, and managing what is saved, in this browser
 * only. Each is stored as the query string a shared link carries, so it keeps
 * working as the settings grow: anything it does not name falls back to the
 * default. Saving under a name that exists replaces it. What is saved also
 * appears in the presets at the top of the panel, in either mode.
 */
function SavedSettingsSection({
  copy,
  saved,
  current,
  onApply,
}: {
  copy: MeditateCopy;
  saved: SavedSettings[];
  current: string;
  onApply: (next: MeditateSettings) => void;
}) {
  const t = copy.panel.saved;
  const [name, setName] = useState("");
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const save = () => {
    const label = name.trim().slice(0, 60) || fill(t.fallbackName, saved.length + 1);
    const rest = saved.filter((x) => x.name !== label);
    savedStore.set([{ name: label, search: current }, ...rest].slice(0, MAX_SAVED));
    setName("");
    setJustSaved(label);
  };

  return (
    <section className="m-panel__section" aria-labelledby="m-s-saved">
      <h3 id="m-s-saved" className="cl-eyebrow">
        {t.title}
      </h3>
      <form
        className="m-save"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="m-save__name">
          <span className="cl-sr">{t.name}</span>
          <input type="text" value={name} maxLength={60} placeholder={t.placeholder} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="cl-ghost m-save__button">
          <Save size={16} aria-hidden />
          <span>{t.save}</span>
        </button>
      </form>
      <p className="m-panel__hint" aria-live="polite">
        {justSaved ? fill(t.saved, justSaved) : t.note}
      </p>
      {saved.length === 0 ? (
        <p className="m-panel__hint">{t.empty}</p>
      ) : (
        <ul className="m-saved">
          {saved.map((item) => (
            <li key={item.name} className="m-saved__item" data-current={sameSettings(item.search, current) ? "" : undefined}>
              <span className="m-saved__name">{item.name}</span>
              <button type="button" className="m-chip" onClick={() => onApply(parseSettings(new URLSearchParams(item.search)))}>
                {t.apply}
              </button>
              <button
                type="button"
                className="m-icon m-saved__remove"
                aria-label={fill(t.remove, item.name)}
                title={fill(t.remove, item.name)}
                onClick={() => savedStore.set(saved.filter((x) => x.name !== item.name))}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="m-toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="m-toggle__track" aria-hidden />
    </label>
  );
}

function Range({
  label,
  k,
  settings,
  format,
  set,
  disabled,
}: {
  label: string;
  k: RangeKey;
  settings: MeditateSettings;
  format: Intl.NumberFormat;
  set: (patch: Partial<MeditateSettings>) => void;
  disabled?: boolean;
}) {
  const { min, max, step } = RANGES[k];
  const value = settings[k];
  return (
    <label className="m-field" data-disabled={disabled ? "" : undefined}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => set({ [k]: Number(e.target.value) })}
      />
      <output>{PERCENT.includes(k) ? `${Math.round(value * 100)}%` : k === "angle" ? `${value}°` : `${format.format(value)}×`}</output>
    </label>
  );
}
