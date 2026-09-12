import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { ClearLightLanding } from "@/components/landing/clear-light-landing";
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
 * V3 design handoff (docs/landing-page.md, D-042). The page collects nothing:
 * its single outbound action is the study's Qualtrics screening link, read from
 * `studies.screening_url` of the study open for recruitment (D-031).
 *
 * The fonts are declared here rather than in the root layout so that staff
 * pages do not download faces they never use.
 */
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });

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
      <main id="main" className={`cl holding ${manrope.variable}`} lang="es">
        <div>
          <h1 className="cl-title--md">{t("title")}</h1>
          <p className="cl-lead">{t("body")}</p>
        </div>
      </main>
    );
  }

  return <ClearLightLanding qualtricsUrl={qualtricsUrl} fontClass={`${manrope.variable} ${plexMono.variable}`} />;
}
