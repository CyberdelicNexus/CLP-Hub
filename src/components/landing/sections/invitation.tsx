import Image from "next/image";
import { Missing } from "@/components/landing/missing";
import { SiteFooter } from "@/components/landing/site-footer";
import { ACTIONS, INVITATION } from "@/content/landing/clear-light";

/**
 * Section 8. The restrained close: the founder's footer frame (six light bodies
 * in an arc around a small fire, D-052), the headline, the consent
 * clarification, one Qualtrics CTA, the contact action and the footer. The
 * page resolves here and holds; nothing fades out.
 *
 * The CTA is the only outbound link on the page. It renders only when the open
 * study has a screening URL configured (studies.screening_url, D-031). The
 * contact action opens ContactDialog.
 */
export function Invitation({ qualtricsUrl, rootId }: { qualtricsUrl: string | null; rootId: string }) {
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
          {qualtricsUrl ? (
            <a href={qualtricsUrl} className="cl-btn" target="_blank" rel="external noopener noreferrer">
              {ACTIONS.primaryCta}
            </a>
          ) : (
            <>
              <span className="cl-btn" aria-disabled="true">
                {ACTIONS.primaryCta}
              </span>
              <p className="invitacion__closed">
                {INVITATION.closed} <Missing item={INVITATION.qualtricsUrl} />
              </p>
            </>
          )}
          <a href="#contacto" className="cl-link">
            {ACTIONS.contactCta}
          </a>
        </div>
      </div>

      <SiteFooter rootId={rootId} onLanding />
    </section>
  );
}
