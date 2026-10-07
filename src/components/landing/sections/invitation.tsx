import Image from "next/image";
import { Partners } from "@/components/landing/sections/partners";
import { Research } from "@/components/landing/sections/research";
import { SiteFooter } from "@/components/landing/site-footer";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Section 8. The restrained close: the founder's footer frame (six light bodies
 * in an arc around a small fire, D-052), the headline, the consent
 * clarification, one Qualtrics CTA, the contact action and the footer. The
 * page resolves here and holds; nothing fades out.
 *
 * The CTA goes to /participar (D-085), where the Qualtrics questionnaire is
 * framed inside the site; the Qualtrics URL itself is only handed to that page.
 * It renders only when the open study has a screening URL configured
 * (studies.screening_url, D-031). The contact action opens ContactDialog.
 */
export function Invitation({ copy, rootId }: { copy: LandingCopy; rootId: string }) {
  const { ACTIONS, INVITATION } = copy;
  return (
    <section id="invitacion" className="invitacion" aria-labelledby="invitacion-title">
      <div className="invitacion__scene">
        <div className="arc">
          <Image src="/landing/media/footer-arc.webp" alt={INVITATION.arcAlt} fill sizes="(max-width: 860px) 100vw, 72rem" quality={90} />
          <span className="arc__glow" aria-hidden />
          <span className="arc__ember" aria-hidden />
          {/* Not a control, just a larger, comfortable hit area than the ember
              itself: hovering it brightens the ember and its glow (D-056). */}
          <span className="arc__fire-hover" aria-hidden />
        </div>
        <h2 id="invitacion-title" className="cl-title invitacion__title">
          {INVITATION.heading}
        </h2>
        <p className="cl-lead invitacion__support">{INVITATION.support}</p>
        <div className="invitacion__cta">
          <a href="/clearlight/participar" className="cl-btn">
            {ACTIONS.primaryCta}
          </a>
          <a href="#contacto" className="cl-link">
            {ACTIONS.contactCta}
          </a>
        </div>
      </div>

      <Research copy={copy} />
      <Partners copy={copy} />
      <SiteFooter copy={copy} rootId={rootId} onLanding />
    </section>
  );
}
