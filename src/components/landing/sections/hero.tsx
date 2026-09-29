import Image from "next/image";
import { HeroReveal } from "@/components/landing/hero-reveal";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Section 1 (recentred and video-free, D-077 — the pinned clip that used to
 * sit here is gone). Identifies the page as research in the first line, then
 * the question, centred on both axes rather than banded to one side. Six
 * soft light bodies sit behind the copy; the physical people, seated on
 * chairs with Quest 3 headsets and controllers, are revealed through the
 * pointer's feathered window. Both layers are 3344x1882, so they share one
 * box, one crop and one object-position.
 */
export function HeroCopy({ copy, titleId }: { copy: LandingCopy; titleId?: string }) {
  const { ACTIONS, HERO } = copy;
  return (
    <div className="hero__copy" data-sc-in>
      <p className="cl-eyebrow hero__eyebrow">{HERO.eyebrow}</p>
      <h1 id={titleId} className="cl-title hero__title">
        {HERO.headline}
      </h1>
      <p className="cl-lead hero__support">{HERO.support}</p>
      {/*
        2026-09-29 request (D-090): the hero now offers a direct path to the
        application page rather than only anchoring within the page — a
        deliberate, confirmed override of D-085's earlier "everything
        anchors in-page, only the final invitation reaches outward" rule.
        The second button anchors to the eligibility/questions section
        instead of the invitation, with its own label (`eligibilityCta`)
        rather than reusing `primaryCta`, which still means "go apply" for
        the SiteBar nav CTA and the invitation section's own button.
      */}
      <div className="hero__actions">
        <a href="/participar" className="cl-btn">
          {ACTIONS.exploreCta}
        </a>
        <a href="#elegibilidad" className="cl-link">
          {ACTIONS.eligibilityCta}
        </a>
      </div>
    </div>
  );
}

export function HeroMedia({ copy }: { copy: LandingCopy }) {
  const { HERO } = copy;
  return (
    <HeroReveal>
      {/* Paint order: luminous ground, then the masked physical people, then
          the masked haze copy screened over them. */}
      <div className="hero__layer hero__layer--luminous">
        <Image src="/landing/media/hero-luminous-refined-v2.png" alt={HERO.reveal.luminousAlt} fill sizes="100vw" quality={90} priority />
      </div>
      <div className="hero__layer hero__layer--physical">
        <Image src="/landing/media/hero-physical-v4.webp" alt={HERO.reveal.physicalAlt} fill sizes="100vw" quality={90} />
      </div>
      <div className="hero__layer hero__layer--haze" aria-hidden>
        <Image src="/landing/media/hero-luminous-refined-v2.png" alt="" fill sizes="100vw" quality={90} />
      </div>
    </HeroReveal>
  );
}

export function Hero({ copy }: { copy: LandingCopy }) {
  return (
    <section id="inicio" data-anchor-stacked="inicio" className="hero" aria-labelledby="hero-title">
      <div className="hero__scrim" aria-hidden />
      <div className="hero__inner">
        <HeroCopy copy={copy} titleId="hero-title" />
      </div>
      {/* After the copy in document order so a phone reads copy first, media second. */}
      <HeroMedia copy={copy} />
    </section>
  );
}
