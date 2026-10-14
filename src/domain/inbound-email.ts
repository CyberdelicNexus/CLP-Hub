/**
 * Emails sent to the study's address, filed in the inquiry inbox (D-118).
 *
 * Pure: no database, no network. `src/services/inquiries.ts` fetches the
 * received email from the provider and hands it here to be turned into an
 * inquiry, or to be ignored with a reason.
 *
 * The same boundary as the contact form (D-088) applies, because it is the same
 * thing arriving by another door: the text is kept only while the inquiry is
 * open, and erased when it is answered or closed.
 */

import { INQUIRY_EMAIL_MAX_LENGTH, INQUIRY_NAME_MAX_LENGTH } from "./inquiry";

/** An email is longer than a form box; 0027 allows this much for one. */
export const INQUIRY_EMAIL_MESSAGE_MAX_LENGTH = 5000;

export interface ReceivedEmail {
  from: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  headers: Record<string, string | string[] | undefined> | null;
}

export type IgnoreReason =
  /** Sent by the Hub itself: a notification that bounced back would loop forever. */
  | "ownSender"
  /** An out-of-office or other machine reply (RFC 3834). Answering it helps nobody. */
  | "autoReply"
  /** A mailing list or bulk sender. */
  | "bulk"
  /** No usable sender address to answer. */
  | "noSender"
  /** Nothing to read once quoted history and signatures are removed. */
  | "empty";

const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

/** `"Ana Prueba" <ana@example.com>` → name and address. A bare address has no name. */
export function parseAddress(raw: string): { name: string | null; email: string | null } {
  const value = raw.trim();
  const angle = value.match(/^(.*)<([^<>]+)>\s*$/);
  const email = (angle ? angle[2] : value).trim().toLowerCase();
  const name = angle ? angle[1].trim().replace(/^"(.*)"$/, "$1").trim() : "";
  return { name: name || null, email: EMAIL_PATTERN.test(email) ? email : null };
}

/** Readable text from an HTML body, for an email that came without a text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * The new part of an email: the quoted history below "On … wrote:" / "El … escribió:"
 * and `>` lines are dropped, so a reply does not refile the whole thread.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*(On|El|O)\s.+(wrote|escribió|escribiu):\s*$/i.test(line)) break;
    if (/^-{2,}\s*(Original Message|Mensaje original|Mensaxe orixinal)\s*-{2,}$/i.test(line.trim())) break;
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function header(headers: ReceivedEmail["headers"], name: string): string {
  if (!headers) return "";
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const value = key ? headers[key] : undefined;
  return (Array.isArray(value) ? value.join(" ") : (value ?? "")).toLowerCase();
}

/** Why an email should not become an inquiry, or null if it should. */
export function ignoreReason(email: ReceivedEmail, ownAddresses: readonly string[]): IgnoreReason | null {
  const { email: sender } = parseAddress(email.from);
  if (!sender) return "noSender";
  if (ownAddresses.some((a) => a.toLowerCase() === sender)) return "ownSender";
  const auto = header(email.headers, "auto-submitted");
  if (auto && auto !== "no") return "autoReply";
  if (header(email.headers, "x-autoreply") || header(email.headers, "x-autorespond")) return "autoReply";
  const precedence = header(email.headers, "precedence");
  if (["bulk", "junk", "list", "auto_reply"].includes(precedence)) return "bulk";
  if (header(email.headers, "list-id") || header(email.headers, "list-unsubscribe")) return "bulk";
  return null;
}

/**
 * The inquiry an email becomes: who sent it, and its subject and new text as the
 * message, cut to what the inbox holds. Null when there is nothing to file.
 */
export function inquiryFromEmail(email: ReceivedEmail): { name: string; email: string; message: string } | null {
  const sender = parseAddress(email.from);
  if (!sender.email) return null;

  const body = stripQuoted(email.text?.trim() ? email.text : email.html ? htmlToText(email.html) : "");
  const subject = email.subject?.trim().replace(/\s+/g, " ") ?? "";
  if (!body && !subject) return null;

  let message = subject ? `${subject}\n\n${body}`.trim() : body;
  if (message.length > INQUIRY_EMAIL_MESSAGE_MAX_LENGTH) {
    message = `${message.slice(0, INQUIRY_EMAIL_MESSAGE_MAX_LENGTH - 1).trimEnd()}…`;
  }

  // The display name, or the part before @ when there is none.
  const name = (sender.name ?? sender.email.split("@")[0]).slice(0, INQUIRY_NAME_MAX_LENGTH);
  if (sender.email.length > INQUIRY_EMAIL_MAX_LENGTH) return null;

  return { name, email: sender.email, message };
}
