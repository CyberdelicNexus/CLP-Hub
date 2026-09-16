import type { ReactNode } from "react";
import Image from "next/image";
import { HeroReveal } from "@/components/landing/hero-reveal";
import { ACTIONS, HERO } from "@/content/landing/clear-light";

/**
 * Section 1. Identifies the page as research in the first line, then the
 * question. Seven soft light bodies sit in a shallow arc behind the copy; the
 * physical people (Quest 3 headsets and controllers) are revealed through a
 * feathered window. Both layers are the same 3344x1882 frame, so they share
 * one box, one crop and one object-position.
 *
 * The copy and media are shared by the desktop opening sequence (opening.tsx)
 * and the stacked flow variant below.
 */
export function HeroCopy({ titleId }: { titleId?: string }) {
  return (
    <div className="hero__copy">
      <p className="cl-eyebrow">{HERO.eyebrow}</p>
      <h1 id={titleId} className="cl-title hero__title">
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
  );
}

/** `sequence` sits between the luminous still and the revealed people. */
export function HeroMedia({ sequence }: { sequence?: ReactNode }) {
  return (
    <HeroReveal>
      {/* Paint order: luminous ground, the opening sequence clip, then the
          masked physical people, then the masked haze copy screened over them. */}
      <div className="hero__layer hero__layer--luminous">
        <Image src="/landing/media/hero-luminous-hd.webp" alt={HERO.reveal.luminousAlt} fill sizes="100vw" quality={90} priority />
      </div>
      {sequence ? <div className="hero__layer hero__layer--sequence">{sequence}</div> : null}
      <div className="hero__layer hero__layer--physical">
        <Image src="/landing/media/hero-physical-v3.webp" alt={HERO.reveal.physicalAlt} fill sizes="100vw" quality={90} />
      </div>
      <div className="hero__layer hero__layer--haze" aria-hidden>
        <Image src="/landing/media/hero-luminous-hd.webp" alt="" fill sizes="100vw" quality={90} />
      </div>
    </HeroReveal>
  );
}

export function Hero() {
  return (
    <section id="inicio" data-anchor-stacked="inicio" className="hero" aria-labelledby="hero-title">
      <div className="hero__scrim" aria-hidden />
      <div className="hero__inner">
        <HeroCopy titleId="hero-title" />
      </div>
      {/* After the copy in document order so a phone reads copy first, media second. */}
      <HeroMedia />
    </section>
  );
}
