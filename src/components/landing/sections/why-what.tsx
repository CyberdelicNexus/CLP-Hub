import { FilmPlayer } from "@/components/landing/film-player";
import { Signal } from "@/components/landing/signal";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Sections 2 and 3. Their copy is shared by the desktop opening sequence
 * (opening.tsx), where the clip's orb is the light, and by the stacked flow
 * sections below, where one light rests across their seam: half outside the
 * bottom centre of "El porqué", which is half outside the top centre of
 * "El qué". One element, one diameter token (--cl-light).
 */
/* `data-reading-block` marks a block for the stacked variant's reading light
   (reading-light.tsx). It does nothing in the pinned opening sequence, whose
   own wipes reveal the same copy. */
export function WhyCopy({ copy, titleId }: { copy: LandingCopy; titleId?: string }) {
  const { WHY } = copy;
  return (
    <>
      <h2 id={titleId} className="cl-title" data-reading-block>
        {WHY.headline}
      </h2>
      <p className="cl-lead porque__body" data-reading-block>
        {WHY.body}
      </p>
    </>
  );
}

export function WhatCopy({ copy, titleId }: { copy: LandingCopy; titleId?: string }) {
  const { WHAT } = copy;
  return (
    <>
      <h2 id={titleId} className="cl-title" data-reading-block>
        {WHAT.headline}
      </h2>
      <p className="cl-lead que__body" data-reading-block>
        {WHAT.body}
      </p>
      <ul className="facts" data-reading-block>
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

export function Why({ copy }: { copy: LandingCopy }) {
  return (
    <section id="porque" data-anchor-stacked="porque" className="porque" aria-labelledby="porque-title">
      <div className="porque__inner">
        <WhyCopy copy={copy} titleId="porque-title" />
      </div>
      <Signal className="porque__light" breath />
    </section>
  );
}

export function What({ copy, lang }: { copy: LandingCopy; lang: string }) {
  return (
    <section id="que" data-anchor-stacked="que" className="que" aria-labelledby="que-title">
      <div className="que__grid">
        <div>
          <WhatCopy copy={copy} titleId="que-title" />
        </div>
        <div data-reading-block>
          <WhatFilm copy={copy} lang={lang} />
        </div>
      </div>
    </section>
  );
}
