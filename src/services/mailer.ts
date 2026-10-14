import "server-only";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Outbound email through Resend (D-088). The only HTTP client in the
 * application that talks to a person's inbox, and deliberately tiny: one
 * function, no queue, no retries, no delivery tracking. Two callers: the
 * inquiry inbox (a person presses "send", or a visitor submits a question) and
 * `email-delivery.ts`, which sends the AUTOMATIC emails D-116 allows. It also
 * reads an email received at the study's address (D-118), for the inbox.
 *
 * It never logs an address or a body.
 */
export type MailResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "rejected" | "network" };

export interface MailInput {
  to: readonly string[];
  subject: string;
  text: string;
  replyTo?: string;
  /**
   * Resend drops a second request with the same key for 24 hours, so a
   * processor run that overlaps or retries cannot send the same email twice.
   */
  idempotencyKey?: string;
}

const RESEND_URL = "https://api.resend.com/emails";

/** An email received at the study's address, as Resend returns it (D-118). */
export interface ReceivedEmailResponse {
  id: string;
  from: string;
  to: string[] | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  headers: Record<string, string | string[] | undefined> | null;
}

/**
 * Fetch a received email's content. The webhook carries only its id, by
 * Resend's design; the body is read here, held in memory, and never logged.
 */
export async function fetchReceivedEmail(
  id: string,
): Promise<{ ok: true; email: ReceivedEmailResponse } | { ok: false; reason: "not_configured" | "rejected" | "network" }> {
  const { RESEND_API_KEY } = getEnv();
  if (!RESEND_API_KEY) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.warn({ event: "mail.receive_rejected", status: res.status }, "provider refused a received email");
      return { ok: false, reason: "rejected" };
    }
    return { ok: true, email: (await res.json()) as ReceivedEmailResponse };
  } catch (err) {
    logger.warn({ event: "mail.receive_network", err: err instanceof Error ? err.name : "unknown" }, "fetch failed");
    return { ok: false, reason: "network" };
  }
}

/** The bare address in MAIL_FROM (`Name <a@b>` → `a@b`), to recognise our own mail. */
export function ownSenderAddress(): string | null {
  const { MAIL_FROM } = getEnv();
  if (!MAIL_FROM) return null;
  const m = MAIL_FROM.match(/<([^<>]+)>/);
  return (m ? m[1] : MAIL_FROM).trim().toLowerCase();
}

/** Whether a sender is configured at all. Checked before claiming work to send. */
export function isMailConfigured(): boolean {
  const { RESEND_API_KEY, MAIL_FROM } = getEnv();
  return Boolean(RESEND_API_KEY && MAIL_FROM);
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const { RESEND_API_KEY, MAIL_FROM } = getEnv();
  if (!RESEND_API_KEY || !MAIL_FROM) return { ok: false, reason: "not_configured" };
  if (input.to.length === 0) return { ok: true };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.warn({ event: "mail.rejected", status: res.status }, "mail provider rejected a message");
      return { ok: false, reason: "rejected" };
    }
    return { ok: true };
  } catch (err) {
    logger.warn({ event: "mail.network", err: err instanceof Error ? err.name : "unknown" }, "mail send failed");
    return { ok: false, reason: "network" };
  }
}
