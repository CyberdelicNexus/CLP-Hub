import type { PublicLocale } from "@/domain/locale";

/**
 * The few fixed words around study content pages (D-135): what the pages'
 * frame and language links say. The content itself lives in the database and
 * is translated there. The Galician is a translation still to be reviewed by
 * a native speaker, like the home page's.
 */
export interface StudyPageCopy {
  backHome: string;
  part: { preparacion: string; integracion: string };
  language: string;
  /** Shown when the page has no version in the chosen language yet. */
  fallback: string;
}

export const STUDY_PAGE_COPY: Record<PublicLocale, StudyPageCopy> = {
  es: {
    backHome: "Inicio",
    part: { preparacion: "Preparación", integracion: "Integración" },
    language: "Idioma",
    fallback: "Esta página todavía no está disponible en español. Te la mostramos en el idioma en que sí lo está.",
  },
  en: {
    backHome: "Home",
    part: { preparacion: "Preparation", integracion: "Integration" },
    language: "Language",
    fallback: "This page is not available in English yet. It is shown in Spanish.",
  },
  gl: {
    backHome: "Inicio",
    part: { preparacion: "Preparación", integracion: "Integración" },
    language: "Idioma",
    fallback: "Esta páxina aínda non está dispoñible en galego. Móstrase en español.",
  },
};
