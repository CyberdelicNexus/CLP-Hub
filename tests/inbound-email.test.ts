import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INQUIRY_EMAIL_MESSAGE_MAX_LENGTH,
  htmlToText,
  ignoreReason,
  inquiryFromEmail,
  parseAddress,
  stripQuoted,
  type ReceivedEmail,
} from "@/domain/inbound-email";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

const email = (over: Partial<ReceivedEmail> = {}): ReceivedEmail => ({
  from: '"Ana Prueba" <Ana@Example.com>',
  subject: "Duda sobre el estudio",
  text: "Hola, ¿cuántas sesiones son?\n\nGracias",
  html: null,
  headers: {},
  ...over,
});

describe("emails to the study's address become inquiries (D-118)", () => {
  it("reads a display name and a lowercased address", () => {
    expect(parseAddress('"Ana Prueba" <Ana@Example.com>')).toEqual({ name: "Ana Prueba", email: "ana@example.com" });
    expect(parseAddress("ana@example.com")).toEqual({ name: null, email: "ana@example.com" });
    expect(parseAddress("not an address")).toEqual({ name: null, email: null });
  });

  it("files the subject and the text, signed by the sender", () => {
    expect(inquiryFromEmail(email())).toEqual({
      name: "Ana Prueba",
      email: "ana@example.com",
      message: "Duda sobre el estudio\n\nHola, ¿cuántas sesiones son?\n\nGracias",
    });
  });

  it("uses the part before @ when the sender has no name", () => {
    expect(inquiryFromEmail(email({ from: "ana.prueba@example.com" }))?.name).toBe("ana.prueba");
  });

  /** A reply should not refile the whole thread, including our own answer. */
  it("drops quoted history", () => {
    const text = "Muchas gracias.\n\nEl lun, 13 oct 2026 a las 10:00, Clear Light escribió:\n> Hola Ana\n> respuesta";
    expect(stripQuoted(text)).toBe("Muchas gracias.");
    expect(stripQuoted("Thanks!\nOn Mon, Oct 13, 2026 at 10:00 Clear Light wrote:\n> hi")).toBe("Thanks!");
  });

  it("reads an HTML-only email as text", () => {
    const html = "<p>Hola <b>equipo</b></p><p>Una pregunta&nbsp;rápida</p><style>p{}</style>";
    expect(htmlToText(html).trim()).toBe("Hola equipo\nUna pregunta rápida");
    expect(inquiryFromEmail(email({ text: null, html }))?.message).toBe(
      "Duda sobre el estudio\n\nHola equipo\nUna pregunta rápida",
    );
  });

  it("cuts a long email to what the inbox holds", () => {
    const message = inquiryFromEmail(email({ text: "a".repeat(9000) }))?.message ?? "";
    expect(message.length).toBe(INQUIRY_EMAIL_MESSAGE_MAX_LENGTH);
    expect(message.endsWith("…")).toBe(true);
  });

  it("files nothing for an email with nothing to read", () => {
    expect(inquiryFromEmail(email({ subject: null, text: "  " }))).toBeNull();
  });

  /** A notification the Hub sent, bounced back to info@, would loop forever. */
  it("ignores the Hub's own mail, auto-replies and lists", () => {
    expect(ignoreReason(email({ from: "Clear Light <info@numadelic.org>" }), ["info@numadelic.org"])).toBe("ownSender");
    expect(ignoreReason(email({ headers: { "Auto-Submitted": "auto-replied" } }), [])).toBe("autoReply");
    expect(ignoreReason(email({ headers: { "auto-submitted": "no" } }), [])).toBeNull();
    expect(ignoreReason(email({ headers: { Precedence: "bulk" } }), [])).toBe("bulk");
    expect(ignoreReason(email({ headers: { "List-Unsubscribe": "<mailto:x@y.z>" } }), [])).toBe("bulk");
    expect(ignoreReason(email({ from: "nobody" }), [])).toBe("noSender");
    expect(ignoreReason(email(), ["info@numadelic.org"])).toBeNull();
  });

  it("allows a longer message for an email than for the form, in the database too", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0027_inquiry_email_source.sql"), "utf8");
    expect(sql).toMatch(/case when source = 'EMAIL' then 5000 else 1000 end/);
    expect(sql).toMatch(/inquiries_external_ref_unique/);
  });
});

describe("the Resend webhook signature (Svix scheme)", () => {
  const key = Buffer.from("a-test-signing-key-32-bytes-long!").toString("base64");
  const secret = `whsec_${key}`;
  const now = new Date("2026-10-14T12:00:00Z");
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const body = '{"type":"email.received","data":{"email_id":"abc"}}';
  const sign = (b: string, ts = timestamp, id = "msg_1") =>
    `v1,${createHmac("sha256", Buffer.from(key, "base64")).update(`${id}.${ts}.${b}`).digest("base64")}`;

  it("accepts a correctly signed request", () => {
    expect(verifyWebhookSignature({ id: "msg_1", timestamp, signature: sign(body), body, secret, now })).toBe(true);
  });

  it("accepts any one of several signatures (a key rotation)", () => {
    const signature = `v1,AAAA ${sign(body)}`;
    expect(verifyWebhookSignature({ id: "msg_1", timestamp, signature, body, secret, now })).toBe(true);
  });

  it("refuses a changed body, a wrong id, a missing header", () => {
    expect(verifyWebhookSignature({ id: "msg_1", timestamp, signature: sign(body), body: body + " ", secret, now })).toBe(false);
    expect(verifyWebhookSignature({ id: "msg_2", timestamp, signature: sign(body), body, secret, now })).toBe(false);
    expect(verifyWebhookSignature({ id: null, timestamp, signature: sign(body), body, secret, now })).toBe(false);
  });

  it("refuses a replay older than five minutes", () => {
    const old = String(Number(timestamp) - 6 * 60);
    expect(verifyWebhookSignature({ id: "msg_1", timestamp: old, signature: sign(body, old), body, secret, now })).toBe(false);
  });

  it("is closed when no secret is configured", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/webhooks/resend/route.ts"), "utf8");
    expect(route).toMatch(/if \(!RESEND_WEBHOOK_SECRET\) return NextResponse\.json\(\{ error: "closed" \}, \{ status: 503 \}\)/);
  });
});
