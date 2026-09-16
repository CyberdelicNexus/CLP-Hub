"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CONTACT } from "@/content/landing/clear-light";

/**
 * The contact dialog (D-052). Every `#contacto` link on the page opens it: a
 * native modal <dialog>, so focus stays inside, Escape closes it and the page
 * behind is inert; the backdrop blurs the page, and a click on it closes the
 * dialog.
 *
 * DESIGN ONLY. The form has no action, no request and no storage: submitting
 * shows that sending is not available yet, and nothing typed leaves the
 * browser. Where messages should go (and the anti-abuse and privacy work that
 * comes with it) is an open decision; `CONTACTO_FORMULARIO` blocks publication
 * until it is made. The health note follows docs/research-data-boundaries.md.
 */
export function ContactDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState(false);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href='#contacto']");
      if (!link) return;
      e.preventDefault();
      setNotice(false);
      if (!dialog.open) dialog.showModal();
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
          {CONTACT.title}
        </h2>
        <p className="contact__intro">{CONTACT.intro}</p>

        <form
          className="contact__form"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(true);
          }}
        >
          <label className="contact__field">
            <span>{CONTACT.name}</span>
            <input name="nombre" type="text" autoComplete="name" required maxLength={120} />
          </label>
          <label className="contact__field">
            <span>{CONTACT.email}</span>
            <input name="email" type="email" autoComplete="email" required maxLength={200} />
          </label>
          <label className="contact__field">
            <span>{CONTACT.message}</span>
            <textarea name="mensaje" rows={5} required maxLength={1000} aria-describedby={`${id}-health`} />
          </label>
          <p id={`${id}-health`} className="contact__note">
            {CONTACT.healthNote}
          </p>
          <p className="contact__note">
            {CONTACT.privacyBefore}{" "}
            <a href="/privacidad" className="cl-link">
              {CONTACT.privacyLink}
            </a>
            .
          </p>
          <button type="submit" className="cl-btn contact__submit">
            {CONTACT.submit}
          </button>
          <p className="contact__status" role="status">
            {notice ? CONTACT.unavailable : ""}
          </p>
        </form>
      </div>
    </dialog>
  );
}
