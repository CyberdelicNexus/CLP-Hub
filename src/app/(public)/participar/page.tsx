import type { Metadata } from "next";
import { ApplyFlow } from "@/components/landing/apply-flow";
import { CookieBanner } from "@/components/landing/consent";
import { ContactDialog } from "@/components/landing/contact-dialog";
import { HOLDING_FONT_CLASS, PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { SiteFooter } from "@/components/landing/site-footer";
import { StarField } from "@/components/landing/star-field";
import { isProduction } from "@/config/env";
import { missingContentList } from "@/content/landing/clear-light";
import { LANDING_COPY } from "@/content/landing/copy";
import { getPublicLocale } from "@/i18n/public-locale";
import { openScreeningUrl } from "../screening-url";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

const ROOT_ID = "clear-light-apply";

export async function generateMetadata(): Promise<Metadata> {
  const { APPLY } = LANDING_COPY[await getPublicLocale()];
  return { title: { absolute: APPLY.meta.title }, description: APPLY.meta.description };
}

/**
 * The page behind the hero's "Aplicar al estudio" and the invitation's
 * "Comprobar si puedo participar" (D-085, D-090), in the landing's theme:
 * what happens, then two steps (D-086). Its own H1 (`APPLY.title`) is
 * deliberately its own copy, not `ACTIONS.primaryCta` — see D-090: someone
 * who has clicked through to here already thinks they fit and is ready to
 * apply. First name, email and phone,
 * which create the application in the Hub (`apply-flow.tsx`,
 * `actions.ts`); then the Qualtrics questionnaire framed on the page, opened
 * with the application's participant code in its URL.
 *
 * D-086 REVERSES D-031's "nothing before consent", at the founder's direction:
 * those three contact fields are taken before the questionnaire's consent.
 * Nothing else is: the information sheet, the consent and every screening
 * answer stay in Qualtrics. The destination is `studies.screening_url`,
 * configured per study. When recruitment is closed or no URL is configured,
 * neither step is rendered, decided on the server.
 */
export default async function ApplyPage() {
  const locale = await getPublicLocale();
  const copy = LANDING_COPY[locale];
  const { APPLY, INVITATION } = copy;
  const url = await openScreeningUrl();

  // Same publication gate as the landing page and the legal pages.
  if (isProduction() && missingContentList({ qualtricsUrl: url }).length > 0) {
    return (
      <main id="main" className={`cl holding ${HOLDING_FONT_CLASS}`} lang={locale}>
        <div>
          <h1 className="cl-title--md">{copy.HOLDING.title}</h1>
          <p className="cl-lead">{copy.HOLDING.body}</p>
        </div>
      </main>
    );
  }

  return (
    <div id={ROOT_ID} className={`cl legal apply ${PUBLIC_FONT_CLASS}`} lang={locale}>
      <StarField rootId={ROOT_ID} />
      <header className="legal__bar">
        {/* Full document loads, not <Link>, like the legal pages. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="bar__brand">
          Clear Light
        </a>
        <div className="legal__bar-end">
          <LanguageSwitch locale={locale} label={copy.LANGUAGE.label} from="/participar" />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="cl-link">
            {APPLY.back}
          </a>
        </div>
      </header>

      <main id="main" className="apply__main">
        <div className="apply__head">
          <p className="cl-eyebrow">{APPLY.eyebrow}</p>
          <h1 className="cl-title apply__title">{APPLY.title}</h1>
          <p className="cl-lead apply__intro">{APPLY.intro}</p>
        </div>

        <section aria-labelledby="apply-steps">
          <h2 id="apply-steps" className="apply__steps-label">
            {APPLY.stepsLabel}
          </h2>
          <ol className="apply__steps">
            {APPLY.steps.map((s) => (
              <li key={s.title} className="apply__step">
                <h3 className="apply__step-title">{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {url ? (
          <ApplyFlow url={url} apply={APPLY} />
        ) : (
          <p className="apply__closed">{INVITATION.closed}</p>
        )}
      </main>

      <SiteFooter copy={copy} rootId={ROOT_ID} onLanding={false} />
      <ContactDialog copy={copy.CONTACT} />
      <CookieBanner copy={copy.CONSENT} />
    </div>
  );
}
