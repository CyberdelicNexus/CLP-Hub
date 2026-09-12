import type { CSSProperties } from "react";
import { Missing } from "@/components/landing/missing";
import { Signal } from "@/components/landing/signal";
import { SPLIT } from "@/content/landing/clear-light";

/**
 * Section 6. Assignment at random: one light divides into two identical
 * lights. Both branches render from the same component with the same tokens;
 * the direction token is the only difference, so neither can be brighter,
 * larger, closer or better placed than the other. The division is driven by
 * the section's flow progress (`--split` in landing.css) and is static under
 * reduced motion.
 */
export function Split() {
  return (
    <section id="asignacion" className="azar" data-sc-act="flow" aria-labelledby="azar-title">
      <div className="azar__head">
        <p className="cl-eyebrow">{SPLIT.eyebrow}</p>
        <h2 id="azar-title" className="cl-title">
          {SPLIT.heading}
        </h2>
        <p className="cl-lead azar__body">{SPLIT.body}</p>
      </div>

      <div className="azar__diagram">
        <svg className="azar__paths" viewBox="0 0 1000 562" preserveAspectRatio="none" aria-hidden>
          <path className="azar__path" pathLength={1} vectorEffect="non-scaling-stroke" d="M500 124 C 500 232, 250 236, 250 348" />
          <path className="azar__path" pathLength={1} vectorEffect="non-scaling-stroke" d="M500 124 C 500 232, 750 236, 750 348" />
        </svg>
        {SPLIT.branches.map((b, i) => (
          <div key={b.label} className="branch" style={{ "--dir": i === 0 ? -1 : 1 } as CSSProperties}>
            <Signal className="branch__light" size="var(--cl-light-md)" />
            <p className="branch__label">
              <span className="branch__name">{b.label}</span>
              <span className="branch__condition">
                <Missing item={b.condition} />
              </span>
            </p>
          </div>
        ))}
      </div>

      <p className="azar__supporting">
        {SPLIT.supporting} <Missing item={SPLIT.labels} />
      </p>
    </section>
  );
}
