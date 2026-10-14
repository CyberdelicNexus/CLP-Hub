import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a webhook signed the Svix way, which is how Resend signs its webhooks
 * (D-118). Written out rather than adding the `svix` package for one function.
 *
 * - Signed content: `${svix-id}.${svix-timestamp}.${raw body}`.
 * - Key: the secret after its `whsec_` prefix, base64-decoded.
 * - Signature: HMAC-SHA256, base64. The `svix-signature` header holds one or
 *   more space-separated `v1,<base64>` entries (several during a key rotation);
 *   any one matching is enough.
 * - Replay: a timestamp more than five minutes from now is refused.
 *
 * The body must be the exact bytes received: re-serialised JSON would not match.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhookSignature(params: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  secret: string;
  now?: Date;
}): boolean {
  const { id, timestamp, signature, body, secret } = params;
  if (!id || !timestamp || !signature) return false;

  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds)) return false;
  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - seconds) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const provided = Buffer.from(value, "base64");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
}
