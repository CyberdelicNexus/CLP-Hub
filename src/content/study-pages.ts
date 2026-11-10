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
  /**
   * The description a shared link shows under the page's title (2026-10-28:
   * about the study, not the platform; the title alone names the page).
   */
  shareDescription: string;
}

export const STUDY_PAGE_COPY: Record<PublicLocale, StudyPageCopy> = {
  es: {
    backHome: "Inicio",
    part: { preparacion: "Preparación", integracion: "Integración" },
    language: "Idioma",
    fallback: "Esta página todavía no está disponible en español. Te la mostramos en el idioma en que sí lo está.",
    shareDescription:
      "Clear Light, un estudio sobre presencia, conexión y sentido: un programa en grupo con experiencias de realidad virtual y espacios para compartirlas.",
  },
  en: {
    backHome: "Home",
    part: { preparacion: "Preparation", integracion: "Integration" },
    language: "Language",
    fallback: "This page is not available in English yet. It is shown in Spanish.",
    shareDescription:
      "Clear Light, a study on presence, connection and meaning: a group programme with virtual reality experiences and space to share them.",
  },
  gl: {
    backHome: "Inicio",
    part: { preparacion: "Preparación", integracion: "Integración" },
    language: "Idioma",
    fallback: "Esta páxina aínda non está dispoñible en galego. Móstrase en español.",
    shareDescription:
      "Clear Light, un estudo sobre presenza, conexión e sentido: un programa en grupo con experiencias de realidade virtual e espazos para compartilas.",
  },
};

/**
 * A study page's title and share card: the page's own title alone, without
 * the staff app's "· CLP Hub" suffix the root layout's template would add,
 * and a description of the study. The image is /clearlight's banner.
 */
export function studyPageMetadata(title: string, description: string) {
  const share = { title, description };
  return {
    title: { absolute: title },
    description,
    openGraph: { ...share, type: "article" as const, siteName: "Clear Light" },
    twitter: { ...share, card: "summary_large_image" as const },
  };
}
