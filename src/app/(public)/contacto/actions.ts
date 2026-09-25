"use server";

import { getPublicLocale } from "@/i18n/public-locale";
import { logger } from "@/lib/logger";
import { normalizeInquiry, validateInquiry, type InquiryError, type InquiryField } from "@/domain/inquiry";
import { submitInquiry } from "@/services/inquiries";
import { getOpenRecruitmentStudy } from "@/services/recruitment";

export type InquiryState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<InquiryField, InquiryError>> }
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "ok" };

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * The public contact form (D-088). Reads exactly a name, an email and a
 * message, plus a honeypot; anything else in the request is ignored. The study
 * is the one open for recruitment, decided here on the server. The answer to a
 * caller never says whether anything was stored beyond ok/unavailable.
 */
export async function submitInquiryAction(_prev: InquiryState, form: FormData): Promise<InquiryState> {
  // Honeypot: a filled hidden field is a bot. Answer as if it worked, write nothing.
  if (text(form, "website")) return { status: "ok" };

  const input = normalizeInquiry({
    name: text(form, "nombre"),
    email: text(form, "email"),
    message: text(form, "mensaje"),
  });
  const errors = validateInquiry(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };

  try {
    const study = await getOpenRecruitmentStudy();
    if (!study) return { status: "unavailable" };
    const result = await submitInquiry({ studyId: study.id, locale: await getPublicLocale(), input });
    return result === "ok" ? { status: "ok" } : { status: "unavailable" };
  } catch (err) {
    // Nothing the visitor typed goes into the log line.
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "contacto: could not record an inquiry");
    return { status: "failed" };
  }
}
