import Image from "next/image";
import { Missing } from "@/components/landing/missing";
import { Signal } from "@/components/landing/signal";
import { ELIGIBILITY } from "@/content/landing/clear-light";

/**
 * Section 7. Eligibility and questions, combined. The documentary participant
 * stays on the left; the travelling light descends into the heart centre as
 * the section arrives (`--t` in landing.css). Criteria, benefits and risks,
 * equipment, voluntary participation and withdrawal, contact and registry are
 * all reachable through native <details>, keyboard operable, no JavaScript.
 * Nothing here invents a criterion: every protocol value is a marker.
 */
export function Eligibility() {
  return (
    <section id="elegibilidad" className="elegibilidad" data-sc-act="flow" aria-labelledby="elig-title">
      <div className="elegibilidad__grid">
        <figure className="participant">
          <Image
            src="/landing/media/participant-heart.webp"
            alt={ELIGIBILITY.participantAlt}
            fill
            sizes="(max-width: 860px) 100vw, 40vw"
          />
          <span className="participant__heart" aria-hidden />
          <Signal className="participant__light" size="var(--cl-light-md)" />
        </figure>

        <div>
          <p className="elig__meta">
            <Missing item={ELIGIBILITY.registry} />
            <Missing item={ELIGIBILITY.investigator} />
          </p>
          <h2 id="elig-title" className="cl-title">
            {ELIGIBILITY.heading}
          </h2>
          <p className="cl-lead elig__intro">{ELIGIBILITY.intro}</p>

          <div className="elig__criteria">
            <h3>{ELIGIBILITY.criteriaHeading}</h3>
            <p className="elig__criteria-body">
              <Missing item={ELIGIBILITY.criteria} />
            </p>
            <p className="elig__required">{ELIGIBILITY.requiredLine}</p>
          </div>

          <div className="faq">
            {ELIGIBILITY.faq.map((item) => (
              <details key={item.id} id={item.id} className="faq__item">
                <summary className="faq__summary">
                  {item.topic}
                  <span className="faq__mark" aria-hidden />
                </summary>
                <div className="faq__body">
                  {item.statements.map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                  <p>
                    <Missing item={item.pending} />
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
