import "server-only";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Outbound email through Resend (D-088). The only HTTP client in the
 * application that talks to a person's inbox, and deliberately tiny: one
 * function, no queue, no retries, no delivery tracking. D-043 still holds for
 * automation: nothing scheduled or rule-driven calls this. It is used by the
 * inquiry inbox, where a person presses "send" or a visitor submits a question.
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
}

const RESEND_URL = "https://api.resend.com/emails";

export async function sendMail(input: MailInput): Promise<MailResult> {
  const { RESEND_API_KEY, MAIL_FROM } = getEnv();
  if (!RESEND_API_KEY || !MAIL_FROM) return { ok: false, reason: "not_configured" };
  if (input.to.length === 0) return { ok: true };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
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
