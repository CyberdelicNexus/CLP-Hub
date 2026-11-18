import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { getEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { applications } from "@/db/schema";
import { APPLICATION_NOTIFY_PER_HOUR, applicationStaffNotification } from "@/domain/application-mail";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { applicationNotice, logoAttachment } from "@/emails/render";
import { sendMail } from "./mailer";
import { staffNotificationRecipients } from "./staff-recipients";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Tell the team a new application arrived from the public form (D-152). Same
 * recipients as a new consulta (`staffNotificationRecipients`). Best effort and
 * logged, like the consulta notice: it never fails the application, and it is
 * called from `after()`, once the application's transaction has committed.
 *
 * The public form has no rate limit of its own, so a burst of submissions
 * (a bot, a link shared widely) sends at most APPLICATION_NOTIFY_PER_HOUR
 * notices an hour; the Hub still lists every application.
 */
export async function notifyStaffOfApplication(studyId: string): Promise<void> {
  try {
    const db = getDb();
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(applications)
      .where(and(eq(applications.studyId, studyId), gt(applications.submittedAt, new Date(Date.now() - HOUR_MS))));
    if (recent > APPLICATION_NOTIFY_PER_HOUR) {
      logger.info({ event: "application.notify_capped" }, "staff notice skipped: hourly cap reached");
      return;
    }

    const to = await staffNotificationRecipients(studyId);
    if (to.length === 0) return;

    const [{ pending }] = await db
      .select({ pending: count() })
      .from(applications)
      .where(and(eq(applications.studyId, studyId), eq(applications.status, "SUBMITTED")));

    const { APP_URL } = getEnv();
    const listUrl = APP_URL ? `${APP_URL.replace(/\/$/, "")}${TEAM_BASE_PATH}/solicitudes` : null;
    const result = await sendMail({
      to,
      ...applicationStaffNotification({ count: pending, listUrl }),
      html: applicationNotice({ count: pending, listUrl }),
      attachments: [logoAttachment()],
    });
    if (!result.ok) logger.warn({ event: "application.notify_skipped", reason: result.reason }, "staff not emailed");
  } catch (err) {
    logger.error(
      { event: "application.notify_failed", err: err instanceof Error ? err.message : String(err) },
      "application notice failed",
    );
  }
}
