import { FilmPlayer } from "@/components/landing/film-player";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Sections 2 and 3 content, shared by both variants below. No reveal
 * attribute of its own (D-079): the pinned variant drives its reveal via
 * `data-sc-cue` on the panel that wraps this, and the stacked variant adds
 * its own `data-sc-in` where it renders these.
 */
export function WhyCopy({ copy, titleId }: { copy: LandingCopy; titleId?: string }) {
  const { WHY } = copy;
  return (
    <>
      <h2 id={titleId} className="cl-title">
        {WHY.headline}
      </h2>
      <p className="cl-lead porque__body">{WHY.body}</p>
    </>
  );
}

export function WhatCopy({ copy, titleId }: { copy: LandingCopy; titleId?: string }) {
  const { WHAT } = copy;
  return (
    <>
      <h2 id={titleId} className="cl-title">
        {WHAT.headline}
      </h2>
      <p className="cl-lead que__body">{WHAT.body}</p>
      <ul className="facts">
        {WHAT.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </>
  );
}

export function WhatFilm({ copy, lang }: { copy: LandingCopy; lang: string }) {
  const { WHAT } = copy;
  return (
    <FilmPlayer
      youtubeId="yCyCmNLmMd4"
      poster="/landing/media/film-poster-v2.webp"
      alt={WHAT.film.posterAlt}
      label={WHAT.film.label}
      playLabel={WHAT.film.play}
      consent={copy.CONSENT}
      lang={lang}
    />
  );
}

/**
 * Cue window for panel k of 2. Adjacent windows overlap by 2*OVERLAP and the
 * ramps cover exactly that overlap, so "El porqué" is fully readable, then
 * dissolves as "El qué" dissolves in over the same stretch of scroll, and
 * "El qué" then holds. Same formula stages.tsx uses for its own cues.
 */
const OVERLAP = 0.14;
/**
 * "El porqué" fades in over the first FADE_IN of the pin instead of being
 * opaque from p = 0. Progress is 0 for the whole entry slide (the stage is
 * still scrolling up into place), so an opaque panel would be seen travelling
 * up from below; at opacity 0 it is only revealed once the stage has landed.
 * landing.css offsets the `#porque` anchor by the same amount so a jump to it
 * arrives already faded in.
 */
const FADE_IN = 0.1;
function cueFor(k: 0 | 1): string {
  const from = k === 0 ? 0 : 0.5 - OVERLAP;
  const to = k === 0 ? 0.5 + OVERLAP : 1;
  const win = to - from;
  const rampIn = k === 0 ? FADE_IN / win : (2 * OVERLAP) / win;
  const rampOut = k === 0 ? (2 * OVERLAP) / win : 0;
  return `${from.toFixed(3)} ${to.toFixed(3)} ${rampIn.toFixed(3)} ${rampOut.toFixed(3)}`;
}

/**
 * Sections 2 and 3 (D-079, replacing D-078's plain flow): one pinned stage,
 * "El porqué" and "El qué" sharing the same screen position and crossfading
 * between them — team feedback, "instead of the second section text moving
 * up and down, it should stay put and only gets revealed and dissolved, then
 * the next section is revealed in the same position."
 *
 * Built from the same vendored primitives `stages.tsx` already uses for its
 * own crossfade (`data-sc-act="pin"`, `data-sc-cue` windows), not new
 * bespoke script: `data-sc-rise="0"` is the engine's own way to say "opacity
 * only, no vertical drift" (it multiplies the rise distance by this value).
 * No video, no scroll hold — the engine just reads scroll position and
 * writes `opacity`/`pointer-events` on each panel.
 *
 * The seam light that used to sit between these two sections is gone
 * (D-079, team feedback, "remove the light orb from the section with the
 * video") and not replaced; nothing else here fills that role.
 */
export function WhyWhat({ copy, lang }: { copy: LandingCopy; lang: string }) {
  return (
    <div id="porque" className="porque-que">
      <div className="cl-pinned" data-sc-act="pin" data-sc-span="2">
        <div data-sc-stage className="sc-stage stage stage--porque-que">
          <div className="porque-que__panel porque-que__panel--why" data-sc-cue={cueFor(0)} data-sc-rise="0">
            <div className="porque__inner">
              <WhyCopy copy={copy} titleId="porque-title" />
            </div>
          </div>
          <div className="porque-que__panel porque-que__panel--what" data-sc-cue={cueFor(1)} data-sc-rise="0">
            <div className="que__grid">
              <div>
                <WhatCopy copy={copy} titleId="que-title" />
              </div>
              <div>
                <WhatFilm copy={copy} lang={lang} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cl-stacked">
        <section className="porque" aria-labelledby="porque-title-stacked">
          <div className="porque__inner" data-sc-in>
            <WhyCopy copy={copy} titleId="porque-title-stacked" />
          </div>
        </section>
        <section className="que" aria-labelledby="que-title-stacked">
          <div className="que__grid">
            <div data-sc-in>
              <WhatCopy copy={copy} titleId="que-title-stacked" />
            </div>
            <div data-sc-in>
              <WhatFilm copy={copy} lang={lang} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
