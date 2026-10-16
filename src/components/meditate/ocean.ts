import { output } from "./audio-out";

/**
 * Ocean waves that move with the breath (D-120, founder's choice in place of
 * a breathing sound). One recording of the sea (`music/sfx/ocean.mp3`, three
 * minutes, looped and streamed) plays all session; as the breath comes in the
 * waves swell, louder and brighter, like a wave coming up the shore, and as it
 * goes out they draw back, quieter and darker. The holds keep them where they
 * are. "Brighter" is a low-pass that opens: a wave breaking close has its
 * hiss, one drawing back is a low rumble.
 *
 * Follows the light's own eased level (meditate.tsx), so the sound and the
 * light can never drift apart.
 */
export const OCEAN_SRC = "/audio/meditate/music/sfx/ocean.mp3";
/** Loudness at an empty breath and at a full one, as shares of the volume. */
const LOW = 0.3;
const HIGH = 1;
/** The low-pass at an empty breath and at a full one. */
const DARK_HZ = 450;
const BRIGHT_HZ = 7000;
const STEP_MS = 50;

export class Ocean {
  private el: HTMLAudioElement;
  private breath: GainNode;
  private fade: GainNode;
  private filter: BiquadFilterNode;
  private timer = 0;
  private last = -1;

  constructor(private ctx: AudioContext) {
    this.el = new Audio(OCEAN_SRC);
    this.el.loop = true;
    this.el.preload = "none";
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.4;
    this.breath = ctx.createGain();
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    ctx.createMediaElementSource(this.el).connect(this.filter).connect(this.breath).connect(this.fade).connect(output(ctx));
    this.follow(0.3, 0.5);
  }

  /** Sets the waves to how full the breath is (0 to 1), at the panel's volume. Cheap to call every frame. */
  follow(level: number, volume: number) {
    const key = Math.round(level * 100) + volume * 1000;
    if (key === this.last) return;
    this.last = key;
    const now = this.ctx.currentTime;
    this.breath.gain.setTargetAtTime(volume * (LOW + (HIGH - LOW) * level), now, 0.12);
    this.filter.frequency.setTargetAtTime(DARK_HZ * Math.pow(BRIGHT_HZ / DARK_HZ, level), now, 0.12);
  }

  start(seconds = 3) {
    if (this.ctx.state !== "running") void this.ctx.resume();
    void this.el.play().catch(() => {});
    this.ramp(1, seconds);
  }

  stop(seconds = 1.5) {
    this.ramp(0, seconds, () => this.el.pause());
  }

  dispose() {
    window.clearTimeout(this.timer);
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
  }

  private ramp(to: number, seconds: number, then?: () => void) {
    window.clearTimeout(this.timer);
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(this.fade.gain.value, now);
    this.fade.gain.linearRampToValueAtTime(to, now + seconds);
    if (then) this.timer = window.setTimeout(then, seconds * 1000 + STEP_MS);
  }
}
