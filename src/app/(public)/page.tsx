import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClearLightLanding } from "@/components/landing/clear-light-landing";
import { HOLDING_FONT_CLASS, PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { isProduction } from "@/config/env";
import { META, missingContentList } from "@/content/landing/clear-light";
import { logger } from "@/lib/logger";
import { getOpenRecruitmentStudy } from "@/services/recruitment";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

/**
 * Public recruitment landing page for the aNUma Clear Light trial.
 *
 * Spanish only, one locked dark theme, eight sections in the order fixed by the
 * V3 design handoff (docs/landing-page.md, D-042). The page stores nothing: its
 * single outbound action is the study's Qualtrics screening link, read from
 * `studies.screening_url` of the study open for recruitment (D-031), and the
 * contact dialog sends nothing yet (D-052).
 */

export const metadata: Metadata = {
  title: { absolute: META.title },
  description: META.description,
};

async function openScreeningUrl(): Promise<string | null> {
  try {
    const study = await getOpenRecruitmentStudy();
    return study?.screeningUrl ?? null;
  } catch (err) {
    // A public page must not 500 because the database is unreachable; it
    // fails closed, with no outbound link, and says so in the log.
    logger.error({ err }, "landing: could not read the open recruitment study");
    return null;
  }
}

export default async function PublicHomePage() {
  const qualtricsUrl = await openScreeningUrl();

  // Unapproved protocol content never reaches production. Development and
  // staging show the markers; production shows a holding page instead.
  if (isProduction() && missingContentList({ qualtricsUrl }).length > 0) {
    const t = await getTranslations("public.holding");
    return (
      <main id="main" className={`cl holding ${HOLDING_FONT_CLASS}`} lang="es">
        <div>
          <h1 className="cl-title--md">{t("title")}</h1>
          <p className="cl-lead">{t("body")}</p>
        </div>
      </main>
    );
  }

  return <ClearLightLanding qualtricsUrl={qualtricsUrl} fontClass={PUBLIC_FONT_CLASS} />;
}
