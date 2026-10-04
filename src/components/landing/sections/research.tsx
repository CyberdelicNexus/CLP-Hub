import { ArrowUpRight } from "lucide-react";
import type { LandingCopy } from "@/content/landing/clear-light";
import { RESEARCH_PAPERS } from "@/content/landing/research";

export function Research({ copy }: { copy: LandingCopy }) {
  const { RESEARCH } = copy;
  return (
    <section id="investigacion" className="research" aria-labelledby="research-title">
      <header className="research__header">
        <h2 id="research-title" className="cl-title cl-title--md">{RESEARCH.heading}</h2>
        <p className="cl-lead">{RESEARCH.intro}</p>
      </header>
      <ul className="research__grid">
        {RESEARCH_PAPERS.map((paper, index) => (
          <li key={paper.href}>
            <a className="research__paper" href={paper.href} target="_blank" rel="noopener noreferrer" aria-labelledby={`paper-title-${index} paper-read-${index}`}>
              <div className={`research__thumbnail research__thumbnail--${index}`} aria-hidden="true">
                <span className="research__orbit" />
                <span className="research__orbit research__orbit--outer" />
                <span className="research__light research__light--one" />
                <span className="research__light research__light--two" />
                <span className="research__light research__light--three" />
                <span className="research__thread" />
              </div>
              <div className="research__content">
                <p className="research__journal">{paper.journal}</p>
                <h3 id={`paper-title-${index}`}>{RESEARCH.titles[index]}</h3>
                <p className="research__description">{RESEARCH.descriptions[index]}</p>
                <span className="sr-only" lang="en">{paper.title}</span>
                <span id={`paper-read-${index}`} className="research__read">
                  {RESEARCH.read}<ArrowUpRight size={18} aria-hidden="true" />
                  <span className="sr-only"> ({RESEARCH.newTab})</span>
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
