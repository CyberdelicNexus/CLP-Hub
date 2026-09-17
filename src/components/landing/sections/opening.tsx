import type { CSSProperties } from "react";
import { LightSequence } from "@/components/landing/light-sequence";
import { ReadingLight } from "@/components/landing/reading-light";
import { Hero, HeroCopy, HeroMedia } from "@/components/landing/sections/hero";
import { WhatCopy, WhatFilm, Why, WhyCopy, What } from "@/components/landing/sections/why-what";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Sections 1 to 3 as one opening sequence.
 *
 * Desktop with motion and scripting: one pinned stage. The clip of the seven
 * light bodies sits exactly over the hero still. Scrolling does not scrub it;
 * it starts the next event (light-sequence.tsx): the bodies gather and the
 * hero copy dissolves, the light sinks and "El porqué" wipes in top-down, then
 * the light rises and "El qué" with its film wipes in bottom-up.
 *
 * Elsewhere: the hero and sections 2 and 3 as ordinary flow sections.
 *
 * The three anchors live in the act's scroll track, at a position inside each
 * state's scroll range, so #porque lands the reader in the porque state.
 * light-sequence.tsx moves the ids onto them only while the pinned stage is
 * the one showing; the server markup gives them to the stacked sections.
 */
const SPAN = 3.2;
const ANCHOR_P = { inicio: 0, porque: 0.2, que: 0.7 } as const;

const anchorTop = (p: number): CSSProperties => ({ top: `calc(${((SPAN - 1) * p).toFixed(3)} * 100svh)` });

export function Opening({ copy, lang }: { copy: LandingCopy; lang: string }) {
  return (
    <div className="opening" data-opening>
      <div className="cl-pinned opening__act" data-sc-act="pin" data-sc-span={SPAN}>
        <div data-sc-stage className="sc-stage stage stage--opening" data-state="inicio">
          <div className="op__panel op__hero" data-panel="inicio">
            <div className="hero__scrim" aria-hidden />
            <div className="hero__inner">
              <HeroCopy copy={copy} />
            </div>
          </div>

          {/* Here in document order so focus runs hero actions, then the film;
              it paints beneath the panels through z-index. */}
          <HeroMedia copy={copy} sequence={<LightSequence src="/landing/media/light-sequence.mp4" />} />

          <div className="op__panel op__why" data-panel="porque">
            <div className="op__reveal op__why-copy">
              <WhyCopy copy={copy} />
            </div>
          </div>

          <div className="op__panel op__what" data-panel="que">
            <div className="que__grid op__what-grid">
              <div className="op__reveal">
                <WhatCopy copy={copy} />
              </div>
              <div className="op__reveal">
                <WhatFilm copy={copy} lang={lang} />
              </div>
            </div>
          </div>
        </div>

        {(Object.keys(ANCHOR_P) as (keyof typeof ANCHOR_P)[]).map((name) => (
          <span key={name} className="op__anchor" data-anchor-pinned={name} style={anchorTop(ANCHOR_P[name])} aria-hidden />
        ))}
      </div>

      <div className="cl-stacked">
        <Hero copy={copy} />
        {/* The stacked variant has no wipes, so a reading light carries the eye
            through the same two sections instead (D-061). */}
        <ReadingLight>
          <Why copy={copy} />
          <What copy={copy} lang={lang} />
        </ReadingLight>
      </div>
    </div>
  );
}
