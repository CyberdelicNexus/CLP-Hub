"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { submitInquiryAction, type InquiryState } from "@/app/(public)/contacto/actions";
import {
  INQUIRY_EMAIL_MAX_LENGTH,
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_NAME_MAX_LENGTH,
  type InquiryField,
} from "@/domain/inquiry";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * The contact dialog (D-052, wired up in D-088). Every `#contacto` link on the
 * page opens it: a native modal <dialog>, so focus stays inside, Escape closes
 * it and the page behind is inert; the backdrop blurs the page, and a click on
 * it closes the dialog.
 *
 * Submitting sends the visitor's name, email and message to the Hub's inquiry
 * inbox (`contacto/actions.ts`), where staff answer it and are emailed that one
 * arrived. The form is remounted each time the dialog opens, so a second visit
 * starts empty. The health note follows docs/research-data-boundaries.md: the
 * Hub keeps the text only until the inquiry is answered.
 */
export function ContactDialog({ copy: CONTACT }: { copy: LandingCopy["CONTACT"] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(0);
  // Once the message is sent the dialog stops asking a question: the title
  // becomes the confirmation and the intro goes.
  const [sent, setSent] = useState(false);
  const id = useId();
  const markSent = useCallback(() => setSent(true), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href='#contacto']");
      if (!link) return;
      e.preventDefault();
      if (!dialog.open) {
        setOpened((n) => n + 1);
        setSent(false);
        dialog.showModal();
      }
    };
    // Capture phase: the jump to the (closed) dialog is cancelled before any other handler runs.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      // Not "contacto": that id is section 7's contact answer, which the
      // #contacto links still reach when JavaScript is off.
      id="contacto-formulario"
      className="contact"
      aria-labelledby={`${id}-title`}
      // The dialog box itself is the backdrop hit area: its content fills a
      // padded inner panel, so a click that lands on the dialog is outside it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="contact__panel">
        <button type="button" className="contact__close" onClick={close} aria-label={CONTACT.close}>
          <span aria-hidden />
        </button>
        <h2 id={`${id}-title`} className="contact__title">
          {sent ? CONTACT.sentTitle : CONTACT.title}
        </h2>
        {sent ? null : <p className="contact__intro">{CONTACT.intro}</p>}
        <ContactForm key={opened} copy={CONTACT} healthId={`${id}-health`} onDone={close} onSent={markSent} />
      </div>
    </dialog>
  );
}

function ContactForm({
  copy: CONTACT,
  healthId,
  onDone,
  onSent,
}: {
  copy: LandingCopy["CONTACT"];
  healthId: string;
  onDone: () => void;
  onSent: () => void;
}) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiryAction, { status: "idle" });
  const errors = state.status === "invalid" ? state.errors : {};
  const fieldError = (f: InquiryField) => (errors[f] ? CONTACT.errors[errors[f]!] : null);
  const ok = state.status === "ok";

  useEffect(() => {
    if (ok) onSent();
  }, [ok, onSent]);

  if (ok) {
    return (
      <div className="contact__sent">
        <span className="contact__sent-mark" aria-hidden />
        <p className="contact__sent-text" role="status">
          {CONTACT.sent}
        </p>
        <p className="contact__note">{CONTACT.sentNote}</p>
        {/* The form that had focus is gone, so the way out takes it. */}
        <button type="button" className="cl-btn contact__submit" onClick={onDone} autoFocus>
          {CONTACT.close}
        </button>
      </div>
    );
  }

  return (
    <form className="contact__form" action={action} noValidate>
      <label className="contact__field">
        <span>{CONTACT.name}</span>
        <input name="nombre" type="text" autoComplete="name" required maxLength={INQUIRY_NAME_MAX_LENGTH} aria-invalid={errors.name ? true : undefined} />
        {fieldError("name") ? <em className="contact__error">{fieldError("name")}</em> : null}
      </label>
      <label className="contact__field">
        <span>{CONTACT.email}</span>
        <input name="email" type="email" autoComplete="email" required maxLength={INQUIRY_EMAIL_MAX_LENGTH} aria-invalid={errors.email ? true : undefined} />
        {fieldError("email") ? <em className="contact__error">{fieldError("email")}</em> : null}
      </label>
      <label className="contact__field">
        <span>{CONTACT.message}</span>
        <textarea name="mensaje" rows={5} required maxLength={INQUIRY_MESSAGE_MAX_LENGTH} aria-describedby={healthId} aria-invalid={errors.message ? true : undefined} />
        {fieldError("message") ? <em className="contact__error">{fieldError("message")}</em> : null}
      </label>
      {/* Honeypot, hidden from people and from assistive tech. */}
      <div className="contact__hp" aria-hidden>
        <label htmlFor={`${healthId}-website`}>Website</label>
        <input id={`${healthId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <p id={healthId} className="contact__note">
        {CONTACT.healthNote}
      </p>
      <p className="contact__note">
        {CONTACT.privacyBefore}{" "}
        <a href="/privacidad" className="cl-link">
          {CONTACT.privacyLink}
        </a>
        .
      </p>
      <button type="submit" className="cl-btn contact__submit" disabled={pending}>
        {pending ? CONTACT.sending : CONTACT.submit}
      </button>
      <p className="contact__status" role="status">
        {state.status === "unavailable" ? CONTACT.unavailable : state.status === "failed" ? CONTACT.failed : ""}
      </p>
    </form>
  );
}
