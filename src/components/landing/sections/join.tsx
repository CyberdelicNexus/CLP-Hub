import type { CSSProperties } from "react";
import { JoinIllustration } from "@/components/landing/join-illustration";
import type { LandingCopy } from "@/content/landing/clear-light";

/** Desktop crossfades a drawing and description on the right of the step list.
 * Mobile, reduced motion and no-JS present the same steps in document flow. */
const CUES = ["0 0.42 0 0.35", "0.34 0.72 0.32 0.32", "0.64 1 0.32 0"] as const;
const WINDOWS = [
  { from: -1, to: 0.36 },
  { from: 0.3, to: 0.7 },
  { from: 0.64, to: 2 },
] as const;

export function Join({ copy }: { copy: LandingCopy }) {
  const { JOIN } = copy;
  return (
    <section id="incorporarse" className="join" aria-label={JOIN.heading}>
      <div className="cl-pinned" data-sc-act="pin" data-sc-span="3.2">
        <div data-sc-stage className="sc-stage stage stage--join">
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
            <p className="join__supporting">{JOIN.supporting}</p>
          </div>
          <div className="steps__desc">
            {JOIN.steps.map((s, k) => (
              <div key={s.numeral} className="steps__panel" data-sc-cue={CUES[k]} data-sc-rise="0">
                <JoinIllustration step={s.numeral} />
                <p className="steps__body">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cl-stacked cl-wrap join__stacked">
        <h2 className="cl-title--md">{JOIN.heading}</h2>
        <ol className="join-list">
          {JOIN.steps.map((s) => (
            <li key={s.numeral} className="join-list__item" data-sc-in>
              <div className="join-list__heading">
                <span className="step__num">{s.numeral}</span>
                <h3>{s.label}</h3>
              </div>
              <div className="join-list__detail">
                <JoinIllustration step={s.numeral} />
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
