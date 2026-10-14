import "server-only";
import { and, asc, count, desc, eq, getTableColumns, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { inquiries, studies, userRoles, users, type Inquiry } from "@/db/schema";
import {
  INQUIRY_HOURLY_CAP,
  INQUIRY_NOTIFY_PER_HOUR,
  type InquiryInput,
  type InquirySource,
  type InquiryStatus,
} from "@/domain/inquiry";
import { ignoreReason, inquiryFromEmail } from "@/domain/inbound-email";
import { replyEmail, staffNotification, type InquiryLocale } from "@/domain/inquiry-mail";
import { hasPermission } from "@/domain/permissions";
import { isStaffRole, type StaffRole } from "@/domain/roles";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { fetchReceivedEmail, ownSenderAddress, sendMail } from "./mailer";

/**
 * The inquiry inbox (D-088). Questions from the public contact form, answered
 * by staff in the Hub. See src/domain/inquiry.ts for the boundary: the text of
 * an inquiry exists only while it is NEW, and the reply is never stored.
 *
 * Every write runs in one transaction with its audit row, and audit rows carry
 * the inquiry id and status only.
 */

export class InquiryNotFoundError extends Error {
  constructor() {
    super("Inquiry not found or already handled");
    this.name = "InquiryNotFoundError";
  }
}

export class InquiryMailError extends Error {
  readonly reason: "not_configured" | "rejected" | "network";
  constructor(reason: InquiryMailError["reason"]) {
    super(`Reply email not sent: ${reason}`);
    this.name = "InquiryMailError";
    this.reason = reason;
  }
}

const HOUR_MS = 60 * 60 * 1000;

export type SubmitInquiryResult = "ok" | "unavailable";

/**
 * Store a visitor's question and tell the staff who answer them. Refused
 * ("unavailable") when more than INQUIRY_HOURLY_CAP arrived in the last hour,
 * because this unauthenticated endpoint also causes an email to staff and the
 * app has no other rate limit. The notification never fails the submission.
 */
export async function submitInquiry(params: {
  studyId: string;
  locale: InquiryLocale;
  input: InquiryInput;
}): Promise<SubmitInquiryResult> {
  const result = await fileInquiry({ ...params, source: "FORM", externalRef: null });
  return result === "unavailable" ? "unavailable" : "ok";
}

/**
 * Insert one inquiry under the hourly cap, audit it, and tell staff. Shared by
 * the contact form and by emails to the study's address (D-118). "duplicate"
 * is an email whose provider id was already filed: a webhook delivered twice.
 */
async function fileInquiry(params: {
  studyId: string;
  locale: InquiryLocale;
  input: InquiryInput;
  source: InquirySource;
  externalRef: string | null;
}): Promise<"ok" | "unavailable" | "duplicate"> {
  const { studyId, locale, input, source, externalRef } = params;
  const since = new Date(Date.now() - HOUR_MS);

  const recentCount = await getDb().transaction(async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(inquiries)
      .where(and(eq(inquiries.studyId, studyId), gt(inquiries.createdAt, since)));
    if (n >= INQUIRY_HOURLY_CAP) return null;

    const [row] = await tx
      .insert(inquiries)
      .values({ studyId, locale, name: input.name, email: input.email, message: input.message, source, externalRef })
      .onConflictDoNothing()
      .returning({ id: inquiries.id });
    if (!row) return "duplicate" as const;

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "SYSTEM" },
      action: "inquiry.received",
      entityType: "inquiry",
      entityId: row.id,
      after: { status: "NEW", locale, source },
    });
    return n + 1;
  });

  if (recentCount === null) return "unavailable";
  if (recentCount === "duplicate") return "duplicate";
  if (recentCount <= INQUIRY_NOTIFY_PER_HOUR) await notifyStaff(studyId);
  return "ok";
}

export type ReceiveEmailResult =
  | "filed"
  /** Already filed: the webhook was delivered again. */
  | "duplicate"
  /** Not an inquiry: our own mail, an auto-reply, a list, nothing to read. */
  | "ignored"
  /** Over the hourly cap. The caller answers so the provider retries later. */
  | "busy"
  /** The content could not be read from the provider. Retried by the provider. */
  | "unreadable"
  /** No study is taking inquiries. */
  | "noStudy";

/**
 * An email received at the study's address (D-118) becomes an inquiry, exactly
 * as if it had come from the contact form: same inbox, same notification, same
 * erasure once it is answered or closed.
 *
 * The study is the one open for recruitment, as for the contact form; failing
 * that, the one active study that has a team mailbox. The email's text is read
 * from the provider, held in memory, and stored only as the inquiry's message.
 */
export async function receiveEmailInquiry(providerEmailId: string): Promise<ReceiveEmailResult> {
  const fetched = await fetchReceivedEmail(providerEmailId);
  if (!fetched.ok) return "unreadable";
  const email = fetched.email;

  const own = [ownSenderAddress()].filter((a): a is string => Boolean(a));
  const reason = ignoreReason(email, own);
  if (reason) {
    logger.info({ event: "inquiry.email_ignored", reason }, "received email not filed");
    return "ignored";
  }
  const input = inquiryFromEmail(email);
  if (!input) {
    logger.info({ event: "inquiry.email_ignored", reason: "empty" }, "received email not filed");
    return "ignored";
  }

  const studyId = await inquiryStudyId();
  if (!studyId) {
    logger.error({ event: "inquiry.email_no_study" }, "received email has no study to go to");
    return "noStudy";
  }

  const result = await fileInquiry({
    studyId,
    locale: "es",
    input,
    source: "EMAIL",
    externalRef: providerEmailId,
  });
  if (result === "unavailable") return "busy";
  if (result === "duplicate") return "duplicate";
  return "filed";
}

async function inquiryStudyId(): Promise<string | null> {
  const db = getDb();
  const [open] = await db
    .select({ id: studies.id })
    .from(studies)
    .where(and(eq(studies.status, "ACTIVE"), eq(studies.recruitmentOpen, true)))
    .orderBy(asc(studies.createdAt))
    .limit(1);
  if (open) return open.id;
  const withMailbox = await db
    .select({ id: studies.id })
    .from(studies)
    .where(and(eq(studies.status, "ACTIVE"), isNotNull(studies.contactEmail)))
    .limit(2);
  return withMailbox.length === 1 ? withMailbox[0].id : null;
}

/**
 * Emails everyone who holds `inquiries.manage` in the study, and the team
 * mailbox when one is set (`studies.contact_email`, D-116). Best effort, logged.
 */
async function notifyStaff(studyId: string): Promise<void> {
  try {
    const db = getDb();
    const [study] = await db
      .select({ contactEmail: studies.contactEmail })
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);
    const rows = await db
      .select({ email: users.email, role: userRoles.role })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(userRoles.studyId, studyId), isNull(userRoles.revokedAt), eq(users.active, true)));

    const byEmail = new Map<string, StaffRole[]>();
    for (const r of rows) {
      if (!isStaffRole(r.role)) continue;
      byEmail.set(r.email, [...(byEmail.get(r.email) ?? []), r.role]);
    }
    const to = [...byEmail].filter(([, roles]) => hasPermission(roles, "inquiries.manage")).map(([email]) => email);
    const mailbox = study?.contactEmail?.trim();
    if (mailbox && !to.some((e) => e.toLowerCase() === mailbox.toLowerCase())) to.push(mailbox);
    if (to.length === 0) return;

    const [{ n }] = await db
      .select({ n: count() })
      .from(inquiries)
      .where(and(eq(inquiries.studyId, studyId), eq(inquiries.status, "NEW")));

    const { APP_URL } = getEnv();
    const mail = staffNotification({
      count: n,
      inboxUrl: APP_URL ? `${APP_URL.replace(/\/$/, "")}${TEAM_BASE_PATH}/consultas` : null,
    });
    const result = await sendMail({ to, ...mail });
    if (!result.ok) logger.warn({ event: "inquiry.notify_skipped", reason: result.reason }, "staff not emailed");
  } catch (err) {
    logger.error({ event: "inquiry.notify_failed", err: err instanceof Error ? err.message : String(err) }, "notify failed");
  }
}

/** An inquiry plus the name of whoever handled it (null while pending). */
export type InquiryRow = Inquiry & { handledByName: string | null };

const rowColumns = { ...getTableColumns(inquiries), handledByName: users.displayName };

/** Newest first, like a chat list: pending by arrival, handled by when they were handled. */
export async function listInquiries(studyId: string, opts: { status?: InquiryStatus } = {}): Promise<InquiryRow[]> {
  return getDb()
    .select(rowColumns)
    .from(inquiries)
    .leftJoin(users, eq(users.id, inquiries.handledBy))
    .where(and(eq(inquiries.studyId, studyId), opts.status ? eq(inquiries.status, opts.status) : undefined))
    .orderBy(opts.status === "NEW" || !opts.status ? desc(inquiries.createdAt) : desc(inquiries.handledAt));
}

/** One inquiry of this study, in whatever state, or null. */
export async function getInquiry(studyId: string, inquiryId: string): Promise<InquiryRow | null> {
  const [row] = await getDb()
    .select(rowColumns)
    .from(inquiries)
    .leftJoin(users, eq(users.id, inquiries.handledBy))
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.studyId, studyId)))
    .limit(1);
  return row ?? null;
}

export async function countNewInquiries(studyId: string): Promise<number> {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(inquiries)
    .where(and(eq(inquiries.studyId, studyId), eq(inquiries.status, "NEW")));
  return n;
}

/**
 * Send the reply by email, THEN erase the inquiry's text and mark it answered,
 * in one transaction with its audit row. If the email is not sent, nothing
 * changes and the inquiry stays NEW with its text, so an answer is never lost
 * as "answered". The reply text is not stored. The staff member's address is the
 * Reply-To, so the person's next message reaches them directly.
 *
 * The caller must already have asserted `inquiries.manage`.
 */
export async function answerInquiry(params: {
  studyId: string;
  inquiryId: string;
  actorId: string;
  reply: string;
}): Promise<void> {
  const { studyId, inquiryId, actorId, reply } = params;
  const db = getDb();

  const [inquiry] = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.studyId, studyId), eq(inquiries.status, "NEW")))
    .limit(1);
  if (!inquiry || !inquiry.email || !inquiry.message) throw new InquiryNotFoundError();

  const [actor] = await db.select({ email: users.email }).from(users).where(eq(users.id, actorId)).limit(1);
  const mail = replyEmail({ locale: inquiry.locale as InquiryLocale, reply, question: inquiry.message });
  const sent = await sendMail({ to: [inquiry.email], replyTo: actor?.email, ...mail });
  if (!sent.ok) throw new InquiryMailError(sent.reason);

  await handle(studyId, inquiryId, actorId, "ANSWERED");
}

/** Close without replying (spam, or answered elsewhere). Erases the text like an answer does. */
export async function closeInquiry(params: { studyId: string; inquiryId: string; actorId: string }): Promise<void> {
  await handle(params.studyId, params.inquiryId, params.actorId, "CLOSED");
}

async function handle(studyId: string, inquiryId: string, actorId: string, status: "ANSWERED" | "CLOSED") {
  await getDb().transaction(async (tx) => {
    const updated = await tx
      .update(inquiries)
      .set({ status, name: null, email: null, message: null, handledBy: actorId, handledAt: new Date() })
      .where(and(eq(inquiries.id, inquiryId), eq(inquiries.studyId, studyId), inArray(inquiries.status, ["NEW"])))
      .returning({ id: inquiries.id });
    if (updated.length === 0) throw new InquiryNotFoundError();

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: status === "ANSWERED" ? "inquiry.answered" : "inquiry.closed",
      entityType: "inquiry",
      entityId: inquiryId,
      before: { status: "NEW" },
      after: { status },
    });
  });
}
