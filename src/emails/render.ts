import "server-only";
import { getEnv } from "@/config/env";
import { PUBLIC_BASE_PATH } from "@/domain/navigation";
import type { InquiryLocale } from "@/domain/inquiry-mail";
import { LOGO_CID, inquiryReplyHtml, participantMessageHtml, staffNoticeHtml } from "./html";
import { LOGO_PNG_BASE64 } from "./logo";

/**
 * The branded HTML part of the Hub's emails (D-119), with the inline logo it
 * refers to. The plain-text part is still written by the callers
 * (`inquiry-mail.ts`, the rendered template) and always sent alongside.
 */

export interface InlineAttachment {
  filename: string;
  content: string;
  content_id: string;
}

/** The 112px logo (~6 KB), attached inline as `cid:clear-light-logo`. */
export function logoAttachment(): InlineAttachment {
  return { filename: "clear-light.png", content: LOGO_PNG_BASE64, content_id: LOGO_CID };
}

/** The public study page, for footers. Null when the app's address is unknown. */
function siteUrl(): string | null {
  const { APP_URL } = getEnv();
  return APP_URL ? `${APP_URL.replace(/\/$/, "")}${PUBLIC_BASE_PATH}` : null;
}

export function staffNotice(params: { count: number; inboxUrl: string | null }): string {
  return staffNoticeHtml(params);
}

export function inquiryReply(params: { locale: InquiryLocale; reply: string; question: string }): string {
  return inquiryReplyHtml({ ...params, siteUrl: siteUrl() });
}

export function participantMessage(params: { subject: string; body: string }): string {
  return participantMessageHtml({ ...params, siteUrl: siteUrl() });
}
