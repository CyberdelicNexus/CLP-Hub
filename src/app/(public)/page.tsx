import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { EnergyOrb } from "@/components/landing/energy-orb";
import { PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { HomeLiquid } from "@/components/landing/home-liquid";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { PaperRail } from "@/components/landing/paper-rail";
import { StarField } from "@/components/landing/star-field";
import { StillToggle } from "@/components/landing/still-toggle";
import { HOME_COPY, HOME_PAPERS, HOME_SITES } from "@/content/home";
import { HOME_RETURN, PUBLIC_BASE_PATH } from "@/domain/navigation";
import { getPublicLocale } from "@/i18n/public-locale";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";
import "@/components/landing/home.css";

const ROOT_ID = "numadelic-home";

/**
 * The numadelic.org home page (D-105): one hero and the published research.
 * The Clear Light site lives under /clearlight (D-104).
 *
 * The hero's light breathes a box breath in CSS alone (home.css), so the
 * rhythm runs without JavaScript. The scripts only add texture: the starfield,
 * the cloud inside the light (energy-orb.tsx) and the liquid layer
 * (home-liquid.tsx, tunable at `/?liquid`).
 */

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = HOME_COPY[await getPublicLocale()];
  return { title: { absolute: meta.title }, description: meta.description };
}

export default async function HomePage() {
  const locale = await getPublicLocale();
  const copy = HOME_COPY[locale];

  return (
    <div id={ROOT_ID} className={`cl home ${PUBLIC_FONT_CLASS}`} lang={locale}>
      <StarField rootId={ROOT_ID} />

      <header className="home__bar">
        <span className="bar__brand">Numadelic</span>
        <div className="home__bar-end">
          <LanguageSwitch locale={locale} label={copy.language} from={HOME_RETURN} />
          <StillToggle rootId={ROOT_ID} labels={copy.still} />
        </div>
      </header>

      <main id="main">
        <section className="home__hero" aria-labelledby="home-title">
          <HomeLiquid />

          <div className="home__hero-inner">
            <div className="breath" aria-hidden>
              <span className="breath__halo" />
              <span className="breath__orb">
                <span className="breath__core" />
                <EnergyOrb rootId={ROOT_ID} />
              </span>
            </div>
            <p className="cl-sr">{copy.breath.label}</p>
            <p className="breath__phases" aria-hidden>
              {copy.breath.phases.map((phase, i) => (
                <span key={i} className={`breath__phase breath__phase--${i}`}>
                  {phase}
                </span>
              ))}
            </p>

            <h1 id="home-title" className="cl-title home__title">
              {copy.title}
            </h1>
            <p className="home__definition">
              <dfn className="home__term">{copy.definition.term}</dfn>
              <span className="home__origin"> — {copy.definition.origin}: </span>
              {copy.definition.meaning}
            </p>

            <nav className="home__ctas" aria-label={copy.ctaLabel}>
              {/* Full document load, not <Link>: the landing's scroll engine mounts on page load. */}
              <a href={PUBLIC_BASE_PATH} className="cl-btn">
                {copy.clearLight}
              </a>
              {HOME_SITES.map((site) => (
                <a key={site.href} href={site.href} className="cl-ghost home__site" target="_blank" rel="noopener noreferrer">
                  {site.label}
                  <ArrowUpRight size={16} aria-hidden />
                  <span className="cl-sr"> ({copy.research.newTab})</span>
                </a>
              ))}
            </nav>
          </div>
        </section>

        <section className="home__research" aria-labelledby="home-research-title">
          <PaperRail
            labels={copy.research}
            heading={
              <>
                <h2 id="home-research-title" className="cl-title cl-title--md">
                  {copy.research.heading}
                </h2>
                <p className="cl-lead">{copy.research.intro}</p>
              </>
            }
          >
            {HOME_PAPERS.map((paper, index) => (
              <li key={paper.href}>
                <a className="research__paper" href={paper.href} target="_blank" rel="noopener noreferrer" aria-labelledby={`home-paper-${index} home-paper-read-${index}`}>
                  <div className={`research__thumbnail research__thumbnail--${paper.art}`} aria-hidden="true">
                    <span className="research__orbit" />
                    <span className="research__orbit research__orbit--outer" />
                    <span className="research__light research__light--one" />
                    <span className="research__light research__light--two" />
                    <span className="research__light research__light--three" />
                    <span className="research__thread" />
                  </div>
                  <div className="research__content" lang="en">
                    <p className="research__journal">
                      {paper.journal} · {paper.year}
                    </p>
                    <h3 id={`home-paper-${index}`}>{paper.title}</h3>
                    <p className="research__description">{paper.authors}</p>
                    <span id={`home-paper-read-${index}`} className="research__read" lang={locale}>
                      {copy.research.read}
                      <ArrowUpRight size={18} aria-hidden="true" />
                      <span className="cl-sr"> ({copy.research.newTab})</span>
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </PaperRail>
        </section>
      </main>
    </div>
  );
}
