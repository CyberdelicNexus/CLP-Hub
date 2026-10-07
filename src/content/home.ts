import type { PublicLocale } from "@/domain/locale";

/**
 * The domain's home page while the organisation's own site does not exist
 * (D-104): a name, one line, and the way to the Clear Light study. It says
 * nothing about the organisation, because nothing has been supplied to say.
 */
export const HOME_COPY: Record<PublicLocale, { title: string; body: string; study: string }> = {
  es: { title: "Numadelic", body: "Este sitio está en preparación.", study: "Ir al estudio Clear Light" },
  en: { title: "Numadelic", body: "This site is in preparation.", study: "Go to the Clear Light study" },
  gl: { title: "Numadelic", body: "Este sitio está en preparación.", study: "Ir ao estudo Clear Light" },
};
