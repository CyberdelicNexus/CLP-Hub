import type { PublicLocale } from "@/domain/locale";

/**
 * The study's public contact details (D-137, D-138). One place, used by the
 * floating WhatsApp button on the Clear Light pages and by the scripts that
 * write the session pages and message templates.
 */
export const STUDY_EMAIL = "info@numadelic.org";
export const STUDY_WHATSAPP = "+34 694 269 223";
/** wa.me wants the number with country code, digits only. */
export const STUDY_WHATSAPP_URL = "https://wa.me/34694269223";

export function whatsappChatUrl(prefill?: string): string {
  return prefill ? `${STUDY_WHATSAPP_URL}?text=${encodeURIComponent(prefill)}` : STUDY_WHATSAPP_URL;
}

export interface WhatsAppButtonCopy {
  /** Visible on wider screens, next to the icon. */
  short: string;
  /** Accessible name; says the link leaves the site. */
  label: string;
  /** First line of the chat, so the team knows where the person came from. */
  prefill: string;
}

/** The Galician is a translation still to be reviewed by a native speaker. */
export const WHATSAPP_BUTTON_COPY: Record<PublicLocale, WhatsAppButtonCopy> = {
  es: {
    short: "¿Dudas? Escríbenos",
    label: "Escríbenos por WhatsApp (se abre WhatsApp)",
    prefill: "Hola, tengo una pregunta sobre el estudio Clear Light.",
  },
  gl: {
    short: "Dúbidas? Escríbenos",
    label: "Escríbenos por WhatsApp (ábrese WhatsApp)",
    prefill: "Ola, teño unha pregunta sobre o estudo Clear Light.",
  },
  en: {
    short: "Questions? Message us",
    label: "Message us on WhatsApp (opens WhatsApp)",
    prefill: "Hello, I have a question about the Clear Light study.",
  },
};
