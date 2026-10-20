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
  ctaLabel: string;
  clearLight: string;
  /** The film between the hero and the research (D-109). */
  film: { heading: string; play: string; posterAlt: string };
  research: { heading: string; intro: string; read: string; newTab: string; previous: string; next: string };
  /** The press row under the research (D-110). The three verbs are what the card's link does. */
  press: { heading: string; intro: string; read: string; watch: string; listen: string; previous: string; next: string };
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
    ctaLabel: "Seguir explorando",
    clearLight: "Estudio de investigación Clear Light",
    film: { heading: "David Glowacki, con Essentia Foundation", play: "Reproducir el vídeo (en inglés)", posterAlt: "Dos hombres en primer plano, uno a cada lado, sobre un fondo de ondas azules; entre ellos, la frase en inglés «Darkness is actually full of light.»" },
    research: {
      heading: "La investigación",
      intro: "Estudios publicados sobre experiencias numadélicas en realidad virtual.",
      read: "Leer el artículo",
      newTab: "se abre en una nueva pestaña",
      previous: "Artículos anteriores",
      next: "Artículos siguientes",
    },
    press: {
      heading: "Numadelic en los medios",
      intro: "Prensa, entrevistas, radio, televisión y vídeos sobre el trabajo numadélico de David Glowacki.",
      read: "Leer",
      watch: "Ver",
      listen: "Escuchar",
      previous: "Anteriores",
      next: "Siguientes",
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
    ctaLabel: "Keep exploring",
    clearLight: "Clear Light Research Study",
    film: { heading: "David Glowacki, with Essentia Foundation", play: "Play the video", posterAlt: "Two men in close-up, one on each side, against waves of blue light; between them, the words “Darkness is actually full of light.”" },
    research: {
      heading: "The research",
      intro: "Published studies of numadelic experiences in virtual reality.",
      read: "Read the paper",
      newTab: "opens in a new tab",
      previous: "Previous papers",
      next: "Next papers",
    },
    press: {
      heading: "Numadelic in the media",
      intro: "Press, interviews, broadcasts, and videos about David Glowacki’s Numadelic work.",
      read: "Read",
      watch: "Watch",
      listen: "Listen",
      previous: "Previous",
      next: "Next",
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
    ctaLabel: "Seguir explorando",
    clearLight: "Estudo de investigación Clear Light",
    film: { heading: "David Glowacki, con Essentia Foundation", play: "Reproducir o vídeo (en inglés)", posterAlt: "Dous homes en primeiro plano, un a cada lado, sobre un fondo de ondas azuis; entre eles, a frase en inglés «Darkness is actually full of light.»" },
    research: {
      heading: "A investigación",
      intro: "Estudos publicados sobre experiencias numadélicas en realidade virtual.",
      read: "Ler o artigo",
      newTab: "ábrese nunha nova pestana",
      previous: "Artigos anteriores",
      next: "Artigos seguintes",
    },
    press: {
      heading: "Numadelic nos medios",
      intro: "Prensa, entrevistas, radio, televisión e vídeos sobre o traballo numadélico de David Glowacki.",
      read: "Ler",
      watch: "Ver",
      listen: "Escoitar",
      previous: "Anteriores",
      next: "Seguintes",
    },
    language: "Idioma",
    still: { pause: "Pausar animación", resume: "Reanudar animación" },
  },
};

/**
 * The film (D-109): youtube.com/watch?v=r6_VOOe8SMg, published by Essentia
 * Foundation. The title is the video's own, kept in its original language.
 */
export const HOME_FILM = {
  youtubeId: "r6_VOOe8SMg",
  title: "Molecular Physicist Visualised The Process of Dying | David Glowacki",
  /** The video's own thumbnail, copied here so it is served by this site and not by YouTube (D-110). */
  poster: "/landing/media/home-film-poster.jpg",
} as const;

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

/**
 * The outlets' logos (D-111), each redrawn in white on a transparent ground
 * from the outlet's own file so they sit on the dark card alike. Sizes are the
 * files' own, in pixels.
 */
export const HOME_PRESS_LOGOS = {
  essentia: { src: "/landing/media/press/essentia.png", width: 303, height: 160 },
  tve: { src: "/landing/media/press/tve.png", width: 259, height: 160 },
  abc: { src: "/landing/media/press/abc.png", width: 480, height: 159 },
  rne: { src: "/landing/media/press/rne.png", width: 316, height: 160 },
  elpais: { src: "/landing/media/press/elpais.png", width: 480, height: 111 },
  infobae: { src: "/landing/media/press/infobae.png", width: 480, height: 112 },
  enfoques: { src: "/landing/media/press/enfoques.png", width: 480, height: 84 },
  citius: { src: "/landing/media/press/citius.png", width: 460, height: 160 },
  lionsroar: { src: "/landing/media/press/lionsroar.png", width: 480, height: 77 },
} as const;

/**
 * Press and broadcasts (D-110), newest first. Every link was opened on
 * 2026-10-12; outlet, title and date are the ones the page itself (or, for the
 * two recordings, the CiTIUS media archive that hosts them) gives. Titles stay
 * in their own language, which `lang` names. `date` is left out where the
 * page does not state one.
 */
export const HOME_PRESS: readonly {
  outlet: string;
  logo: keyof typeof HOME_PRESS_LOGOS;
  title: string;
  date?: string;
  kind: "read" | "watch" | "listen";
  lang: "es" | "en";
  href: string;
}[] = [
  {
    outlet: "Essentia Foundation",
    logo: "essentia",
    title: "Molecular Physicist Visualised The Process of Dying",
    date: "2026-05-29",
    kind: "watch",
    lang: "en",
    href: "https://www.youtube.com/watch?v=r6_VOOe8SMg",
  },
  {
    outlet: "EL PAÍS",
    logo: "elpais",
    title: "David Glowacki, físico: “La idea de vivir 500 años me asusta más que la muerte”",
    date: "2025-02-25",
    kind: "read",
    lang: "es",
    href: "https://elpais.com/salud-y-bienestar/2025-02-25/david-glowacki-fisico-la-idea-de-vivir-500-anos-me-asusta-mas-que-la-muerte.html",
  },
  {
    outlet: "TVE Galicia",
    logo: "tve",
    title: "«Imagina que tienes un pedazo de hielo y lo pones en el mar. El hielo sí desaparece, pero todavía está dentro, mezclado con todo lo que hay». Entrevista a David Glowacki",
    date: "2025-06-06",
    kind: "watch",
    lang: "es",
    href: "https://apps.citius.gal/xici2/backend/media/news/1608/video_file/2025-06-06_telexornal_galicia_davidglowacki_20250611064935375.mp4",
  },
  {
    outlet: "ABC",
    logo: "abc",
    title: "David Glowacki: esta experiencia puede ayudar a acercarse a la muerte sin miedo",
    date: "2025-03-08",
    kind: "watch",
    lang: "es",
    href: "https://www.abc.es/ciencia/david-glowacki-experiencia-puede-ayudar-acercarse-muerte-20250308120018-vi.html",
  },
  {
    outlet: "RNE · Las mañanas de RNE",
    logo: "rne",
    title: "«NUMADELIC es una forma de terapia de grupo. Se puede recibir como una meditación en la mortalidad». Entrevista a David Glowacki",
    date: "2025-02-27",
    kind: "listen",
    lang: "es",
    href: "https://citius.usc.es/sites/default/files/prensa/Entrevista_DavidGlowacki_RNE_27-02-2025.mp3",
  },
  {
    outlet: "EL PAÍS English",
    logo: "elpais",
    title: "David Glowacki, physicist: ‘The idea of living for 500 years scares me more than death’",
    date: "2025-02-26",
    kind: "read",
    lang: "en",
    href: "https://english.elpais.com/science-tech/2025-02-26/david-glowacki-physicist-the-idea-of-living-for-500-years-scares-me-more-than-death.html",
  },
  {
    outlet: "Infobae España",
    logo: "infobae",
    title: "Viajar a la muerte para dejar de tenerle miedo: unos investigadores utilizan la realidad virtual para reforzar la salud mental de enfermos terminales",
    date: "2025-02-17",
    kind: "read",
    lang: "es",
    href: "https://www.infobae.com/espana/2025/02/17/viajar-a-la-muerte-para-dejar-de-tenerle-miedo-unos-investigadores-utilizan-la-realidad-virtual-para-reforzar-la-salud-mental-de-enfermos-terminales/",
  },
  {
    outlet: "Enfoques.gal",
    logo: "enfoques",
    title: "Realidad virtual desde la USC para aliviar la ansiedad ante la muerte",
    date: "2025-02-12",
    kind: "read",
    lang: "es",
    href: "https://enfoques.gal/compostela/santiago/realidad-virtual-desde-la-usc-para-aliviar-la-ansiedad-ante-la-muerte/",
  },
  {
    outlet: "CiTIUS",
    logo: "citius",
    title: "‘Numadelic’: Virtual Reality to alleviate anxiety about death",
    kind: "watch",
    lang: "en",
    href: "https://citius.gal/en/videos/numadelic-virtualreality-to-relieve-anxiety-about-death/",
  },
  {
    outlet: "Lion’s Roar",
    logo: "lionsroar",
    title: "Bringing Death Into Clear Light",
    date: "2024-04-23",
    kind: "read",
    lang: "en",
    href: "https://www.lionsroar.com/bringing-death-into-clear-light/",
  },
  {
    outlet: "Lion’s Roar en español",
    logo: "lionsroar",
    title: "Tras el Velo Digital: Meditación en Realidad Virtual",
    date: "2024-03-04",
    kind: "read",
    lang: "es",
    href: "https://www.lionsroar.com/es/tras-el-velo-digital-meditacion-en-realidad-virtual/",
  },
  {
    outlet: "CiTIUS",
    logo: "citius",
    title: "A pioneering project in the world will explore the restorative use of virtual reality to alleviate death anxiety",
    date: "2022-09-08",
    kind: "read",
    lang: "en",
    href: "https://citius.gal/en/news/news/a-world-pioneering-project-will-explore-the-restorative-use-of-virtual-reality-to-alleviate-death-anxiety/",
  },
];
