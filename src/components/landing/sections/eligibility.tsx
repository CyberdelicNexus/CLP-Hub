import Image from "next/image";
import { Signal } from "@/components/landing/signal";
import { ELIGIBILITY } from "@/content/landing/clear-light";

/**
 * Section 7. Eligibility and questions, combined. The documentary participant
 * stays on the left; section 6's two lights reunite at the top of the
 * photograph and hand over to this light, which then descends into the heart
 * centre (split-stage.tsx drives `--t`; without it, landing.css does). Criteria,
 * benefits and risks, equipment, voluntary participation and withdrawal,
 * contact and registry are all reachable through native <details>, keyboard
 * operable, no JavaScript.
 *
 * The answers are general working drafts that invent no criterion, duration,
 * risk or contact. Their approval keys are not drawn as markers here (D-051)
 * but still block publication.
 */
export function Eligibility() {
  return (
    <section id="elegibilidad" className="elegibilidad" data-sc-act="flow" aria-labelledby="elig-title">
      <div className="elegibilidad__grid">
        <figure className="participant">
          <Image
            src="/landing/media/participant-heart-v3.webp"
            alt={ELIGIBILITY.participantAlt}
            fill
            sizes="(max-width: 860px) 100vw, 40vw"
            quality={90}
          />
          <span className="participant__heart" aria-hidden />
          <Signal className="participant__light" size="var(--cl-light-md)" />
        </figure>

        <div>
          <h2 id="elig-title" className="cl-title">
            {ELIGIBILITY.heading}
          </h2>
          <p className="cl-lead elig__intro">{ELIGIBILITY.intro}</p>

          <div className="elig__criteria">
            <h3>{ELIGIBILITY.criteriaHeading}</h3>
            <ul className="elig__criteria-list">
              {ELIGIBILITY.criteriaItems.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="elig__criteria-body">{ELIGIBILITY.criteriaText}</p>
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
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
