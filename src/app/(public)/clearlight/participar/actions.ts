"use server";

import { getPublicLocale } from "@/i18n/public-locale";
import { logger } from "@/lib/logger";
import {
  fullNameOf,
  normalizeInterest,
  validateInterest,
  type InterestError,
  type InterestField,
} from "@/domain/interest";
import { getOpenRecruitmentStudy, submitInterest } from "@/services/recruitment";

export type InterestState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<InterestField, InterestError>>; privacy?: boolean }
  | { status: "closed" }
  | { status: "failed" }
  // Deliberately no participant code: it is derived from the person's name (D-087), and
  // returning it for an email that already applied would reveal a stranger's initials.
  | { status: "ok" };

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * The public expression of interest (D-086). Reads exactly three facts (the
 * name as first name and surname, email, phone), plus the privacy
 * acknowledgement and a honeypot; anything else in the request is ignored. The study is the one open for recruitment, decided here on the
 * server, never taken from the request.
 */
export async function submitInterestAction(_prev: InterestState, form: FormData): Promise<InterestState> {
  // Honeypot: a field people never see. A filled one is a bot; answer as if it
  // worked so the bot learns nothing, and write nothing.
  if (text(form, "website")) return { status: "ok" };

  const input = normalizeInterest({
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email"),
    phone: text(form, "phone"),
  });
  const errors = validateInterest(input);
  const privacy = form.get("privacy") === "on";
  if (Object.keys(errors).length > 0 || !privacy) {
    return { status: "invalid", errors, privacy: !privacy };
  }

  try {
    const study = await getOpenRecruitmentStudy();
    if (!study?.screeningUrl) return { status: "closed" };
    // Participant records know es/en only; study content is Spanish first, so
    // a visitor reading the site in Galician is recorded as es.
    const publicLocale = await getPublicLocale();
    await submitInterest({
      studyId: study.id,
      locale: publicLocale === "en" ? "en" : "es",
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: fullNameOf(input),
      email: input.email,
      phone: input.phone,
    });
    return { status: "ok" };
  } catch (err) {
    // No contact details in the log line.
    logger.error({ err }, "participar: could not record an expression of interest");
    return { status: "failed" };
  }
}
