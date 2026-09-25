/**
 * Public inquiries (D-088): a visitor's question before applying, answered by
 * staff in the Hub and by email.
 *
 * BOUNDARY. This is the one place the Hub holds free text typed by the public,
 * and a box like that can end up holding a health detail whatever the note above
 * it says. So the text is kept only while the inquiry is open: answering or
 * closing it erases the name, email and message (`inquiries_handled_has_no_text`
 * in migration 0023), and the reply text is never stored at all. Staff are
 * notified by email WITHOUT the question in it, only that one arrived.
 */

export const INQUIRY_STATUSES = ["NEW", "ANSWERED", "CLOSED"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_NAME_MAX_LENGTH = 120;
export const INQUIRY_EMAIL_MAX_LENGTH = 200;
export const INQUIRY_MESSAGE_MAX_LENGTH = 1000;
export const INQUIRY_REPLY_MAX_LENGTH = 4000;

/** More new inquiries than this in an hour are refused (there is no other rate limit). */
export const INQUIRY_HOURLY_CAP = 30;
/** Staff are emailed for the first few inquiries in an hour, not for a flood. */
export const INQUIRY_NOTIFY_PER_HOUR = 5;

export interface InquiryInput {
  name: string;
  email: string;
  message: string;
}

export type InquiryField = keyof InquiryInput;
export type InquiryError = "required" | "tooLong" | "invalidEmail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeInquiry(raw: InquiryInput): InquiryInput {
  return {
    name: raw.name.trim().replace(/\s+/g, " "),
    email: raw.email.trim(),
    // Keep the visitor's line breaks; only trim the ends.
    message: raw.message.trim(),
  };
}

export function validateInquiry(input: InquiryInput): Partial<Record<InquiryField, InquiryError>> {
  const errors: Partial<Record<InquiryField, InquiryError>> = {};
  if (!input.name) errors.name = "required";
  else if (input.name.length > INQUIRY_NAME_MAX_LENGTH) errors.name = "tooLong";

  if (!input.email) errors.email = "required";
  else if (input.email.length > INQUIRY_EMAIL_MAX_LENGTH) errors.email = "tooLong";
  else if (!EMAIL_PATTERN.test(input.email)) errors.email = "invalidEmail";

  if (!input.message) errors.message = "required";
  else if (input.message.length > INQUIRY_MESSAGE_MAX_LENGTH) errors.message = "tooLong";
  return errors;
}

export function validateReply(reply: string): "required" | "tooLong" | null {
  const text = reply.trim();
  if (!text) return "required";
  if (text.length > INQUIRY_REPLY_MAX_LENGTH) return "tooLong";
  return null;
}

export function isInquiryStatus(v: unknown): v is InquiryStatus {
  return typeof v === "string" && (INQUIRY_STATUSES as readonly string[]).includes(v);
}
