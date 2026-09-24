import { Hero } from "@/components/landing/sections/hero";
import { WhyWhat } from "@/components/landing/sections/why-what";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Sections 1 to 3 (D-077 removed the pinned hero+clip; D-078 removed the
 * travelling reading light; D-079 gave "El porqué"/"El qué" back a pinned
 * stage of their own, this time a plain crossfade with no video and no
 * scroll hold). The hero stays plain document flow, fading in on its own;
 * `WhyWhat` is the two-panel pinned crossfade, with its own stacked fallback
 * for mobile, reduced motion and no-JS.
 */
export function Opening({ copy, lang }: { copy: LandingCopy; lang: string }) {
  return (
    <>
      <Hero copy={copy} />
      <WhyWhat copy={copy} lang={lang} />
    </>
  );
}
