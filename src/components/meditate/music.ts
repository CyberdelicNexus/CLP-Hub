import { output } from "./audio-out";

/**
 * Background music, and the opening and closing sounds, for the breathing
 * guide (D-120). One <audio> element each, so a long file streams rather than
 * downloading whole first.
 *
 * Its loudness is the facilitator's volume × a fade (in when a session
 * starts, out when it pauses or ends), and nothing else: the music keeps one
 * level under the voice, since dipping it for every word made the sound rise
 * and fall all session (founder's review). The sound goes through Web Audio, whose gain works everywhere (an iPhone ignores
 * an element's `volume`). That is possible because every track is the site's
 * own or a file from the device, never another site's.
 */
const STEP_MS = 50;

export class Music {
  private el: HTMLAudioElement;
  private gain: GainNode;
  private volume = 0.5;
  private fade = 0;
  private fadeTarget = 0;
  private fadeStep = 0;
  private timer = 0;
  private src = "";

  constructor(
    private ctx: AudioContext,
    private onError: () => void,
    loop = true,
  ) {
    this.el = new Audio();
    this.el.loop = loop;
    this.el.preload = "none";
    this.el.addEventListener("error", () => {
      if (this.el.getAttribute("src")) this.onError();
    });
    this.gain = ctx.createGain();
    ctx.createMediaElementSource(this.el).connect(this.gain).connect(output(ctx));
  }

  setSource(src: string) {
    if (src === this.src) return;
    this.src = src;
    const playing = !this.el.paused;
    this.el.src = src;
    this.apply();
    if (playing) void this.el.play().catch(() => {});
  }

  setVolume(v: number) {
    this.volume = v;
    this.apply();
  }

  /** Fades to full and plays. */
  start(seconds = 4) {
    if (!this.src) return;
    if (this.ctx.state !== "running") void this.ctx.resume();
    void this.el.play().catch(() => {});
    this.fadeTo(1, seconds);
  }

  /** Fades out, then pauses where it is. */
  stop(seconds = 1.5) {
    this.fadeTo(0, seconds, () => this.el.pause());
  }

  /** Back to the beginning of the track, silent. */
  rewind() {
    this.el.pause();
    this.fade = this.fadeTarget = 0;
    try {
      this.el.currentTime = 0;
    } catch {}
    this.apply();
  }

  dispose() {
    window.clearInterval(this.timer);
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
  }

  private fadeTo(target: number, seconds: number, then?: () => void) {
    window.clearInterval(this.timer);
    this.fadeTarget = target;
    this.fadeStep = Math.abs(target - this.fade) / Math.max(1, (seconds * 1000) / STEP_MS);
    this.timer = window.setInterval(() => {
      const d = this.fadeTarget - this.fade;
      this.fade = Math.abs(d) <= this.fadeStep ? this.fadeTarget : this.fade + Math.sign(d) * this.fadeStep;
      this.apply();
      if (this.fade === this.fadeTarget) {
        window.clearInterval(this.timer);
        then?.();
      }
    }, STEP_MS);
  }

  private apply() {
    // Squared, so the fade sounds even to the ear rather than rushing at the start.
    const level = Math.min(1, Math.max(0, this.volume * this.fade * this.fade));
    this.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.08);
  }
}
