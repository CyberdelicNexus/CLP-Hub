import Image from "next/image";
import { Missing } from "@/components/landing/missing";
import { Signal } from "@/components/landing/signal";
import { StageMedia } from "@/components/landing/stage-media";
import { STAGES } from "@/content/landing/clear-light";

/**
 * Section 4. The programme stages S0 to S6, distinct from the onboarding steps
 * of section 5.
 *
 * Desktop with motion and scripting: one pinned stage (span 4.5 viewport
 * heights). Title upper-left, the active stage's still or clip in the centre,
 * its name and description bottom-right above the timeline, and the small
 * living light travelling node to node along the timeline as the reader
 * scrolls. Each stage owns one seventh of the act; the cue windows overlap by
 * ~15% of a stage so the frame is never empty. The first cue greets (full at
 * p = 0) and the last holds (no ramp out), so the stage has a ground through
 * both slides.
 *
 * Everywhere else: the same seven stages as an ordinary list.
 */
const N = STAGES.items.length;
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

export function Stages() {
  return (
    <section id="etapas" className="etapas" aria-label={STAGES.heading}>
      <div className="cl-pinned" data-sc-act="pin" data-sc-span="4.5">
        <StageMedia className="sc-stage stage stage--etapas" stageCount={N}>
          <div className="etapas__head">
            <h2 className="cl-title--md">{STAGES.heading}</h2>
            <p className="cl-lead">{STAGES.intro}</p>
          </div>

          <div className="etapas__media">
            {STAGES.items.map((s, k) => (
              <figure key={s.code} className="etapas__panel" data-sc-cue={cueFor(k, MEDIA)} data-sc-rise="0">
                <Image src={s.media.poster} alt={s.media.alt} width={720} height={720} sizes="(max-width: 1200px) 40vw, 34rem" />
                {s.media.clip ? (
                  <video data-stage-index={k} loop playsInline preload="none" poster={s.media.poster} aria-hidden tabIndex={-1}>
                    <source src={s.media.clip} type="video/mp4" />
                  </video>
                ) : null}
              </figure>
            ))}
          </div>

          <div className="etapas__active">
            {STAGES.items.map((s, k) => (
              <div key={s.code} className="etapas__text" data-sc-cue={cueFor(k, TEXT)}>
                <span className="cl-eyebrow">{s.code}</span>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
              </div>
            ))}
          </div>

          <div className="timeline" aria-hidden>
            <div className="timeline__track">
              <Signal className="timeline__light" />
            </div>
            <ol className="timeline__nodes">
              {STAGES.items.map((s, k) => (
                <li key={s.code} className="timeline__node">
                  <span className="timeline__dot" />
                  <span className="timeline__lit" data-sc-cue={cueFor(k, TEXT)} data-sc-rise="0" />
                  <span className="timeline__code">{s.code}</span>
                  <span className="timeline__name">{s.name}</span>
                </li>
              ))}
            </ol>
          </div>
        </StageMedia>
      </div>

      <div className="cl-stacked cl-wrap" style={{ paddingBlock: "var(--sc-section)" }}>
        <h2 className="cl-title--md">{STAGES.heading}</h2>
        <p className="cl-lead" style={{ marginTop: "1rem", maxWidth: "40ch" }}>
          {STAGES.intro}
        </p>
        <ol className="etapas-list">
          {STAGES.items.map((s) => (
            <li key={s.code} className="etapas-list__item">
              <figure className="etapas-list__figure">
                <Image src={s.media.poster} alt={s.media.alt} fill sizes="(max-width: 640px) 100vw, 40vw" />
              </figure>
              <div>
                <span className="cl-eyebrow">{s.code}</span>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p style={{ marginTop: "2rem" }}>
          <Missing item={STAGES.approval} />
        </p>
      </div>
    </section>
  );
}
