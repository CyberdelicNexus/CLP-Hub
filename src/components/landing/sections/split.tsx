import { SplitStage } from "@/components/landing/split-stage";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Section 6. What a randomized controlled trial is, and why there are two
 * groups: one light divides into two identical lights (split-stage.tsx), and
 * the two groups' text sits in equal columns centred under them. Both columns
 * render from the same map with the same classes, so neither group can be
 * given more weight than the other.
 *
 * The group wording is a working draft. Its approval keys stay in the
 * publication gate (CONDICION_GRUPO_*, ETIQUETAS_GRUPOS) but are not drawn as
 * markers here, at the founder's direction.
 */
export function Split({ copy }: { copy: LandingCopy }) {
  const { SPLIT } = copy;
  return (
    <section id="asignacion" className="azar" aria-labelledby="azar-title">
      <div className="azar__head">
        <p className="cl-eyebrow">{SPLIT.eyebrow}</p>
        <h2 id="azar-title" className="cl-title">
          {SPLIT.heading}
        </h2>
        {SPLIT.body.map((p) => (
          <p key={p} className="cl-lead azar__body">
            {p}
          </p>
        ))}
      </div>

      <SplitStage>
        <ul className="azar__branches">
          {SPLIT.branches.map((b) => (
            <li key={b.label} className="azar__branch">
              <p className="azar__name">{b.label}</p>
              {b.lines.map((line) => (
                <p key={line} className="azar__line">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </SplitStage>

      <p className="azar__supporting">{SPLIT.supporting}</p>
    </section>
  );
}
