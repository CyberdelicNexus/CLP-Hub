import { logger } from "@/lib/logger";
import { getOpenRecruitmentStudy } from "@/services/recruitment";

/**
 * The Qualtrics screening link of the study open for recruitment
 * (`studies.screening_url`, D-031), or null. A public page must not 500
 * because the database is unreachable: it fails closed, with no outbound
 * link, and says so in the log. Shared by the landing page and /participar.
 */
export async function openScreeningUrl(): Promise<string | null> {
  try {
    const study = await getOpenRecruitmentStudy();
    return study?.screeningUrl ?? null;
  } catch (err) {
    logger.error({ err }, "public: could not read the open recruitment study");
    return null;
  }
}
