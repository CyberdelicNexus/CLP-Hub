"use client";

import { useEffect, useRef } from "react";
import { bindNoise, NOISE_GLSL } from "@/components/landing/orb-noise";

/**
 * The home page's light (energy-orb.tsx) with its colours, glow and drift
 * made adjustable for the breathing guide (D-120). The shader is the same
 * body-with-an-edge (D-113) at full precision (D-112), with the noise read
 * from an image (orb-noise.ts, D-126); the constants the home page bakes in
 * are uniforms here. The home page's own component is left as it is, so tuning
 * this one cannot change the home page.
 *
 * It draws only the texture; the guide scales its wrapper with the breath.
 * `level` (0 empty, 1 full) brightens the glow a little at the top of the breath.
 *
 * The shape is adjustable too (founder's review, 2026-10-20: David found the
 * noise in the light and the fluctuating edge too busy, and wanted it
 * symmetrical and still). Each of the home page's organic touches is a dial
 * that is 0 by default here, so the light is a round, even body that only
 * breathes; at 1 each is exactly as on the home page before D-126:
 * - `organic`: the slow warp that makes the outline uneven;
 * - `edge`: the fine irregularity of where the body ends;
 * - `texture`: the drifting cloud inside the body and its fringe.
 * `softness`, `core` and `fringe` shape the even light itself (1 as on the home page).
 */
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uGlow;
uniform float uLevel;
uniform vec3 uNucleus;
uniform vec3 uCore;
uniform vec3 uHalo;
uniform vec3 uBody;
uniform vec3 uFringe;
uniform float uOrganic;
uniform float uEdge;
uniform float uTexture;
uniform float uSoft;
uniform float uCoreAmt;
uniform float uFringeAmt;
${NOISE_GLSL}

void main() {
  vec2 p = vUv;
  float t = uTime;
  float d = length(p);

  vec2 warp = vec2(fbm(p * 1.25 + vec2(t * 0.09, -t * 0.06)), fbm(p * 1.25 + vec2(-t * 0.07, t * 0.08) + 31.7)) - 0.47;
  vec2 q = p + warp * 0.42 * uOrganic * smoothstep(0.04, 0.4, d);
  float r = length(q);

  float cloud = fbm(q * 3.1 + vec2(-t * 0.16, t * 0.12));
  float wisp = fbm(q * 6.3 + vec2(t * 0.21, t * 0.17) + 7.7);

  float edge = 0.41 + 0.045 * uEdge * (wisp - 0.5);
  float fill = smoothstep(edge, edge * (1.0 - 0.5 * uSoft), r);
  // With no texture the cloud is replaced by its average, so the body keeps its brightness.
  float body = fill * (0.68 + 0.46 * mix(0.5, smoothstep(0.25, 0.8, cloud), uTexture));
  float fringe = smoothstep(edge * 1.28, edge * 0.85, r) * (0.25 + 0.75 * mix(0.55, smoothstep(0.3, 0.75, wisp), uTexture));
  float glow = exp(-r * r * 11.0);
  float core = exp(-r * r * 50.0);
  float nucleus = exp(-d * d * 150.0);

  float lift = uGlow * (0.85 + 0.3 * uLevel);
  vec3 col = uNucleus * nucleus * 1.5 * uCoreAmt
    + uCore * core * 0.9 * uCoreAmt
    + uHalo * glow * 0.55 * lift
    + uBody * body * 0.58
    + uFringe * fringe * 0.22 * lift * uFringeAmt;
  col = 1.0 - exp(-col * 1.5);

  col *= smoothstep(1.0, 0.55, d);
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

type Rgb = readonly [number, number, number];
export interface OrbColors {
  nucleus: Rgb;
  core: Rgb;
  halo: Rgb;
  body: Rgb;
  fringe: Rgb;
}

/** The dials of the light's shape; see the comment at the top. */
export interface OrbShape {
  organic: number;
  edge: number;
  texture: number;
  softness: number;
  core: number;
  fringe: number;
}

export interface BreathOrbProps {
  colors: OrbColors;
  shape: OrbShape;
  glow: number;
  /** Multiplies the speed of the cloud; 0 holds it still. */
  drift: number;
  /** Holds the cloud where it is (paused, or reduced motion). */
  still: boolean;
  /** Read every frame: how full the breath is. */
  level: { current: number };
}

export function BreathOrb(props: BreathOrbProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });
  const { level } = props;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    if (!gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    bindNoise(gl, program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uTime = u("uTime");
    const uGlow = u("uGlow");
    const uLevel = u("uLevel");
    const shapeUniforms = (
      [
        ["organic", "uOrganic"],
        ["edge", "uEdge"],
        ["texture", "uTexture"],
        ["softness", "uSoft"],
        ["core", "uCoreAmt"],
        ["fringe", "uFringeAmt"],
      ] as const
    ).map(([key, name]) => [key, u(name)] as const);
    const colorUniforms = (["nucleus", "core", "halo", "body", "fringe"] as const).map(
      (key) => [key, u(`u${key[0].toUpperCase()}${key.slice(1)}`)] as const,
    );

    const draw = (seconds: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      const { colors, glow, shape } = live.current;
      gl.uniform1f(uTime, seconds);
      gl.uniform1f(uGlow, glow);
      gl.uniform1f(uLevel, level.current);
      for (const [key, loc] of colorUniforms) gl.uniform3fv(loc, colors[key]);
      for (const [key, loc] of shapeUniforms) gl.uniform1f(loc, shape[key]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const wrapper = canvas.parentElement;
    let clock = 40;
    draw(clock);
    wrapper?.setAttribute("data-orb", "");

    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (document.hidden) return;
      const { still, drift } = live.current;
      if (!still) clock += dt * drift;
      // Drawn every frame even when still: the colours and glow follow the panel live.
      draw(clock);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      wrapper?.removeAttribute("data-orb");
    };
  }, [level]);

  return <canvas ref={ref} className="m-orb__cloud" aria-hidden />;
}
