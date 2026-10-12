import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { EnergyOrb } from "@/components/landing/energy-orb";
import { FilmPlayer } from "@/components/landing/film-player";
import { PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { HomeLiquid } from "@/components/landing/home-liquid";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { PaperRail } from "@/components/landing/paper-rail";
import { StarField } from "@/components/landing/star-field";
import { StillToggle } from "@/components/landing/still-toggle";
import { HOME_COPY, HOME_FILM, HOME_PAPERS, HOME_PRESS, HOME_PRESS_LOGOS, HOME_SITES } from "@/content/home";
import { LANDING_COPY } from "@/content/landing/copy";
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
 * The hero's light breathes in CSS alone (home.css: four seconds in, one
 * held, four out, one held), so the rhythm runs without JavaScript. The scripts only add texture: the starfield,
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
  const pressDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

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

      {/* Behind the whole page, not only the hero: fixed to the viewport like the starfield. */}
      <HomeLiquid />

      <main id="main">
        <section className="home__hero" aria-labelledby="home-title">
          <div className="home__hero-inner">
            <div className="breath" aria-hidden>
              <span className="breath__halo" />
              <span className="breath__orb">
                <span className="breath__core" />
                <EnergyOrb rootId={ROOT_ID} />
              </span>
            </div>

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

        <section className="home__film" aria-labelledby="home-film-title">
          <h2 id="home-film-title" className="cl-title cl-title--md">
            {copy.film.heading}
          </h2>
          {/* Nothing loads from YouTube until the visitor presses play and accepts it (D-052). */}
          <FilmPlayer
            youtubeId={HOME_FILM.youtubeId}
            poster={HOME_FILM.poster}
            alt={copy.film.posterAlt}
            label={HOME_FILM.title}
            playLabel={copy.film.play}
            consent={LANDING_COPY[locale].CONSENT}
            lang={locale}
          />
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

        <section className="home__research home__press" aria-labelledby="home-press-title">
          <PaperRail
            labels={copy.press}
            heading={
              <>
                <h2 id="home-press-title" className="cl-title cl-title--md">
                  {copy.press.heading}
                </h2>
                <p className="cl-lead">{copy.press.intro}</p>
              </>
            }
          >
            {HOME_PRESS.map((item, index) => (
              <li key={item.href}>
                <a className="research__paper press__card" href={item.href} target="_blank" rel="noopener noreferrer" aria-labelledby={`home-press-${index} home-press-go-${index}`}>
                  {/* Decorative: the outlet is named in the line below. */}
                  <div className="press__logo" aria-hidden="true">
                    <Image {...HOME_PRESS_LOGOS[item.logo]} alt="" sizes="12rem" />
                  </div>
                  <div className="research__content">
                    <p className="research__journal">
                      {item.outlet}
                      {item.date ? ` · ${pressDate.format(new Date(item.date))}` : null}
                    </p>
                    <h3 id={`home-press-${index}`} lang={item.lang}>
                      {item.title}
                    </h3>
                    <span id={`home-press-go-${index}`} className="research__read">
                      {copy.press[item.kind]}
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
