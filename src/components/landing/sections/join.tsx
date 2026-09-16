import type { CSSProperties } from "react";
import Image from "next/image";
import { Signal } from "@/components/landing/signal";
import { JOIN } from "@/content/landing/clear-light";

/**
 * Section 5. How to join: questionnaire, conversation, cohort assignment.
 * This is the application process, not the S0 to S6 programme.
 *
 * Desktop: a pinned stage (span 3.2) with three states. Compact 01/02/03
 * numerals share a baseline with their labels; the active description sits in
 * a slot aligned to the label column; one photograph per state cross-fades
 * full-bleed behind a black fade that holds the copy side; the light rests
 * partly outside the top-right corner throughout.
 *
 * Elsewhere: a plain numbered list with the same three photographs.
 */
/* Wide ramps (front-loaded on the ramp fraction of each window) so one
   photograph dissolves into the next rather than cutting. */
const CUES = ["0 0.42 0 0.35", "0.34 0.72 0.32 0.32", "0.64 1 0.32 0"] as const;
/* Windows in act progress for the step colour (landing.css `.step`). The last
   step stays lit to the end of the act. */
const WINDOWS = [
  { from: -1, to: 0.36 },
  { from: 0.3, to: 0.7 },
  { from: 0.64, to: 2 },
] as const;

export function Join() {
  return (
    <section id="incorporarse" className="join" aria-label={JOIN.heading}>
      <div className="cl-pinned" data-sc-act="pin" data-sc-span="3.2">
        <div data-sc-stage className="sc-stage stage stage--join">
          <div className="join__media" aria-hidden>
            {JOIN.steps.map((s, k) => (
              <div key={s.numeral} className="join__visual" data-sc-cue={CUES[k]} data-sc-rise="0">
                <Image src={s.visual.src} alt="" fill sizes="100vw" quality={90} />
              </div>
            ))}
            <div className="join__scrim" />
            <Signal className="join__light" breath />
          </div>

          <div className="join__copy">
            <h2 className="cl-title--md">{JOIN.heading}</h2>
            <ol className="steps">
              {JOIN.steps.map((s, k) => (
                <li key={s.numeral} className="step" style={{ "--from": WINDOWS[k].from, "--to": WINDOWS[k].to } as CSSProperties}>
                  <span className="step__num">{s.numeral}</span>
                  <span className="step__label">{s.label}</span>
                </li>
              ))}
            </ol>
            <div className="steps__desc">
              {JOIN.steps.map((s, k) => (
                <p
                  key={s.numeral}
                  className="steps__body"
                  data-sc-cue={CUES[k]}
                  style={{ "--from": WINDOWS[k].from, "--to": WINDOWS[k].to } as CSSProperties}
                >
                  {s.body}
                </p>
              ))}
            </div>
            <p className="join__supporting">{JOIN.supporting}</p>
          </div>
        </div>
      </div>

      <div className="cl-stacked cl-wrap" style={{ paddingBlock: "var(--sc-section)" }}>
        <h2 className="cl-title--md">{JOIN.heading}</h2>
        {/* One card per step: the photograph is the card's ground and the copy
            sits over it, numeral first, so the three read as equal blocks
            instead of text with a picture hanging under it (D-061). */}
        <ol className="join-list">
          {JOIN.steps.map((s) => (
            <li key={s.numeral} className="join-list__item" data-sc-in>
              <figure className="join-list__figure">
                <Image src={s.visual.src} alt={s.visual.alt} fill sizes="(max-width: 640px) 100vw, 26rem" quality={90} />
              </figure>
              <div className="join-list__copy">
                <span className="step__num">{s.numeral}</span>
                <h3>{s.label}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="join__supporting">{JOIN.supporting}</p>
      </div>
    </section>
  );
}
