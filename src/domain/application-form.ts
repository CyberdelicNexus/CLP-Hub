/**
 * Pure validation of application answers against the study's configured
 * questions. No I/O, no database: unit-testable on its own.
 *
 * The questions are configuration rows, so the shape of the form is not known
 * at compile time. This validates whatever was configured, and nothing here
 * interprets an answer or derives eligibility from it (non-negotiable 3).
 */
import {
  LONG_TEXT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  type QuestionType,
} from "./recruitment";

export interface FormQuestion {
  id: string;
  key: string;
  type: QuestionType;
  required: boolean;
  options?: { value: string }[] | null;
}

export type AnswerValue = string | string[] | boolean;

export interface ValidationResult {
  ok: boolean;
  /** Answers to persist, keyed by question id. Absent when a question was left blank. */
  values: Map<string, AnswerValue>;
  /** Error message keys, by question key. Rendered through next-intl. */
  errors: Record<string, ErrorKey>;
}

export type ErrorKey = "required" | "invalidEmail" | "invalidOption" | "tooLong" | "invalidDate";

// Deliberately permissive: this rejects obvious typos, not exotic-but-valid
// addresses. Deliverability is confirmed by contacting the person, not by regex.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateAnswers(
  questions: readonly FormQuestion[],
  raw: Readonly<Record<string, string | string[] | undefined>>,
): ValidationResult {
  const values = new Map<string, AnswerValue>();
  const errors: Record<string, ErrorKey> = {};

  for (const q of questions) {
    const input = raw[q.key];
    const error = (key: ErrorKey) => {
      errors[q.key] = key;
    };

    if (q.type === "MULTI_SELECT") {
      const selected = (Array.isArray(input) ? input : input ? [input] : []).filter(Boolean);
      if (selected.length === 0) {
        if (q.required) error("required");
        continue;
      }
      const allowed = new Set((q.options ?? []).map((o) => o.value));
      if (selected.some((v) => !allowed.has(v))) {
        error("invalidOption");
        continue;
      }
      values.set(q.id, selected);
      continue;
    }

    if (q.type === "BOOLEAN") {
      // An unchecked box submits nothing. Required means "must be checked",
      // which is how consent-to-be-contacted is expressed.
      const checked = input === "on" || input === "true";
      if (q.required && !checked) {
        error("required");
        continue;
      }
      values.set(q.id, checked);
      continue;
    }

    const text = (Array.isArray(input) ? input[0] : input)?.trim() ?? "";
    if (text.length === 0) {
      if (q.required) error("required");
      continue;
    }

    switch (q.type) {
      case "EMAIL":
        if (!EMAIL_PATTERN.test(text)) {
          error("invalidEmail");
          continue;
        }
        break;
      case "DATE":
        if (!DATE_PATTERN.test(text) || Number.isNaN(Date.parse(text))) {
          error("invalidDate");
          continue;
        }
        break;
      case "SELECT": {
        const allowed = new Set((q.options ?? []).map((o) => o.value));
        if (!allowed.has(text)) {
          error("invalidOption");
          continue;
        }
        break;
      }
      case "LONG_TEXT":
        if (text.length > LONG_TEXT_MAX_LENGTH) {
          error("tooLong");
          continue;
        }
        break;
      default:
        if (text.length > SHORT_TEXT_MAX_LENGTH) {
          error("tooLong");
          continue;
        }
    }

    values.set(q.id, text);
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

/**
 * Contact details are pulled out of the answers by well-known question keys, so
 * they can be stored in participant_contacts (Category A, permission-gated)
 * rather than living only inside the answer blob.
 */
export const CONTACT_QUESTION_KEYS = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
} as const;

export function extractContact(
  questions: readonly FormQuestion[],
  values: ReadonlyMap<string, AnswerValue>,
): { fullName?: string; email?: string; phone?: string } {
  const byKey = new Map(questions.map((q) => [q.key, q.id]));
  const read = (key: string): string | undefined => {
    const id = byKey.get(key);
    if (!id) return undefined;
    const v = values.get(id);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    fullName: read(CONTACT_QUESTION_KEYS.fullName),
    email: read(CONTACT_QUESTION_KEYS.email),
    phone: read(CONTACT_QUESTION_KEYS.phone),
  };
}
