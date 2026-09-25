/**
 * The public expression of interest on /participar (D-086).
 *
 * BOUNDARY: exactly three facts about a person reach CLP Hub from the public
 * site: name, email and phone, so the team can contact them. Everything else
 * they answer (the information sheet, the consent, the screening questions)
 * stays in Qualtrics. Adding a field here widens what the public can write into
 * the Hub; it is a study-team decision, not a code change.
 *
 * The name is asked as first name and surname (D-087) because the participant
 * code is built from their initials, and "Nombre y apellidos" as one box can't
 * say where the given names end. It is stored joined, as the one `full_name`.
 *
 * Qualtrics responses carry no participant code, so the two records are matched
 * by name, email and phone, which the questionnaire asks for too (D-087).
 */

export const INTEREST_NAME_MAX_LENGTH = 120;
export const INTEREST_EMAIL_MAX_LENGTH = 200;
export const INTEREST_PHONE_MAX_LENGTH = 30;

export interface InterestInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export type InterestField = keyof InterestInput;
export type InterestError = "required" | "tooLong" | "invalidName" | "invalidEmail" | "invalidPhone";

// Same permissive rule as the application form: it rejects typos, not exotic
// addresses. Deliverability is confirmed by contacting the person.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Digits with the separators people actually type, an optional leading +,
// and at least seven digits overall. Not a numbering-plan check.
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

export function normalizeInterest(raw: InterestInput): InterestInput {
  const squash = (s: string) => s.trim().replace(/\s+/g, " ");
  return {
    firstName: squash(raw.firstName),
    lastName: squash(raw.lastName),
    email: raw.email.trim(),
    phone: squash(raw.phone),
  };
}

/** The name as it is stored and as the questionnaire's "Nombre y apellidos" is typed. */
export function fullNameOf(input: Pick<InterestInput, "firstName" | "lastName">): string {
  return `${input.firstName} ${input.lastName}`;
}

export function validateInterest(input: InterestInput): Partial<Record<InterestField, InterestError>> {
  const errors: Partial<Record<InterestField, InterestError>> = {};

  for (const key of ["firstName", "lastName"] as const) {
    const v = input[key];
    if (!v) errors[key] = "required";
    else if (v.length > INTEREST_NAME_MAX_LENGTH) errors[key] = "tooLong";
    // The code takes the first letter, so a name must have at least one.
    else if (!/\p{L}/u.test(v)) errors[key] = "invalidName";
  }

  if (!input.email) errors.email = "required";
  else if (input.email.length > INTEREST_EMAIL_MAX_LENGTH) errors.email = "tooLong";
  else if (!EMAIL_PATTERN.test(input.email)) errors.email = "invalidEmail";

  if (!input.phone) errors.phone = "required";
  else if (input.phone.length > INTEREST_PHONE_MAX_LENGTH) errors.phone = "tooLong";
  else if (!PHONE_PATTERN.test(input.phone) || input.phone.replace(/\D/g, "").length < 7) {
    errors.phone = "invalidPhone";
  }

  return errors;
}
