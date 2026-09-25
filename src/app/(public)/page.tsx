import type { Metadata } from "next";
import { ClearLightLanding } from "@/components/landing/clear-light-landing";
import { HOLDING_FONT_CLASS, PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { isProduction } from "@/config/env";
import { missingContentList } from "@/content/landing/clear-light";
import { LANDING_COPY } from "@/content/landing/copy";
import { getPublicLocale } from "@/i18n/public-locale";
import { openScreeningUrl } from "./screening-url";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

/**
 * Public recruitment landing page for the Clear Light trial.
 *
 * Spanish first, with English and Galician translations chosen by the visitor
 * (D-063); one locked dark theme, eight sections in the order fixed by the
 * V3 design handoff (docs/landing-page.md, D-042). The page stores nothing: its
 * single outbound action is the study's Qualtrics screening link, read from
 * `studies.screening_url` of the study open for recruitment (D-031), and the
 * contact dialog sends nothing yet (D-052).
 */

export async function generateMetadata(): Promise<Metadata> {
  const { META } = LANDING_COPY[await getPublicLocale()];
  return { title: { absolute: META.title }, description: META.description };
}

export default async function PublicHomePage() {
  const qualtricsUrl = await openScreeningUrl();
  const locale = await getPublicLocale();
  const copy = LANDING_COPY[locale];

  // Unapproved protocol content never reaches production. Development and
  // staging show the markers; production shows a holding page instead.
  if (isProduction() && missingContentList({ qualtricsUrl }).length > 0) {
    return (
      <main id="main" className={`cl holding ${HOLDING_FONT_CLASS}`} lang={locale}>
        <div>
          <h1 className="cl-title--md">{copy.HOLDING.title}</h1>
          <p className="cl-lead">{copy.HOLDING.body}</p>
        </div>
      </main>
    );
  }

  return <ClearLightLanding locale={locale} copy={copy} qualtricsUrl={qualtricsUrl} fontClass={PUBLIC_FONT_CLASS} />;
}
