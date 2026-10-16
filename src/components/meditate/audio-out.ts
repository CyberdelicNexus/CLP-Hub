/**
 * Where every sound of the breathing guide goes (D-120): one gentle limiter
 * in front of the speakers. Music, voice, breath and bowl each sit well below
 * full scale, but they can land together, and their sum past full scale is
 * heard as crackle. The limiter only acts on those peaks.
 */
const outputs = new WeakMap<BaseAudioContext, AudioNode>();

export function output(ctx: BaseAudioContext): AudioNode {
  let node = outputs.get(ctx);
  if (!node) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    outputs.set(ctx, (node = limiter));
  }
  return node;
}
