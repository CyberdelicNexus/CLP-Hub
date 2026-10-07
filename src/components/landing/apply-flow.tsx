"use client";

import { useActionState } from "react";
import { submitInterestAction, type InterestState } from "@/app/(public)/clearlight/participar/actions";
import { ApplyFrame } from "@/components/landing/apply-frame";
import {
  INTEREST_EMAIL_MAX_LENGTH,
  INTEREST_NAME_MAX_LENGTH,
  INTEREST_PHONE_MAX_LENGTH,
  type InterestField,
} from "@/domain/interest";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * /participar in two steps (D-086). First the contact details the Hub keeps
 * (first name and surname, email, phone); the server creates the application
 * (with a participant code the visitor is never shown, D-087). Then the
 * Qualtrics questionnaire.
 * Its responses carry no code, so the person is asked to type their details
 * the same way there, and the team matches the two records by name.
 */
export function ApplyFlow({ url, apply: APPLY }: { url: string; apply: LandingCopy["APPLY"] }) {
  const [state, action, pending] = useActionState<InterestState, FormData>(submitInterestAction, { status: "idle" });
  const { form } = APPLY;

  if (state.status === "ok") {
    return (
      <div className="apply__done">
        <p className="apply__done-text" role="status">
          {form.done}
          <span className="apply__ref">{form.matchNote}</span>
        </p>
        <ApplyFrame url={url} apply={APPLY} />
      </div>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const fieldError = (f: InterestField) => {
    const e = errors[f];
    return e ? form.errors[e] : null;
  };
  const field = (name: InterestField, label: string, type: string, autoComplete: string, maxLength: number) => {
    const err = fieldError(name);
    return (
      <div className="apply__field">
        <label htmlFor={`interest-${name}`}>{label}</label>
        <input
          id={`interest-${name}`}
          name={name}
          type={type}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `interest-${name}-error` : undefined}
        />
        {err ? (
          <p id={`interest-${name}-error`} className="apply__error">
            {err}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form action={action} className="apply__form" noValidate>
      <h2 className="apply__form-title">{form.title}</h2>
      <p className="apply__form-intro">{form.intro}</p>
      <div className="apply__pair">
        {field("firstName", form.firstName, "text", "given-name", INTEREST_NAME_MAX_LENGTH)}
        {field("lastName", form.lastName, "text", "family-name", INTEREST_NAME_MAX_LENGTH)}
      </div>
      {field("email", form.email, "email", "email", INTEREST_EMAIL_MAX_LENGTH)}
      {field("phone", form.phone, "tel", "tel", INTEREST_PHONE_MAX_LENGTH)}
      {/* Honeypot, hidden from people and from assistive tech. */}
      <div className="apply__hp" aria-hidden>
        <label htmlFor="interest-website">Website</label>
        <input id="interest-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="apply__check">
        <input id="interest-privacy" name="privacy" type="checkbox" required />
        <label htmlFor="interest-privacy">
          {form.privacyBefore}{" "}
          <a href="/clearlight/privacidad" className="cl-link" target="_blank" rel="noopener">
            {form.privacyLink}
          </a>
          {form.privacyAfter}
        </label>
      </div>
      {state.status === "invalid" && state.privacy ? <p className="apply__error">{form.errors.privacy}</p> : null}
      {state.status === "closed" ? <p className="apply__error">{form.errors.closed}</p> : null}
      {state.status === "failed" ? <p className="apply__error">{form.errors.failed}</p> : null}
      <button type="submit" className="cl-btn apply__submit" disabled={pending}>
        {pending ? form.sending : form.submit}
      </button>
    </form>
  );
}
