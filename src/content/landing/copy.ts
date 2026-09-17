import type { PublicLocale } from "@/domain/locale";
import { LANDING_ES, type LandingCopy } from "@/content/landing/clear-light";
import { LANDING_EN } from "@/content/landing/clear-light.en";
import { LANDING_GL } from "@/content/landing/clear-light.gl";
import { LEGAL, type LegalCopy } from "@/content/landing/legal";
import { LEGAL_EN } from "@/content/landing/legal.en";
import { LEGAL_GL } from "@/content/landing/legal.gl";

/** The public site's copy in each language (D-063). Spanish is the source. */
export const LANDING_COPY: Record<PublicLocale, LandingCopy> = { es: LANDING_ES, en: LANDING_EN, gl: LANDING_GL };
export const LEGAL_COPY: Record<PublicLocale, LegalCopy> = { es: LEGAL, en: LEGAL_EN, gl: LEGAL_GL };
