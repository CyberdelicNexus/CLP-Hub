"use client";

import { useState } from "react";
import { Check, Link2, RotateCcw, X } from "lucide-react";
import { fill, type MeditateCopy } from "@/content/meditate";
import {
  clampPattern,
  DEFAULT_SETTINGS,
  PALETTES,
  PATTERN_PRESETS,
  PHASE_LIMITS,
  PHASES,
  presetOf,
  PRESET_KEYS,
  RANGES,
  toSearch,
  type MeditateSettings,
  type PresetKey,
  type RangeKey,
  type ToggleKey,
} from "@/domain/breathing";
import type { PublicLocale } from "@/domain/locale";
import { PALETTE_COLORS } from "./palettes";

/**
 * The facilitator's settings (D-120). A side panel, not a modal: the light
 * stays in view and every change shows on it at once, so the person setting
 * up a session sees what the participant will see. Nothing is stored; the
 * page writes the settings into the address, and "Copy link" hands that on.
 */
const GUIDE_TOGGLES: readonly ToggleKey[] = ["guidance", "countdown", "ring", "cycles", "countIn", "tones", "voice"];
const LIGHT_RANGES: readonly RangeKey[] = ["size", "depth", "drift", "glow"];

export function FacilitatorPanel({
  open,
  onClose,
  copy,
  locale,
  settings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  copy: MeditateCopy;
  locale: PublicLocale;
  settings: MeditateSettings;
  onChange: (next: MeditateSettings) => void;
}) {
  const [copied, setCopied] = useState(false);
  const t = copy.panel;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const set = (patch: Partial<MeditateSettings>) => {
    setCopied(false);
    onChange({ ...settings, ...patch });
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
        <Range label={t.ranges.volume} k="volume" settings={settings} format={number} set={set} disabled={!settings.tones && !settings.voice} />
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
              onClick={() => set({ palette: p })}
              title={t.palettes[p]}
            >
              <span className="m-swatch__dot" style={{ background: PALETTE_COLORS[p].swatch }} aria-hidden />
              <span className="m-swatch__name">{t.palettes[p]}</span>
            </button>
          ))}
        </div>
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
      <output>{k === "volume" ? `${Math.round(settings[k] * 100)}%` : `${format.format(settings[k])}×`}</output>
    </label>
  );
}
