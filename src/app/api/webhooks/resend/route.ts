import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";
import { verifyWebhookSignature } from "@/lib/webhook-signature";
import { receiveEmailInquiry } from "@/services/inquiries";

/**
 * Resend's webhook for emails received at the study's address (D-118).
 *
 * Resend posts `email.received` with the email's id only; the service reads the
 * content and files it in the inquiry inbox. Every request must carry a valid
 * signature for `RESEND_WEBHOOK_SECRET`; with the secret unset the endpoint
 * refuses everything (503), so an unconfigured deployment is closed.
 *
 * Status codes are chosen for Resend's retries: 2xx means "done, do not send it
 * again" (filed, already filed, or deliberately not filed); 503 means "try
 * again later" (over the hourly cap, or the content could not be read yet).
 * Filing is idempotent on the email's id, so a retry cannot file it twice.
 *
 * The response carries no content: an outcome word, never a name or text.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { RESEND_WEBHOOK_SECRET } = getEnv();
  if (!RESEND_WEBHOOK_SECRET) return NextResponse.json({ error: "closed" }, { status: 503 });

  // The exact bytes: re-serialised JSON would not match the signature.
  const body = await request.text();
  const valid = verifyWebhookSignature({
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
    secret: RESEND_WEBHOOK_SECRET,
  });
  if (!valid) {
    logger.warn({ event: "webhook.resend.refused" }, "webhook signature refused");
    return NextResponse.json({ error: "refused" }, { status: 401 });
  }

  let event: { type?: unknown; data?: { email_id?: unknown; id?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Other event types (delivered, bounced, ...) are not used here.
  if (event.type !== "email.received") return NextResponse.json({ outcome: "skipped" });

  const emailId = typeof event.data?.email_id === "string" ? event.data.email_id : null;
  if (!emailId || emailId.length > 100) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const outcome = await receiveEmailInquiry(emailId);
    logger.info({ event: "webhook.resend.received", outcome }, "received email handled");
    if (outcome === "busy" || outcome === "unreadable") {
      return NextResponse.json({ outcome }, { status: 503 });
    }
    return NextResponse.json({ outcome });
  } catch (err) {
    logger.error(
      { event: "webhook.resend.failed", err: err instanceof Error ? err.message : String(err) },
      "received email failed",
    );
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
