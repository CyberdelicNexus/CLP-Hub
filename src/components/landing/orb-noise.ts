/**
 * The noise inside the light (energy-orb.tsx, breath-orb.tsx), read from a
 * small image of random values instead of computed in the shader (D-126).
 *
 * The shader used to make its random values with arithmetic on large numbers
 * (`fract(p * 456.21)`). That only joins up across the noise's grid if the GPU
 * gets exactly the same answer for a grid point from both sides of it; some
 * phone GPUs round differently, and the light broke into square blocks there
 * (David's Android phone, 2026-10-21) while looking right on others. Reading a
 * pixel of an image gives every GPU the same value for the same point, so the
 * seams cannot appear. The image is seeded, so the cloud has the same pattern
 * on every visit.
 */

const SIZE = 256;

/**
 * GLSL for `noise(p)` (smooth value noise, 0 to 1) and `fbm(p)` (five octaves of
 * it), reading `uNoise`. The fbm is the one the light always had, so the cloud
 * keeps its scale and drift.
 */
export const NOISE_GLSL = `
uniform sampler2D uNoise;
float lattice(vec2 i) {
  return texture2D(uNoise, (mod(i, ${SIZE}.0) + 0.5) / ${SIZE}.0).r;
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lattice(i), lattice(i + vec2(1.0, 0.0)), u.x), mix(lattice(i + vec2(0.0, 1.0)), lattice(i + vec2(1.0, 1.0)), u.x), u.y);
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
}`;

/** mulberry32: a tiny seeded generator, so the pattern is the same every time. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uploads the noise image to texture unit 0 and points the program's `uNoise` at it. */
export function bindNoise(gl: WebGLRenderingContext, program: WebGLProgram) {
  const next = random(0x6e756d61);
  const values = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < values.length; i++) values[i] = Math.floor(next() * 256);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SIZE, SIZE, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, values);
  // One exact pixel per grid point: no blending between pixels, no repeat (the shader wraps).
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, "uNoise"), 0);
}
