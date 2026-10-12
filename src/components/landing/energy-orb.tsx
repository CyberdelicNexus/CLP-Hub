"use client";

import { useEffect, useRef } from "react";

/**
 * The home page's light as a particle of energy (D-105): a white-blue centre
 * inside a cloud whose edge is never quite round and never quite still. A
 * small WebGL canvas, since the cloud is noise that drifts every frame.
 *
 * It only draws the texture. The breath (the swelling and settling) is the CSS
 * animation on its wrapper in home.css, so the rhythm holds without this
 * script, and a plain CSS light shows where WebGL is missing: the canvas marks
 * its wrapper `data-orb` only once it has actually drawn.
 *
 * Same two motion switches as the starfield: `prefers-reduced-motion` draws
 * one frame, and "Pausar animación" (`data-still` on the root) holds the cloud
 * where it is.
 */
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// highp, not mediump (D-112). A laptop computes mediump at full precision
// anyway, so it looked right there; a phone really does use 16-bit floats, and
// at that precision the noise below breaks into coarse blocks: the cloud went
// blocky and the core was pushed off its centre.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv;
  float t = uTime;

  float d = length(p);

  // Push each point by a slow, broad field before measuring its distance from
  // the centre: that is what makes the outline uneven instead of a circle. The
  // push grows with distance, so the bright centre stays where it is.
  vec2 warp = vec2(fbm(p * 1.25 + vec2(t * 0.09, -t * 0.06)), fbm(p * 1.25 + vec2(-t * 0.07, t * 0.08) + 31.7)) - 0.47;
  vec2 q = p + warp * 0.42 * smoothstep(0.04, 0.4, d);
  float r = length(q);

  float cloud = fbm(q * 3.1 + vec2(-t * 0.16, t * 0.12));
  float wisp = fbm(q * 6.3 + vec2(t * 0.21, t * 0.17) + 7.7);

  // D-113: a body with an edge. The light used to thin out into cloud for as
  // far as the canvas went; now it is one compact shape that ends, softly but
  // in one place (edge), with the cloud kept as texture inside it and as a
  // thin fringe just outside. The nucleus is measured from the true centre, so
  // it stays round and sharp whatever the body does.
  float edge = 0.41 + 0.045 * (wisp - 0.5);
  float fill = smoothstep(edge, edge * 0.5, r);
  float body = fill * (0.68 + 0.46 * smoothstep(0.25, 0.8, cloud));
  float fringe = smoothstep(edge * 1.28, edge * 0.85, r) * (0.25 + 0.75 * smoothstep(0.3, 0.75, wisp));
  float glow = exp(-r * r * 11.0);
  float core = exp(-r * r * 50.0);
  float nucleus = exp(-d * d * 150.0);

  vec3 col = vec3(1.0, 1.0, 1.0) * nucleus * 1.5
    + vec3(0.93, 0.96, 1.0) * core * 0.9
    + vec3(0.72, 0.78, 1.0) * glow * 0.55
    + vec3(0.52, 0.57, 1.0) * body * 0.58
    + vec3(0.3, 0.27, 0.82) * fringe * 0.22;
  // A soft shoulder instead of a clipped white disc.
  col = 1.0 - exp(-col * 1.5);

  // Nothing may reach the square's edge.
  col *= smoothstep(1.0, 0.55, d);
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

export function EnergyOrb({ rootId }: { rootId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    // Without full-precision floats the cloud cannot be drawn properly: leave the plain CSS light.
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

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(program, "uTime");

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw = (seconds: number) => {
      size();
      gl.uniform1f(uTime, seconds);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const root = document.getElementById(rootId);
    const wrapper = canvas.parentElement;
    // An arbitrary moment: a good-looking cloud for the frame that never moves.
    let clock = 40;
    draw(clock);
    wrapper?.setAttribute("data-orb", "");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const onResize = () => draw(clock);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (document.hidden || root?.hasAttribute("data-still")) return;
      clock += dt;
      draw(clock);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      wrapper?.removeAttribute("data-orb");
    };
  }, [rootId]);

  return <canvas ref={ref} className="breath__cloud" aria-hidden />;
}
