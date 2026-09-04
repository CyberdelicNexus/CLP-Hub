"use server";

import { getLocale } from "next-intl/server";
import { parseLocale } from "@/domain/locale";
import { validateAnswers, type ErrorKey, type FormQuestion } from "@/domain/application-form";
import { logger } from "@/lib/logger";
import { getActiveQuestions, getOpenRecruitmentStudy, submitApplication } from "@/services/recruitment";

export interface SubmitState {
  status: "idle" | "success" | "error";
  /** Per-question message keys, by question key. */
  errors: Record<string, ErrorKey>;
  /** Form-level failure. */
  formError: "closed" | "failed" | "tooFast" | null;
  /** Echoed back so a rejected form keeps what the person typed. */
  values: Record<string, string | string[]>;
  /**
   * Submission counter. The client keys the form on it so a rejected attempt
   * remounts the inputs, which re-applies the echoed values at initialisation
   * instead of mutating an already-initialised uncontrolled field.
   */
  attempt: number;
}

// NOTE: every export of a "use server" module must be an async function, so the
// initial state lives in the client component, not here.

/** A submission faster than this was not typed by a person. */
const MIN_FILL_MS = 1500;

/**
 * Public application submission.
 *
 * Untrusted input, no authentication. Three things matter here:
 *  - The study is resolved on the server, never taken from the form, so a
 *    crafted request cannot file an application against another study.
 *  - Question configuration is re-read on the server, so the set of questions
 *    and their options cannot be tampered with client-side.
 *  - No participant data is ever written to the log.
 *
 * Anti-abuse is deliberately minimal: a honeypot field and a fill-time floor.
 * These stop naive bots only. A captcha or WAF plus IP rate limiting is a
 * documented prerequisite before this form is exposed to real traffic
 * (docs/research-data-boundaries.md, open item 1).
 */
export async function submitPublicApplication(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const values = collectValues(formData);
  const attempt = _prev.attempt + 1;

  // Honeypot: a hidden field real people never fill in.
  if ((formData.get("website") as string | null)?.trim()) {
    logger.info({ event: "application.honeypot" }, "public application rejected by honeypot");
    // Report success so a bot learns nothing from the response.
    return { status: "success", errors: {}, formError: null, values: {}, attempt };
  }

  // Unlike the honeypot, this asks the person to retry rather than pretending to
  // succeed: the floor is timed from server render, so an unusually fast human
  // can trip it, and silently discarding a real application would be worse than
  // telling a bot it was throttled.
  const renderedAt = Number(formData.get("renderedAt"));
  if (Number.isFinite(renderedAt) && Date.now() - renderedAt < MIN_FILL_MS) {
    logger.info({ event: "application.too_fast" }, "public application rejected by fill-time floor");
    return { status: "error", errors: {}, formError: "tooFast", values, attempt };
  }

  const study = await getOpenRecruitmentStudy();
  if (!study) {
    return { status: "error", errors: {}, formError: "closed", values, attempt };
  }

  const configured = await getActiveQuestions(study.id);
  const questions: FormQuestion[] = configured.map((q) => ({
    id: q.id,
    key: q.key,
    type: q.type,
    required: q.required,
    options: q.options ?? null,
  }));

  const result = validateAnswers(questions, values);
  if (!result.ok) {
    return { status: "error", errors: result.errors, formError: null, values, attempt };
  }

  try {
    const locale = parseLocale(await getLocale());
    const outcome = await submitApplication({
      studyId: study.id,
      locale,
      questions,
      values: result.values,
    });
    logger.info(
      {
        event: "application.submitted",
        studyId: study.id,
        deduplicated: outcome.deduplicated,
        // Never log the applicant's name, email, phone or answers.
      },
      "public application received",
    );
  } catch (err) {
    logger.error(
      { event: "application.failed", err: err instanceof Error ? err.message : String(err) },
      "public application failed",
    );
    return { status: "error", errors: {}, formError: "failed", values, attempt };
  }

  return { status: "success", errors: {}, formError: null, values: {}, attempt };
}

/** FormData → plain record, preserving multi-value fields as arrays. */
function collectValues(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key === "website" || key === "renderedAt") continue;
    const all = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (all.length === 0) continue;
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}
