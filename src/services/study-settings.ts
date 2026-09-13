import "server-only";
import { eq } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import { studies, type Study } from "@/db/schema";
import type { Locale } from "@/domain/locale";
import type { StudyStatus } from "@/domain/study";

/**
 * Study settings (Phase 8b).
 *
 * The handful of values that change what the whole application does:
 *
 * - `screeningUrl` is where every applicant is sent (D-031). A wrong value sends
 *   people to the wrong questionnaire, and nothing downstream would notice.
 * - `timezone` is what every date on every screen is rendered in, and what a
 *   facilitator reads a session time as.
 * - `status` is what the scheduled-action processor uses to decide which studies
 *   to work through (D-043).
 * - `recruitmentOpen` is what the public landing page and `/participar` check
 *   before offering the hand-off at all.
 *
 * EVERY CHANGE IS AUDITED WITH BEFORE AND AFTER, in full. These are
 * configuration, not participant data, so the whole value is safe to snapshot —
 * and a silent change to any of them would be indistinguishable from a bug.
 *
 * WHAT IS NOT EDITABLE HERE: the study `code`. It appears in participant codes,
 * exports and every audit row, and renaming it would silently re-label history.
 */

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Study ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class InvalidSettingError extends Error {
  readonly field: "screeningUrl" | "timezone" | "title";
  constructor(field: InvalidSettingError["field"]) {
    super(field);
    this.name = "InvalidSettingError";
    this.field = field;
  }
}

export const TITLE_MAX_LENGTH = 200;
export const SCREENING_URL_MAX_LENGTH = 500;

/**
 * The same rule the database enforces (migration 0013): https, no whitespace,
 * bounded length.
 *
 * Checked here too so the form gets a useful message instead of a constraint
 * violation — and `https` specifically, because this URL is handed to the public
 * and an `http` one would downgrade every applicant's connection.
 */
export function isValidScreeningUrl(url: string): boolean {
  return /^https:\/\/[^\s]+$/.test(url) && url.length <= SCREENING_URL_MAX_LENGTH;
}

/**
 * A timezone the runtime actually knows.
 *
 * Validated by asking `Intl` rather than against a list: a hand-maintained list
 * of IANA zones goes stale, and a zone the runtime cannot resolve would throw
 * on every date on every screen.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function getStudy(studyId: string): Promise<Study | null> {
  const [row] = await getDb().select().from(studies).where(eq(studies.id, studyId)).limit(1);
  return row ?? null;
}

export interface StudySettingsPatch {
  title?: string;
  status?: StudyStatus;
  defaultLocale?: Locale;
  timezone?: string;
  recruitmentOpen?: boolean;
  /** Empty string clears it, which is a real choice: recruitment with no URL. */
  screeningUrl?: string | null;
}

/**
 * Apply a settings change.
 *
 * Only the fields that actually changed reach the audit row. A form that posts
 * every field on every save would otherwise write an audit entry claiming five
 * changes when somebody fixed a typo in the title.
 */
export async function updateStudySettings(params: {
  studyId: string;
  actorId: string;
  patch: StudySettingsPatch;
}): Promise<void> {
  const { studyId, actorId, patch } = params;

  if (patch.title !== undefined) {
    const trimmed = patch.title.trim();
    if (trimmed.length === 0 || trimmed.length > TITLE_MAX_LENGTH) {
      throw new InvalidSettingError("title");
    }
  }
  if (patch.timezone !== undefined && !isValidTimezone(patch.timezone)) {
    throw new InvalidSettingError("timezone");
  }
  if (patch.screeningUrl) {
    if (!isValidScreeningUrl(patch.screeningUrl)) throw new InvalidSettingError("screeningUrl");
  }

  await getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(studies).where(eq(studies.id, studyId)).limit(1);
    if (!current) throw new NotFoundError(studyId);

    const next = {
      title: patch.title?.trim() ?? current.title,
      status: patch.status ?? current.status,
      defaultLocale: patch.defaultLocale ?? current.defaultLocale,
      timezone: patch.timezone ?? current.timezone,
      recruitmentOpen: patch.recruitmentOpen ?? current.recruitmentOpen,
      screeningUrl:
        patch.screeningUrl === undefined
          ? current.screeningUrl
          : patch.screeningUrl?.trim() || null,
    };

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (next[key] !== current[key]) {
        before[key] = current[key];
        after[key] = next[key];
      }
    }
    // Nothing moved. Writing a row saying so would make the log harder to read,
    // not more complete.
    if (Object.keys(after).length === 0) return;

    await tx.update(studies).set(next).where(eq(studies.id, studyId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "study.settings_changed",
      entityType: "study",
      entityId: studyId,
      before,
      after,
    });
  });
}
