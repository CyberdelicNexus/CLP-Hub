/**
 * Working Spanish copy for the Clear Light recruitment landing page.
 *
 * STATUS: prototype copy, pending native editorial, clinical and ethics review
 * (docs/landing-page.md). Everything here comes from the V3 handoff content
 * model; nothing was invented. Where the protocol has not supplied a value the
 * entry is a `Missing` marker, which renders as a visible "FALTA CONTENIDO
 * APROBADO" placeholder in development and blocks the page in production.
 *
 * This is recruitment material, not study content: it is not the versioned
 * participant content served under /estudio (D-029), and it must not move into
 * messages/*.json, which hold staff UI strings (D-009). See D-042.
 *
 * Copy rules enforced by tests/landing-content.test.ts: no em or en dashes,
 * exactly two randomized groups described identically, one label per intent.
 *
 * Spanish is the source text. English and Galician translations
 * (clear-light.en.ts, clear-light.gl.ts, D-063) have the same shape, reuse
 * these `Missing` markers and share their `href`, `src` and `id` values; the
 * publication gate below is computed from this file alone, so it cannot differ
 * by language.
 */

import { LEGAL, legalMissing, type LegalCopy } from "@/content/landing/legal";

export interface Missing {
  readonly missing: true;
  /** Stable key, listed in docs/landing-page.md. */
  readonly key: string;
  /** What the study team has to supply, in Spanish. */
  readonly needs: string;
}

const missing = (key: string, needs: string): Missing => ({ missing: true, key, needs });

export function isMissing(value: unknown): value is Missing {
  return typeof value === "object" && value !== null && (value as Missing).missing === true;
}

export const ACTIONS = {
  /** The one recruitment intent. Same label everywhere it appears. */
  primaryCta: "Comprobar si puedo participar",
  /** Hero exploration action: scrolls to the explanation, never to Qualtrics. */
  exploreCta: "Conocer el estudio",
  contactCta: "Contactar con el equipo",
} as const;

export const NAV = [
  { href: "#porque", label: "El estudio" },
  { href: "#incorporarse", label: "Participar" },
  { href: "#elegibilidad", label: "Preguntas" },
] as const;

export const HERO = {
  eyebrow: "Estudio de investigación  con asignación al azar sobre una experiencia grupal de realidad virtual.",
  headline: "¿Puede una experiencia inmersiva transformar cómo nos relacionamos con la mortalidad?",
  support:
    "Este estudio investiga cómo una experiencia inmersiva y compartida influye en la salud mental y el bienestar de personas que viven con una enfermedad grave.",
  reveal: {
    /** Alt text for the layered still. No explicit toggle labels: the control was removed (D-054). */
    luminousAlt: "Seis presencias de luz azul violeta, difusas, dispuestas en círculo sobre un fondo oscuro.",
    physicalAlt:
      "Seis personas sentadas en sillas formando un círculo en una sala cálida, cada una con unas gafas Meta Quest 3 y dos mandos en las manos.",
  },
} as const;

export const WHY = {
  headline: "Cuando una enfermedad grave lo cambia todo.",
  body: "Una enfermedad grave puede cambiar la relación con el cuerpo, con el tiempo y con quienes amamos. Este estudio explora si una experiencia compartida puede abrir un espacio de presencia, conexión y sentido ante este proceso natural.",
} as const;

export const WHAT = {
  headline: "Una experiencia guiada para explorar juntos.",
  body: "Clear Light es un programa experiencial en pequeño grupo. Combina preparación, encuentros por videollamada y sesiones inmersivas de realidad virtual para explorar la vida, la identidad, la impermanencia y la conexión.",
  facts: ["Pequeño grupo", "Acompañamiento humano", "Realidad virtual guiada"],
  film: {
    label: "Una mirada al proyecto",
    play: "Reproducir el vídeo",
    // D-060: a single participant, not the hero's circle of seven.
    posterAlt: "Una persona sentada con las piernas cruzadas frente a un fondo azul, con unas gafas de realidad virtual y un mando en cada mano; una luz cálida en el pecho.",
    /** Not rendered on the page; still blocks publication until approved. */
    captions: missing("SUBTITULOS_VIDEO", "Subtítulos o transcripción en español aprobados para el vídeo de la sección 3"),
  },
} as const;

export interface Stage {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** One image under /landing/media, with its intrinsic size so it is shown whole. */
  readonly media: { readonly src: string; readonly width: number; readonly height: number; readonly alt: string };
}

export const STAGES = {
  heading: "Etapas del Programa",
  intro: "Una experiencia progresiva para preparar, explorar, compartir e integrar.",
  approval: missing("DESCRIPCION_ETAPAS", "Aprobación de los nombres y descripciones de las etapas S0 a S6"),
  items: [
    {
      code: "S0",
      name: "Preparación",
      description: "Puesta a punto técnica y personal antes de comenzar.",
      media: {
        src: "/landing/media/etapa-s0.webp",
        width: 1536,
        height: 1024,
        alt: "Unas manos entregan a otras unas gafas de realidad virtual.",
      },
    },
    {
      code: "S1",
      name: "Orientación",
      description: "El grupo se conoce y sitúa la experiencia.",
      media: {
        src: "/landing/media/etapa-s1.webp",
        width: 1536,
        height: 1024,
        alt: "Un portátil con una videollamada de grupo que comparte la presentación «¿Cómo prepararse para el programa?».",
      },
    },
    {
      code: "S2",
      name: "Cuerpos de Luz",
      description: "Explorar cómo se siente habitar una forma hecha de luz.",
      media: {
        // The founder re-edited S2.png landscape (D-058), so it no longer
        // needs the portrait-only narrower box (stages.tsx, D-057).
        src: "/landing/media/etapa-s2-v4.webp",
        width: 3632,
        height: 2048,
        alt: "Una mujer con una luz cálida en el pecho y en las palmas, envuelta en un contorno de luz violeta.",
      },
    },
    {
      code: "S3",
      name: "Vida",
      description: "Recorrer la propia historia con atención y autocompasión.",
      media: {
        src: "/landing/media/etapa-s3.webp",
        width: 1915,
        height: 821,
        alt: "Una tira de película con escenas de una vida: la mano de un bebé, unas zapatillas infantiles, un cuaderno, unas llaves y una mano anciana.",
      },
    },
    {
      code: "S4",
      name: "Más Allá del Cuerpo",
      description: "Reflexionar sobre el yo, el cuerpo y la realidad.",
      media: {
        src: "/landing/media/etapa-s4.webp",
        width: 1376,
        height: 768,
        alt: "Una mujer sentada con gafas de realidad virtual junto a una forma de luz violeta que se eleva a su lado.",
      },
    },
    {
      code: "S5",
      name: "Ofrenda",
      description: "Soltar, agradecer y ofrecer algo significativo al grupo.",
      media: {
        src: "/landing/media/etapa-s5.webp",
        width: 1536,
        height: 1024,
        alt: "Una persona sentada en el centro de un círculo de cuerpos de luz violeta, con una luz en las manos.",
      },
    },
    {
      code: "S6",
      name: "Integración Grupal",
      description: "Dar sentido a lo vivido y compartir lo que permanece.",
      media: {
        src: "/landing/media/etapa-s6.webp",
        width: 1536,
        height: 1024,
        alt: "Un hombre participa desde su portátil en una videollamada con el grupo.",
      },
    },
  ] as readonly Stage[],
} as const;

export const JOIN = {
  heading: "Cómo incorporarse al estudio",
  steps: [
    {
      numeral: "01",
      label: "Responde el cuestionario",
      body: "Comparte tu interés mediante el formulario de Qualtrics. Enviarlo no te compromete a participar. En ese primer cuestionario se te entregará toda la información y deberás firmar el consentimiento informado. El equipo tiene que revisar tus respuestas primero para ver si este estudio es adecuado para ti.",
      visual: {
        // The founder's enhanced version (D-055), same scene, new file name
        // since nothing pins the old one and content changed.
        src: "/landing/media/join-responde-v2.webp",
        alt: "Una mujer responde un cuestionario en una tableta, sentada a la mesa de su casa al anochecer.",
      },
    },
    {
      numeral: "02",
      label: "Habla con el equipo",
      body: "Si el estudio es adecuado para ti, el equipo revisará contigo los requisitos, resolverá tus dudas y te explicará el estudio.",
      visual: {
        src: "/landing/media/join-habla.webp",
        alt: "Una mujer conversa por videollamada con una profesional desde un portátil en su casa.",
      },
    },
    {
      numeral: "03",
      label: "Asignación a tu cohorte",
      body: "Si resultas seleccionado/a, te asignaremos a una cohorte del estudio y coordinaremos una visita para entregarte las gafas de realidad virtual y explicarte cómo utilizarlas.",
      visual: {
        src: "/landing/media/join-recibe.webp",
        alt: "Una integrante del equipo entrega en la puerta de una casa unas gafas de realidad virtual en su estuche.",
      },
    },
  ],
  supporting: "Mostrar interés no te compromete a participar.",
} as const;

/** One definition for both branches, with the same number of lines (D-042, D-049). */
export interface Branch {
  readonly label: string;
  /**
   * Working draft (founder wording, D-050). The control line states that the
   * control group receives a similar experience, which must match the
   * protocol. `condition` keeps blocking publication until the study team
   * approves it.
   */
  readonly lines: readonly [string, string];
  readonly condition: Missing;
}

export const SPLIT = {
  eyebrow: "Los dos grupos del estudio",
  heading: "La asignación se realiza al azar.",
  body: [
    "Este estudio es un ensayo controlado aleatorizado: para saber si un programa funciona hay que comparar. Formamos dos grupos con personas en una situación parecida y es el azar quien decide en cuál está cada una. Al final del estudio comparamos cómo está cada grupo.",
    "Así podemos distinguir qué cambios se deben al programa y cuáles habrían ocurrido de todos modos. Para que la comparación sea justa, nadie elige su grupo.",
  ],
  branches: [
    {
      label: "Grupo del programa",
      lines: ["Participa en el programa Clear Light durante el estudio.", "Sigue con su seguimiento médico habitual. Completa las mismas medidas que el otro grupo."],
      condition: missing("CONDICION_GRUPO_PROGRAMA", "Descripción aprobada del grupo del programa"),
    },
    {
      label: "Grupo de comparación",
      lines: ["Sigue con su seguimiento médico habitual.", "Completa las mismas medidas que el otro grupo. Al finalizar su participación, se le ofrecerá de forma opcional un PDF con los resultados y accesso a la Realidad Virtual de Clear Light Solo."],
      condition: missing("CONDICION_GRUPO_CONTROL", "Descripción aprobada del grupo control"),
    },
  ] as readonly [Branch, Branch],
  labels: missing("ETIQUETAS_GRUPOS", "Nombres aprobados de los dos grupos"),
  supporting: "Los dos grupos tienen la misma importancia para el estudio.",
} as const;

export interface FaqItem {
  readonly id: string;
  readonly topic: string;
  /**
   * Working answer (founder-chosen drafts, D-051). General wording only: no
   * criterion, duration, risk or contact detail the protocol has not supplied.
   */
  readonly statements: readonly string[];
  /** Not rendered (D-051); still blocks publication until the protocol value is approved. */
  readonly pending: Missing;
}

export const ELIGIBILITY = {
  heading: "¿Este estudio puede ser para mí?",
  intro: "La elegibilidad se confirma con el equipo. Aquí puedes revisar los criterios aprobados y las preguntas más frecuentes.",
  criteriaHeading: "Criterios de participación",
  /**
   * Criteria supplied by the founder (2026-09-15, D-051). Not necessarily the
   * full protocol list (no exclusions yet), so the text below remits the rest
   * to the call and `criteria` keeps blocking publication.
   */
  criteriaItems: ["Tener una enfermedad grave o avanzada.", "Hablar castellano."],
  criteriaText:
    "En la llamada con el equipo revisaremos juntos si el estudio encaja contigo, según todos los criterios aprobados para el estudio.",
  criteria: missing("CRITERIOS", "Criterios de inclusión y exclusión aprobados"),
  
  registry: missing("REGISTRO", "Registro público e identificador del estudio"),
  investigator: missing("EQUIPO", "Investigador responsable, promotor y centro"),
  participantAlt:
    "Una persona sentada con las piernas cruzadas sobre una alfombra tejida, con unas gafas de realidad virtual y un mando en cada mano; un aura violeta la envuelve y una luz cálida brilla en el centro del pecho.",
  faq: [
    {
      id: "participar",
      topic: "Qué implica participar",
      statements: [
        "El programa tiene varias etapas: preparación, encuentros por videollamada y sesiones de realidad virtual. Te explicaremos la duración y el calendario antes de empezar.",
        "La participación es voluntaria.",
      ],
      pending: missing("DEDICACION", "Duración total, número y formato de las sesiones, lugar y dedicación"),
    },
    {
      id: "beneficios",
      topic: "Posibles beneficios y riesgos",
      statements: [
        // Founder wording (D-052), in the page's "tú" register.
        "Aunque estudios previos sugieren que esta experiencia podría resultar beneficiosa, no se garantizan beneficios personales: no es posible asegurar que participar te aporte un beneficio directo.",
        "La participación es voluntaria y no será remunerada.",
        "Antes de decidir, el equipo te explicará con detalle los posibles beneficios, riesgos y molestias.",
      ],
      pending: missing("RIESGOS", "Posibles beneficios, riesgos, molestias y cargas aprobados"),
    },
    {
      id: "grupos",
      topic: "Qué recibe cada grupo",
      statements: [
        "La asignación se realiza al azar: no puedes elegir tu grupo y el equipo tampoco lo decide.",
        "Los dos grupos responden las mismas medidas a lo largo del estudio y siguen con su seguimiento médico habitual.",
        "El grupo del programa participa en Clear Light y el grupo de comparación al final de su participación, recibe un PDF con los resultados y acceso a Clear Light Solo.",
      ],
      pending: missing("CONDICION_GRUPOS", "Descripción aprobada de lo que recibe cada grupo"),
    },
    {
      id: "gafas",
      topic: "Uso de las gafas de realidad virtual",
      statements: [
        "Si eres asignado al grupo del programa, una persona del equipo te entrega las gafas en casa y te explica cómo usarlas.",
        "Participas de todo el programa desde casa.",
        "Si tienes dudas durante el estudio, el equipo te ayuda.",
      ],
      pending: missing("EQUIPAMIENTO", "Entrega, configuración y devolución del equipo, y adaptaciones de accesibilidad"),
    },
    {
      id: "retirada",
      topic: "Participación voluntaria y retirada",
      statements: [
        "Puedes hacer preguntas antes de decidir.",
        "Puedes dejar el estudio en cualquier momento, sin tener que dar explicaciones.",
        "Para participar, deberás firmar un consentimiento informado en el que se te entrega toda la información.",
      ],
      pending: missing("RETIRADA", "Procedimiento aprobado de retirada y de contacto"),
    },
    {
      id: "datos",
      topic: "Confidencialidad y protección de datos",
      statements: [
        "Tus datos personales se tratarán de forma confidencial y solo para los fines del estudio.",
        "El equipo identifica a cada participante con un código, no con su nombre. Las respuestas de los cuestionarios se guardan en sistemas aprobados por la institución, separadas de tus datos de contacto.",
        "Puedes pedir acceder a tus datos, corregirlos o suprimirlos, y retirar tu consentimiento en cualquier momento. Encontrarás los detalles en la política de privacidad y en la información de consentimiento.",
      ],
      pending: missing("PROTECCION_DATOS", "Aprobación del texto de confidencialidad y protección de datos por el DPO o el comité de ética"),
    },
    {
      id: "contacto",
      topic: "Contacto y registro del estudio",
      statements: [
        "Cuando completes el cuestionario, el equipo se pondrá en contacto contigo.",
      ],
      pending: missing("CONTACTO", "Correo electrónico y teléfono del estudio, vía alternativa de contacto y enlace al registro"),
    },
  ] as readonly FaqItem[],
} as const;

export interface Partner {
  readonly name: string;
  /** One logo under /landing/media/partners, sized for a dark ground. */
  readonly logo: { readonly src: string; readonly width: number; readonly height: number };
}

/**
 * Research partners and funding credit (D-077, added at the team's request
 * alongside the hero simplification). Institutional, not participant-facing
 * explanation: names and marks only, no claim about what each partner does on
 * the study. Sits just above the footer, after the final invitation.
 */
export const PARTNERS = {
  heading: "Colaboran en este estudio",
  items: [
    { name: "CiTIUS · Centro Singular de Investigación en Tecnoloxías Intelixentes", logo: { src: "/landing/media/partners/citius.png", width: 3367, height: 1218 } },
    { name: "Xunta de Galicia", logo: { src: "/landing/media/partners/xunta-de-galicia.png", width: 7000, height: 2000 } },
    { name: "Universidade de Santiago de Compostela", logo: { src: "/landing/media/partners/usc.webp", width: 3840, height: 2498 } },
    { name: "Intangible Realities Laboratory", logo: { src: "/landing/media/partners/irl.png", width: 280, height: 140 } },
  ] as readonly Partner[],
  funding: {
    heading: "Con la financiación de",
    name: "Tiny Blue Dot Foundation",
    logo: { src: "/landing/media/partners/tiny-blue-dot-foundation.png", width: 1500, height: 308 },
  },
} as const;

export const INVITATION = {
  heading: "Decide con toda la información.",
  support: "Mostrar interés no equivale a dar consentimiento.",
  qualtricsUrl: missing("URL_QUALTRICS", "URL de producción del cuestionario Qualtrics (studies.screening_url)"),
  closed: "El cuestionario de interés no está disponible en este momento.",
  footer: {
    /** Accessible name of the footer navigation. */
    navLabel: "Pie de página",
    tagline: "Estudio de investigación sobre un programa grupal de realidad virtual.",
    groups: [
      {
        heading: "El estudio",
        links: [
          { href: "#porque", label: "Información del estudio" },
          { href: "#elegibilidad", label: "Preguntas frecuentes" },
          { href: "#contacto", label: "Contacto" },
        ],
      },
      {
        heading: "Legal",
        links: [
          { href: "/aviso-legal", label: "Aviso legal y condiciones de uso" },
          { href: "/privacidad", label: "Política de privacidad" },
          { href: "/cookies", label: "Política de cookies" },
        ],
      },
    ],
    cookieSettings: "Configurar cookies",
    still: { pause: "Pausar animación", resume: "Reanudar animación" },
    note: "Material de reclutamiento en preparación. La información definitiva se publicará tras su aprobación.",
    /** The policy page exists (D-052); its text still needs legal approval. */
    privacy: missing("PRIVACIDAD", "Aprobación legal de la política de privacidad"),
    /** Not rendered (D-052); still blocks publication. */
    version: missing("VERSION_MATERIAL", "Versión y fecha del material de reclutamiento"),
  },
  arcAlt: "Un arco de seis cuerpos de luz azulada con un pequeño fuego naranja en el centro, sobre fondo oscuro.",
} as const;

/**
 * The contact dialog (D-052). Design only: nothing is sent or stored until the
 * study team approves where messages go, and the dialog says so on submit.
 */
export const CONTACT = {
  title: "Contactar con el equipo",
  intro: "Escríbenos si tienes dudas sobre el estudio.",
  name: "Nombre",
  email: "Correo electrónico",
  message: "Mensaje",
  healthNote: "Por favor, no incluyas información sobre tu salud en el mensaje.",
  privacyBefore: "Usaremos estos datos solo para responderte. Consulta la",
  privacyLink: "política de privacidad",
  submit: "Enviar mensaje",
  close: "Cerrar",
  unavailable: "El envío de mensajes estará disponible próximamente. Tu mensaje no se ha enviado ni guardado.",
  destination: missing("CONTACTO_FORMULARIO", "Destino aprobado de los mensajes del formulario de contacto"),
} as const;

/**
 * Cookie and third-party consent (D-052). The page sets no cookies of its own;
 * the only optional content is the section 3 YouTube film.
 */
export const CONSENT = {
  title: "Cookies y contenido de terceros",
  body: "Esta web solo usa el almacenamiento técnico necesario para funcionar. Si lo aceptas, también podremos cargar el vídeo de YouTube, que puede guardar datos en tu navegador.",
  accept: "Aceptar",
  reject: "Rechazar",
  policy: "Política de cookies",
  filmBlocked: "Para ver el vídeo, acepta el contenido de YouTube.",
  filmAccept: "Aceptar y reproducir",
} as const;

export const META = {
  title: "Clear Light · Estudio de investigación",
  description:
    "Estudio de investigación con asignación al azar sobre una experiencia grupal de realidad virtual. Información pública para personas interesadas.",
} as const;

/** The language switch (D-063). Language names are endonyms, in src/domain/locale.ts. */
export const LANGUAGE = {
  label: "Idioma",
} as const;

/** Shown in production instead of any public page while an approval is missing. */
export const HOLDING = {
  title: "Sitio en preparación",
  body: "La información pública del estudio se publicará cuando esté aprobada.",
} as const;

/** The whole Spanish page, as one value of the shape every translation has. */
export const LANDING_ES = {
  ACTIONS,
  NAV,
  HERO,
  WHY,
  WHAT,
  STAGES,
  JOIN,
  SPLIT,
  ELIGIBILITY,
  PARTNERS,
  INVITATION,
  CONTACT,
  CONSENT,
  META,
  LANGUAGE,
  HOLDING,
} as const;

/** `T` with every string literal widened to `string`, so a translation can type-check against it. */
type Translatable<T> = T extends string ? string : T extends object ? { readonly [K in keyof T]: Translatable<T[K]> } : T;

export type LandingCopy = Translatable<typeof LANDING_ES>;

/**
 * Every unresolved value on the page, in one list. Rendered as placeholders in
 * development; in production the page refuses to publish while it is non-empty.
 */
export function missingContentList(resolved: { qualtricsUrl: string | null } = { qualtricsUrl: null }): readonly Missing[] {
  const seen = new Map<string, Missing>();
  const add = (m: Missing) => {
    if (!seen.has(m.key)) seen.set(m.key, m);
  };
  add(WHAT.film.captions);
  add(STAGES.approval);
  for (const b of SPLIT.branches) add(b.condition);
  add(SPLIT.labels);
  add(ELIGIBILITY.criteria);
  add(ELIGIBILITY.registry);
  add(ELIGIBILITY.investigator);
  for (const f of ELIGIBILITY.faq) add(f.pending);
  // The Qualtrics URL is configuration (studies.screening_url), so it is only
  // missing while no open study has one.
  if (!resolved.qualtricsUrl) add(INVITATION.qualtricsUrl);
  add(INVITATION.footer.privacy);
  add(INVITATION.footer.version);
  add(CONTACT.destination);
  for (const m of legalMissing()) add(m);
  return [...seen.values()];
}

/** Every visible string of one language's page and legal texts, for the copy tests. */
export function visibleStrings(copy: LandingCopy = LANDING_ES, legal: LegalCopy = LEGAL): readonly string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (isMissing(v)) {
        out.push(v.needs);
        return;
      }
      Object.values(v).forEach(walk);
    }
  };
  walk({ copy, legal });
  return out;
}
