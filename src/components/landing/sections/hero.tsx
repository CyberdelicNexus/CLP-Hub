import Image from "next/image";
import { HeroReveal } from "@/components/landing/hero-reveal";
import { ACTIONS, HERO } from "@/content/landing/clear-light";

/**
 * Section 1. Identifies the page as research in the first line, then the
 * question. Seven soft light bodies sit in a shallow arc behind the copy; the
 * physical people (Quest 3 headsets and controllers) are revealed through a
 * feathered window. Both layers are the same 1672x941 frame, so they share
 * one box, one crop and one object-position.
 */
export function Hero() {
  return (
    <section id="inicio" className="hero" data-sc-act="flow" aria-labelledby="hero-title">
      <div className="hero__scrim" aria-hidden />
      <div className="hero__inner">
        <div className="hero__copy">
          <p className="cl-eyebrow">{HERO.eyebrow}</p>
          <h1 id="hero-title" className="cl-title hero__title">
            {HERO.headline}
          </h1>
          <p className="cl-lead hero__support">{HERO.support}</p>
          <div className="hero__actions">
            <a href="#porque" className="cl-btn">
              {ACTIONS.exploreCta}
            </a>
            <a href="#invitacion" className="cl-link">
              {ACTIONS.primaryCta}
            </a>
          </div>
        </div>
      </div>
      {/* After the copy in document order so a phone reads copy first, media second. */}
      <HeroReveal labels={HERO.reveal}>
        {/* Paint order: luminous ground, then the masked physical people, then
            the masked haze copy screened over them. */}
        <div className="hero__layer hero__layer--luminous">
          <Image src="/landing/media/hero-luminous.webp" alt={HERO.reveal.luminousAlt} fill sizes="100vw" priority />
        </div>
        <div className="hero__layer hero__layer--physical">
          <Image src="/landing/media/hero-physical.webp" alt={HERO.reveal.physicalAlt} fill sizes="100vw" />
        </div>
        <div className="hero__layer hero__layer--haze" aria-hidden>
          <Image src="/landing/media/hero-luminous.webp" alt="" fill sizes="100vw" />
        </div>
      </HeroReveal>
    </section>
  );
}
