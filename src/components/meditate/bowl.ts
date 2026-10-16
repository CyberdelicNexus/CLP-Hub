import { output } from "./audio-out";

/**
 * The guide's tone (D-120): a synthesised singing bowl, in place of the plain
 * sine "beep" it began with.
 *
 * A bowl's overtones are not the harmonic series: measured bowls put their
 * next partials at about 2.7–2.9, 4.8–5.7 and 7.5–9.1 times the fundamental
 * (Archives of Acoustics, 2016). Each partial is drawn here as two sines a
 * fraction of a hertz apart, which gives the slow beating a real bowl has
 * from its slight asymmetry, and each decays on its own, the high ones first,
 * so the tone settles into a low hum. The onset is soft rather than struck,
 * and a low-pass takes the edge off the top: a cue to breathe, not an alert.
 */
const PARTIALS = [
  { ratio: 1, gain: 1, decay: 5.5, beat: 0.6 },
  { ratio: 2.78, gain: 0.38, decay: 3.6, beat: 1.1 },
  { ratio: 5.2, gain: 0.14, decay: 2.2, beat: 1.7 },
  { ratio: 8.4, gain: 0.05, decay: 1.3, beat: 2.3 },
] as const;
const ONSET = 0.06;
/** Headroom: several partials, and a new bowl can sound while the last still rings. */
const LEVEL = 0.12;

export function bowl(ctx: AudioContext, frequency: number, volume: number, delay = 0) {
  if (ctx.state !== "running") void ctx.resume();
  const t = ctx.currentTime + delay;

  const soften = ctx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 2800;
  soften.Q.value = 0.5;
  soften.connect(output(ctx));

  let longest = 0;
  for (const p of PARTIALS) {
    for (const side of [-1, 1]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency * p.ratio + (side * p.beat) / 2;
      const peak = (LEVEL * volume * p.gain) / 2;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + ONSET);
      // An exponential fall reads as a natural ring-out; it cannot reach 0, so it ends just above.
      gain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.0005, 1e-5), t + ONSET + p.decay);
      osc.connect(gain).connect(soften);
      osc.start(t);
      osc.stop(t + ONSET + p.decay + 0.05);
      longest = Math.max(longest, p.decay);
    }
  }
  // Let the filter go once the last partial has stopped.
  window.setTimeout(() => soften.disconnect(), (delay + ONSET + longest + 0.2) * 1000);
}
