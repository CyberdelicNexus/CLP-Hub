import Image from "next/image";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Research partners and funding credit (D-077, team request). Not one of the
 * eight locked sections (docs/landing-page.md): an institutional trust band
 * between the final invitation and the footer, logos and names only, no claim
 * about what each partner contributes to the study.
 */
export function Partners({ copy }: { copy: LandingCopy }) {
  const { PARTNERS } = copy;
  return (
    <div className="partners" data-sc-in>
      <p className="partners__heading">{PARTNERS.heading}</p>
      <ul className="partners__list">
        {PARTNERS.items.map((p) => (
          <li key={p.name} className="partners__item">
            <Image
              src={p.logo.src}
              alt={p.name}
              width={p.logo.width}
              height={p.logo.height}
              sizes="(max-width: 640px) 40vw, 12rem"
              className="partners__logo"
            />
          </li>
        ))}
      </ul>
      <div className="partners__funding">
        <p className="partners__heading">{PARTNERS.funding.heading}</p>
        <Image
          src={PARTNERS.funding.logo.src}
          alt={PARTNERS.funding.name}
          width={PARTNERS.funding.logo.width}
          height={PARTNERS.funding.logo.height}
          sizes="(max-width: 640px) 60vw, 16rem"
          className="partners__funding-logo"
        />
      </div>
    </div>
  );
}
