import type { PublicLocale } from "@/domain/locale";

/**
 * The numadelic.org home page (D-105): a hero and the published research.
 * English is the founder's wording; Spanish and Galician are translations of
 * it and are still to be reviewed by a native speaker.
 */
export interface HomeCopy {
  meta: { title: string; description: string };
  title: string;
  /** The word, where it comes from, and what it names. */
  definition: { term: string; origin: string; meaning: string };
  /** Box breathing: four equal phases, in the order the light moves through them. */
  breath: { label: string; phases: readonly [string, string, string, string] };
  ctaLabel: string;
  clearLight: string;
  research: { heading: string; intro: string; read: string; newTab: string; previous: string; next: string };
  language: string;
  still: { pause: string; resume: string };
}

export const HOME_COPY: Record<PublicLocale, HomeCopy> = {
  es: {
    meta: {
      title: "Numadelic · Hacer visible lo invisible",
      description: "Tecnologías que hacen visible y sentida la experiencia de una interconexión profunda.",
    },
    title: "Hacer visible lo invisible",
    definition: {
      term: "numadélico",
      origin: "del latín numen (espíritu) y del griego delos (hacer visible)",
      meaning: "tecnologías que hacen visible y sentida la experiencia de una interconexión profunda.",
    },
    breath: {
      label: "Respiración cuadrada: inhala cuatro segundos, sostén cuatro, exhala cuatro, sostén cuatro.",
      phases: ["Inhala", "Sostén", "Exhala", "Sostén"],
    },
    ctaLabel: "Seguir explorando",
    clearLight: "Programa Clear Light",
    research: {
      heading: "La investigación",
      intro: "Estudios publicados sobre experiencias numadélicas en realidad virtual.",
      read: "Leer el artículo",
      newTab: "se abre en una nueva pestaña",
      previous: "Artículos anteriores",
      next: "Artículos siguientes",
    },
    language: "Idioma",
    still: { pause: "Pausar animación", resume: "Reanudar animación" },
  },
  en: {
    meta: {
      title: "Numadelic · Making the invisible visible",
      description: "Technologies that make the experience of deep interconnection visible and felt.",
    },
    title: "Making the invisible visible",
    definition: {
      term: "numadelic",
      origin: "from Latin numen (spirit) and Greek delos (to make visible)",
      meaning: "technologies that make the experience of deep interconnection visible and felt.",
    },
    breath: {
      label: "Box breathing: breathe in for four seconds, hold for four, breathe out for four, hold for four.",
      phases: ["Breathe in", "Hold", "Breathe out", "Hold"],
    },
    ctaLabel: "Keep exploring",
    clearLight: "Clear Light program",
    research: {
      heading: "The research",
      intro: "Published studies of numadelic experiences in virtual reality.",
      read: "Read the paper",
      newTab: "opens in a new tab",
      previous: "Previous papers",
      next: "Next papers",
    },
    language: "Language",
    still: { pause: "Pause animation", resume: "Resume animation" },
  },
  gl: {
    meta: {
      title: "Numadelic · Facer visible o invisible",
      description: "Tecnoloxías que fan visible e sentida a experiencia dunha interconexión profunda.",
    },
    title: "Facer visible o invisible",
    definition: {
      term: "numadélico",
      origin: "do latín numen (espírito) e do grego delos (facer visible)",
      meaning: "tecnoloxías que fan visible e sentida a experiencia dunha interconexión profunda.",
    },
    breath: {
      label: "Respiración cadrada: inspira catro segundos, mantén catro, expira catro, mantén catro.",
      phases: ["Inspira", "Mantén", "Expira", "Mantén"],
    },
    ctaLabel: "Seguir explorando",
    clearLight: "Programa Clear Light",
    research: {
      heading: "A investigación",
      intro: "Estudos publicados sobre experiencias numadélicas en realidade virtual.",
      read: "Ler o artigo",
      newTab: "ábrese nunha nova pestana",
      previous: "Artigos anteriores",
      next: "Artigos seguintes",
    },
    language: "Idioma",
    still: { pause: "Pausar animación", resume: "Reanudar animación" },
  },
};

/** The two sister sites. Shown as their addresses, which need no translation. */
export const HOME_SITES = [
  { label: "anuma.com", href: "https://anuma.com" },
  { label: "numadeliclabs.org", href: "https://www.numadeliclabs.org" },
] as const;

/**
 * The papers listed on numadeliclabs.org/the-science (read 2026-10-09), newest
 * first, with the links that page gives. Bibliographic metadata stays in the
 * papers' original language.
 *
 * `art` picks the drawn thumbnail (`.research__thumbnail--N`). 0 to 3 are the
 * ones the Clear Light page already uses for the same four papers
 * (landing.css); 4 to 6 are drawn for the home page (home.css).
 */
export const HOME_PAPERS = [
  {
    title: "Autonomic indicators of self-transcendence: Insights from the numadelic VR paradigm",
    authors: "Bonnelle, V., Parola, G., Andreu, C., Hardy, J. L., Wall, J., Timmermann, C., Cebolla, A., Wrzesien, M., & Glowacki, D. R.",
    journal: "Neuroscience of Consciousness",
    year: 2026,
    href: "https://doi.org/10.1093/nc/niag009",
    art: 4,
  },
  {
    title: "Inducing selflessness through a numadelic virtual reality experience: a preliminary study",
    authors: "Vidal, J., Andreu, C. I., Wrzesien, M., Colombo, D., Wall, J., Glowacki, D. R., Hardy, J. L., & Cebolla, A.",
    journal: "Virtual Reality",
    year: 2026,
    href: "https://link.springer.com/article/10.1007/s10055-025-01293-z",
    art: 3,
  },
  {
    title: "Lucid dreaming of a prior virtual-reality experience with ego-transcendent qualities: a proof-of-concept study",
    authors: "Morris, D. J., Elliott, D. B., Torres-Platas, S. G., Wall, J., Demšar, E., Konkoly, K. R., Rosman, E., Grabowecky, M., Glowacki, D. R., & Paller, K. A.",
    journal: "Neuroscience of Consciousness",
    year: 2025,
    href: "https://doi.org/10.1093/nc/niaf017",
    art: 5,
  },
  {
    title: "Observational cohort study of a group-based VR program to improve mental health and wellbeing in people with life-threatening illnesses",
    authors: "Kettner, H., Glowacki, D. R., Wall, J., Carhart-Harris, R. L., Roseman, L., & Hardy, J. L.",
    journal: "Frontiers in Virtual Reality",
    year: 2025,
    href: "https://www.frontiersin.org/journals/virtual-reality/articles/10.3389/frvir.2024.1466362/full",
    art: 0,
  },
  {
    title: "VR models of death and psychedelics: An aesthetic paradigm for design beyond day-to-day phenomenology",
    authors: "Glowacki, D. R.",
    journal: "Frontiers in Virtual Reality",
    year: 2024,
    href: "https://www.frontiersin.org/journals/virtual-reality/articles/10.3389/frvir.2023.1286950/full",
    art: 1,
  },
  {
    title: "Group VR experiences can produce ego attenuation and connectedness comparable to psychedelics",
    authors: "Glowacki, D. R., Williams, R. R., Wonnacott, M. D., Maynard, O. M., Freire, R., Pike, J. E., & Chatziapostolou, M.",
    journal: "Scientific Reports",
    year: 2022,
    href: "https://www.nature.com/articles/s41598-022-12637-z",
    art: 2,
  },
  {
    title: "Isness: Using Multi-Person VR to Design Peak Mystical Type Experiences Comparable to Psychedelics",
    authors: "Glowacki, D. R., Wonnacott, M. D., Freire, R., Glowacki, B. R., Gale, E. M., Pike, J. E., de Haan, T., Chatziapostolou, M., & Metatla, O.",
    journal: "Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems",
    year: 2020,
    href: "https://arxiv.org/pdf/2002.00940",
    art: 6,
  },
] as const;
