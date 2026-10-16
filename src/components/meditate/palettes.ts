import type { Palette } from "@/domain/breathing";
import type { OrbColors } from "./breath-orb";

/**
 * Colours of the light and the ground behind it (D-120). "numadelic" is the
 * home page's light exactly (energy-orb.tsx and home.css); the others keep its
 * structure (a near-white centre, a coloured body, a deeper fringe) in other hues.
 * `a` and `b` are the two side lights of the background and the glow, as
 * "r g b" for CSS: `a` from the lower left, `b` from the upper right.
 */
export const PALETTE_COLORS: Record<Palette, { orb: OrbColors; a: string; b: string; swatch: string }> = {
  numadelic: {
    orb: { nucleus: [1, 1, 1], core: [0.93, 0.96, 1], halo: [0.72, 0.78, 1], body: [0.52, 0.57, 1], fringe: [0.3, 0.27, 0.82] },
    a: "74 122 255",
    b: "150 112 255",
    swatch: "linear-gradient(135deg, #4a7aff, #9670ff)",
  },
  aurora: {
    orb: { nucleus: [1, 1, 1], core: [0.9, 1, 0.97], halo: [0.6, 0.95, 0.88], body: [0.3, 0.78, 0.72], fringe: [0.18, 0.42, 0.78] },
    a: "48 196 170",
    b: "70 120 255",
    swatch: "linear-gradient(135deg, #30c4aa, #4678ff)",
  },
  dawn: {
    orb: { nucleus: [1, 1, 0.98], core: [1, 0.96, 0.9], halo: [1, 0.8, 0.62], body: [0.98, 0.58, 0.44], fringe: [0.74, 0.28, 0.5] },
    a: "255 140 96",
    b: "196 84 160",
    swatch: "linear-gradient(135deg, #ff8c60, #c454a0)",
  },
  lavender: {
    orb: { nucleus: [1, 1, 1], core: [0.99, 0.95, 1], halo: [0.88, 0.78, 1], body: [0.74, 0.56, 0.96], fringe: [0.52, 0.3, 0.82] },
    a: "183 156 255",
    b: "219 168 238",
    swatch: "linear-gradient(135deg, #b79cff, #dba8ee)",
  },
  moon: {
    orb: { nucleus: [1, 1, 1], core: [0.96, 0.97, 1], halo: [0.84, 0.86, 0.92], body: [0.64, 0.67, 0.78], fringe: [0.4, 0.42, 0.56] },
    a: "150 165 200",
    b: "190 196 220",
    swatch: "linear-gradient(135deg, #96a5c8, #bec4dc)",
  },
};
