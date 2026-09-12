import Image from "next/image";
import { Missing } from "@/components/landing/missing";
import { StillToggle } from "@/components/landing/still-toggle";
import { ACTIONS, INVITATION } from "@/content/landing/clear-light";
import { TEAM_BASE_PATH } from "@/domain/navigation";

/**
 * Section 8. The restrained close: the blurred body arc (top of the authentic
 * "CL circle 2" frame), one small irregular orange fire beneath it, the
 * headline, the consent clarification, one Qualtrics CTA, the contact link and
 * a quiet footer. The page resolves here and holds; nothing fades out.
 *
 * The CTA is the only outbound link on the page. It renders only when the open
 * study has a screening URL configured (studies.screening_url, D-031). The
 * hero's human reveal is not repeated over the arc: the arc frame has no
 * physical counterpart, and the locked layout only permits it.
 */
export function Invitation({ qualtricsUrl, rootId }: { qualtricsUrl: string | null; rootId: string }) {
  return (
    <section id="invitacion" className="invitacion" aria-labelledby="invitacion-title">
      <div className="invitacion__scene">
        <div className="arc" aria-hidden>
          <Image src="/landing/media/arc-top.webp" alt="" fill sizes="(max-width: 860px) 92vw, 66rem" />
          <span className="fire">
            <Image src="/landing/media/fire.webp" alt="" fill sizes="80px" />
          </span>
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

      <footer className="foot">
        <div className="foot__inner">
          <span className="foot__brand">aNUma</span>
          <ul className="foot__links">
            <li>
              <a href={INVITATION.footer.study.href}>{INVITATION.footer.study.label}</a>
            </li>
            <li>
              <Missing item={INVITATION.footer.privacy} />
            </li>
            <li>
              <a href={INVITATION.footer.contact.href}>{INVITATION.footer.contact.label}</a>
            </li>
            <li>
              <StillToggle rootId={rootId} labels={{ pause: "Pausar animación", resume: "Reanudar animación" }} />
            </li>
            <li>
              <a href={`${TEAM_BASE_PATH}/login`}>{ACTIONS.teamAccess}</a>
            </li>
          </ul>
          <p className="foot__note">
            <span>{INVITATION.footer.note}</span>
            <Missing item={INVITATION.footer.version} />
          </p>
        </div>
      </footer>
    </section>
  );
}
