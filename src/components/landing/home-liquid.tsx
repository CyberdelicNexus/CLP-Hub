"use client";

import { useState, useSyncExternalStore } from "react";
import { Liquid, type LiquidOptions } from "@/components/canvasui/Liquid";

/**
 * The home page's pointer-driven fluid (D-105), and the panel for tuning it.
 *
 * LIQUID_SETTINGS below is what every visitor gets. To find better values,
 * open the page with `?liquid` in the address (for example `/?liquid`): a
 * panel appears with every parameter of the simulation, changes apply live,
 * and "Copy values" puts the result on the clipboard to paste back here. The
 * panel changes nothing for anyone else and stores nothing.
 */
type Settings = Required<LiquidOptions> & { opacity: number };

export const LIQUID_SETTINGS: Settings = {
  /** Resolution of the simulation grid. */
  simResolution: 256,
  /** Resolution of the fluid trail texture. */
  dyeResolution: 512,
  /** How much the trail persists each frame (closer to 1 lasts longer). */
  densityDissipation: 0.888,
  /** How much motion persists each frame (closer to 1 lasts longer). */
  velocityDissipation: 0.8,
  /** How much pressure carries over between frames. */
  pressure: 0,
  /** Pressure solver iterations. */
  pressureIterations: 1,
  /** Rotational force added back into the flow. */
  curl: 1.9,
  /** Radius of the pointer splat. */
  radius: 0.09,
  /** Force multiplier applied on pointer movement. */
  force: 3.4,
  /** Strength of the color tint left by the flow. */
  intensity: 0.45,
  /** How strongly the flow warps the content. Only where the browser can draw HTML into a canvas. */
  distortion: 2,
  /** How much of the fluid color blends over the content. Same condition as `distortion`. */
  blend: 20,
  /** Body color of the trail as [r, g, b] in 0-1 range. Ignored when rainbow is on. */
  color: [0.384, 0.122, 1],
  /** Color the trail from the flow direction instead of a fixed color. */
  rainbow: false,
  /** Color where the trail is densest: the bright inside. */
  coreColor: [0, 0, 0],
  /** Color where the trail thins out. */
  edgeColor: [1, 1, 1],
  /** How far the dense core is pushed past its color towards white (0 is off). */
  glow: 4.9,
  /** How tight the bright core is: 1 follows the density, higher keeps it to the densest part. */
  fade: 7.55,
  /** Amount of cloud texture in the trail, 0 (smooth) to 1. */
  texture: 0,
  /** Size of the cloud texture: higher is finer. */
  textureScale: 0.5,
  /** How fast the cloud texture drifts. */
  textureSpeed: 0,
  /** Opacity of the whole layer over the starfield. Not a simulation parameter. */
  opacity: 0.22,
};

type NumericKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const SLIDERS: readonly { key: NumericKey; min: number; max: number; step: number }[] = [
  { key: "force", min: 0, max: 5, step: 0.05 },
  { key: "radius", min: 0.01, max: 1, step: 0.01 },
  { key: "curl", min: 0, max: 10, step: 0.1 },
  { key: "intensity", min: 0, max: 5, step: 0.05 },
  { key: "glow", min: 0, max: 8, step: 0.05 },
  { key: "fade", min: 0.2, max: 8, step: 0.05 },
  { key: "texture", min: 0, max: 1, step: 0.01 },
  { key: "textureScale", min: 0.5, max: 14, step: 0.1 },
  { key: "textureSpeed", min: 0, max: 1, step: 0.01 },
  { key: "densityDissipation", min: 0.8, max: 1, step: 0.001 },
  { key: "velocityDissipation", min: 0.8, max: 1, step: 0.001 },
  { key: "pressure", min: 0, max: 1, step: 0.01 },
  { key: "pressureIterations", min: 1, max: 40, step: 1 },
  { key: "opacity", min: 0, max: 1, step: 0.01 },
  { key: "distortion", min: 0, max: 2, step: 0.01 },
  { key: "blend", min: 0, max: 20, step: 0.1 },
];
const RESOLUTIONS: readonly { key: "simResolution" | "dyeResolution"; values: readonly number[] }[] = [
  { key: "simResolution", values: [32, 64, 128, 256] },
  { key: "dyeResolution", values: [128, 256, 512, 1024] },
];

const COLORS = ["edgeColor", "color", "coreColor"] as const;

const toHex = (rgb: readonly number[]) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
const fromHex = (hex: string) =>
  [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000) as [number, number, number];

const noSubscription = () => () => {};
const wantsPanel = () => new URLSearchParams(window.location.search).has("liquid");

export function HomeLiquid() {
  const [settings, setSettings] = useState<Settings>(LIQUID_SETTINGS);
  const [copied, setCopied] = useState(false);
  const tuning = useSyncExternalStore(noSubscription, wantsPanel, () => false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setCopied(false);
    setSettings((s) => ({ ...s, [key]: value }));
  };
  const { opacity, ...options } = settings;

  return (
    <>
      {/* Behind the page, fixed to the viewport. It listens on the window, so it needs no pointer events of its own. */}
      <div className="home__liquid" style={{ opacity }} aria-hidden>
        <Liquid style={{ position: "absolute", inset: 0 }} {...options}>
          <span />
        </Liquid>
      </div>

      {tuning ? (
        // A tool for whoever is tuning the effect, not part of the page: English only.
        <details className="liquid-panel" open lang="en">
          <summary>Liquid</summary>
          <div className="liquid-panel__body">
            {SLIDERS.map(({ key, min, max, step }) => (
              <label key={key} className="liquid-panel__row">
                <span>{key}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={settings[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                />
                <output>{settings[key]}</output>
              </label>
            ))}
            {RESOLUTIONS.map(({ key, values }) => (
              <label key={key} className="liquid-panel__row">
                <span>{key}</span>
                <select value={settings[key]} onChange={(e) => set(key, Number(e.target.value))}>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {COLORS.map((key) => (
              <label key={key} className="liquid-panel__row">
                <span>{key}</span>
                <input type="color" value={toHex(settings[key])} onChange={(e) => set(key, fromHex(e.target.value))} />
                <output>{settings[key].join(", ")}</output>
              </label>
            ))}
            <label className="liquid-panel__row">
              <span>rainbow</span>
              <input type="checkbox" checked={settings.rainbow} onChange={(e) => set("rainbow", e.target.checked)} />
            </label>
            <div className="liquid-panel__actions">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(JSON.stringify(settings, null, 2)).then(() => setCopied(true));
                }}
              >
                {copied ? "Copied" : "Copy values"}
              </button>
              <button type="button" onClick={() => setSettings(LIQUID_SETTINGS)}>
                Reset
              </button>
            </div>
          </div>
        </details>
      ) : null}
    </>
  );
}
