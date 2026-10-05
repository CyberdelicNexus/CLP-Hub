import type { CSSProperties } from "react";
import Image from "next/image";
import { Signal } from "@/components/landing/signal";
import { LANDING_ES, STAGE_LIGHT_SPOTS, type LandingCopy } from "@/content/landing/clear-light";

/**
 * Section 4. The programme stages S0 to S6, distinct from the onboarding steps
 * of section 5.
 *
 * Desktop with motion and scripting: one pinned stage (span 4.5 viewport
 * heights). Title upper-left, the active stage's image in the centre, its name
 * and description bottom-right above the timeline, and the small living light
 * travelling node to node along the timeline as the reader scrolls. Each stage
 * owns one seventh of the act; the cue windows overlap by ~15% of a stage so
 * the frame is never empty. The first cue greets (full at p = 0) and the last
 * holds (no ramp out), so the stage has a ground through both slides.
 *
 * Everywhere else: the same seven stages as an ordinary list, each fading up
 * as it arrives.
 *
 * `DESCRIPCION_ETAPAS` is not drawn as a marker here (D-061, the founder's
 * request); it still blocks publication through `missingContentList()`.
 */
/* Every translation has the same stages (tests/landing-content.test.ts). */
const N = LANDING_ES.STAGES.items.length;
const STEP = 1 / N;

/**
 * Cue window for stage k. Adjacent windows overlap by 2 * overlap and the ramps
 * (fractions of the window, per the engine's cue contract) cover exactly that
 * overlap, so one element fades out while the next fades in and they never sit
 * at full opacity together. Media cross-fades over a wider band than text so
 * two descriptions are not both legible at once.
 */
function cueFor(k: number, overlap: number): string {
  const from = k === 0 ? 0 : k * STEP - overlap;
  const to = k === N - 1 ? 1 : (k + 1) * STEP + overlap;
  const win = to - from;
  const rampIn = k === 0 ? 0 : (2 * overlap) / win;
  const rampOut = k === N - 1 ? 0 : (2 * overlap) / win;
  return `${from.toFixed(3)} ${to.toFixed(3)} ${rampIn.toFixed(3)} ${rampOut.toFixed(3)}`;
}
const MEDIA = 0.02;
const TEXT = 0.008;

/* A node is active over its stage's seventh of the act (landing.css
   `.timeline__node`); the first and last extend past the ends. Plain CSS
   variables, not an engine cue: a cue writes an inline transform, which would
   overwrite the dot's centring. */
const nodeWindow = (k: number) =>
  ({ "--from": k === 0 ? -1 : k * STEP, "--to": k === N - 1 ? 2 : (k + 1) * STEP }) as CSSProperties;

export function Stages({ copy }: { copy: LandingCopy }) {
  const { STAGES } = copy;
  return (
    <section id="etapas" className="etapas" aria-label={STAGES.heading}>
      <div className="cl-pinned" data-sc-act="pin" data-sc-span="4.5">
        <div data-sc-stage className="sc-stage stage stage--etapas">
          <div className="etapas__head">
            <h2 className="cl-title--md">{STAGES.heading}</h2>
            <p className="cl-lead">{STAGES.intro}</p>
          </div>

          <div className="etapas__media">
            {STAGES.items.map((s, k) => (
              <figure key={s.code} className="etapas__panel" data-sc-cue={cueFor(k, MEDIA)} data-sc-rise="0">
                <Image
                  src={s.media.src}
                  alt={s.media.alt}
                  width={s.media.width}
                  height={s.media.height}
                  sizes="(max-width: 1200px) 45vw, 38rem"
                  quality={90}
                />
              </figure>
            ))}
          </div>

          <div className="etapas__active">
            {STAGES.items.map((s, k) => (
              <div key={s.code} className="etapas__text" data-sc-cue={cueFor(k, TEXT)}>
                <span className="cl-eyebrow">{s.code}</span>
                <h3 className="etapas__name">{s.name}</h3>
                <p>{s.description}</p>
              </div>
            ))}
          </div>

          <div className="timeline" aria-hidden>
            <div className="timeline__track" />
            <ol className="timeline__nodes">
              {STAGES.items.map((s, k) => (
                <li key={s.code} className="timeline__node" style={nodeWindow(k)}>
                  <span className="timeline__dot" />
                  <span className="timeline__code">{s.code}</span>
                  <span className="timeline__name">{s.name}</span>
                </li>
              ))}
            </ol>
            {/* Above the nodes, so the light passes over each dot. */}
            <div className="timeline__glide">
              <Signal className="timeline__light" />
            </div>
          </div>
        </div>
      </div>

      <div className="cl-stacked cl-wrap" style={{ paddingBlock: "var(--sc-section)" }}>
        <h2 className="cl-title--md">{STAGES.heading}</h2>
        <p className="cl-lead" style={{ marginTop: "1rem", maxWidth: "40ch" }}>
          {STAGES.intro}
        </p>
        <ol className="etapas-list">
          {STAGES.items.map((s) => (
            /* The engine's flow reveal: image and text fade up once, as the
               item arrives, and never re-hide (D-061). */
            <li key={s.code} className="etapas-list__item" data-sc-in>
              <figure className="etapas-list__figure" data-light={STAGE_LIGHT_SPOTS[s.media.src]?.join(" ")}>
                <Image
                  src={s.media.src}
                  alt={s.media.alt}
                  width={s.media.width}
                  height={s.media.height}
                  sizes="(max-width: 640px) 100vw, 40vw"
                  quality={90}
                />
              </figure>
              <div>
                <span className="cl-eyebrow">{s.code}</span>
                <h3 className="etapas__name">{s.name}</h3>
                <p>{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
