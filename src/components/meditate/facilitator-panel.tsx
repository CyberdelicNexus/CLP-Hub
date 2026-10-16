"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Link2, Music2, RotateCcw, Upload, X } from "lucide-react";
import { fill, type MeditateCopy } from "@/content/meditate";
import {
  clampPattern,
  COLOR_KEYS,
  DEFAULT_SETTINGS,
  MUSIC_SOURCES,
  MUSIC_TRACKS,
  PALETTES,
  PHASE_SOUNDS,
  TRANSITION_KEYS,
  PATTERN_PRESETS,
  PHASE_LIMITS,
  PHASES,
  presetOf,
  PRESET_KEYS,
  RANGES,
  toSearch,
  type MeditateSettings,
  type MusicTrack,
  type Palette,
  type PhaseSound,
  type TransitionSound,
  type PresetKey,
  type RangeKey,
  type ToggleKey,
} from "@/domain/breathing";
import type { PublicLocale } from "@/domain/locale";
import { colorsOf, paletteFor } from "./palettes";

/**
 * The facilitator's settings (D-120). A side panel, not a modal: the light
 * stays in view and every change shows on it at once, so the person setting
 * up a session sees what the participant will see. Nothing is stored; the
 * page writes the settings into the address, and "Copy link" hands that on.
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

const GUIDE_TOGGLES: readonly ToggleKey[] = ["guidance", "countdown", "ring", "cycles", "countIn", "voice"];
const LIGHT_RANGES: readonly RangeKey[] = ["size", "depth", "drift", "glow"];

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

  return (
    <aside id="m-panel" className="m-panel" aria-label={t.title} hidden={!open} lang={locale}>
      <div className="m-panel__head">
        <h2 className="m-panel__title">{t.title}</h2>
        <button type="button" className="m-icon" onClick={onClose} aria-label={t.close} title={t.close}>
          <X size={16} aria-hidden />
        </button>
      </div>
      <p className="m-panel__note">{t.note}</p>

      <section className="m-panel__section" aria-labelledby="m-s-breath">
        <h3 id="m-s-breath" className="cl-eyebrow">
          {t.sections.breath}
        </h3>
        <div className="m-chips" role="radiogroup" aria-label={t.pattern}>
          {[...PRESET_KEYS, "custom" as const].map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={settings.preset === key}
              className="m-chip"
              onClick={() => setPreset(key)}
            >
              {t.presets[key]}
            </button>
          ))}
        </div>
        {PHASES.map((phase) => (
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
        ))}
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-guide">
        <h3 id="m-s-guide" className="cl-eyebrow">
          {t.sections.guidance}
        </h3>
        {GUIDE_TOGGLES.map((key) => (
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
        {(["intro", "outro"] as const).map((which) => (
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
        ))}
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-light">
        <h3 id="m-s-light" className="cl-eyebrow">
          {t.sections.light}
        </h3>
        <div className="m-swatches" role="radiogroup" aria-label={t.palette}>
          {PALETTES.map((p) => (
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
        {settings.palette === "custom" ? (
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
        {LIGHT_RANGES.map((k) => (
          <Range key={k} label={t.ranges[k]} k={k} settings={settings} format={number} set={set} />
        ))}
      </section>

      <section className="m-panel__section" aria-labelledby="m-s-bg">
        <h3 id="m-s-bg" className="cl-eyebrow">
          {t.sections.background}
        </h3>
        <Toggle label={t.toggles.stars} checked={settings.stars} onChange={(v) => set({ stars: v })} />
        <Range label={t.ranges.ambient} k="ambient" settings={settings} format={number} set={set} />
        <Range label={t.ranges.angle} k="angle" settings={settings} format={number} set={set} />
      </section>

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
  return (
    <label className="m-field" data-disabled={disabled ? "" : undefined}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[k]}
        disabled={disabled}
        onChange={(e) => set({ [k]: Number(e.target.value) })}
      />
      <output>
        {k === "volume" || k === "musicVolume" ? `${Math.round(settings[k] * 100)}%` : k === "angle" ? `${settings[k]}°` : `${format.format(settings[k])}×`}
      </output>
    </label>
  );
}
