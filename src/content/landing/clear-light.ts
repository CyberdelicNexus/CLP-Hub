/**
 * Working Spanish copy for the aNUma Clear Light recruitment landing page.
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
 * Copy rules enforced by tests/landing-content.test.ts: Spanish only, no em or
 * en dashes, exactly two randomized groups described identically, one label per
 * intent.
 */

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
  teamAccess: "Acceso del equipo",
} as const;

export const NAV = [
  { href: "#porque", label: "El estudio" },
  { href: "#incorporarse", label: "Participar" },
  { href: "#elegibilidad", label: "Preguntas" },
] as const;

export const HERO = {
  eyebrow: "Estudio clínico · Realidad virtual compartida",
  headline: "¿Puede una experiencia compartida transformar cómo nos relacionamos con la mortalidad?",
  support: "Un estudio investiga una experiencia grupal para explorar el cuerpo, la identidad y la conexión.",
  reveal: {
    show: "Revelar a las personas",
    hide: "Volver a las luces",
    pointerHint: "o mueve el cursor sobre la imagen",
    touchHint: "o mantén pulsada la imagen",
    /** Alt text for the layered still. */
    luminousAlt: "Siete presencias de luz azul violeta, difusas, sentadas en un arco poco profundo sobre un fondo oscuro.",
    physicalAlt:
      "Siete personas sentadas en círculo en una sala cálida, cada una con unas gafas Meta Quest 3 y dos mandos en las manos.",
  },
} as const;

export const WHY = {
  headline: "Mirar de frente lo que nos transforma.",
  body: "Una enfermedad que amenaza la vida puede cambiar nuestra relación con el cuerpo, el tiempo y con quienes amamos. Este estudio explora si una experiencia compartida puede abrir un espacio de presencia, conexión y sentido.",
} as const;

export const WHAT = {
  headline: "Una experiencia guiada para explorar juntos.",
  body: "Clear Light es un programa experiencial en pequeño grupo. Combina preparación, encuentros por videollamada y sesiones inmersivas de realidad virtual para explorar la vida, la identidad, la impermanencia y la conexión.",
  facts: ["Pequeño grupo", "Acompañamiento humano", "Realidad virtual guiada"],
  film: {
    label: "Una mirada al proyecto",
    play: "Reproducir el vídeo",
    /** Truthful: the derivative is silent; the source carried only ambient audio. */
    context: "Vídeo sin audio, con contexto en español.",
    description:
      "Fragmento del entorno de realidad virtual del programa: un grupo de cuerpos de luz que se reúne, se acerca y se aleja en un espacio oscuro.",
    captions: missing("SUBTITULOS_VIDEO", "Subtítulos o transcripción en español aprobados para el vídeo de la sección 3"),
  },
} as const;

export interface Stage {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** Poster and optional clip under /landing/media. */
  readonly media: { readonly poster: string; readonly clip?: string; readonly alt: string };
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
      media: { poster: "/landing/media/stage-s0.webp", alt: "Una hilera de pequeñas luces lejanas sobre fondo oscuro." },
    },
    {
      code: "S1",
      name: "Orientación",
      description: "El grupo se conoce y sitúa la experiencia.",
      media: {
        poster: "/landing/media/stage-s1.webp",
        clip: "/landing/media/stage-s1.mp4",
        alt: "Una luz grande se acerca a una hilera de luces pequeñas.",
      },
    },
    {
      code: "S2",
      name: "Cuerpos de Luz",
      description: "Explorar cómo se siente habitar una forma hecha de luz.",
      media: {
        poster: "/landing/media/stage-s2.webp",
        clip: "/landing/media/stage-s2.mp4",
        alt: "Un grupo de cuerpos de luz blanca y violeta reunidos en la oscuridad.",
      },
    },
    {
      code: "S3",
      name: "Vida",
      description: "Recorrer la propia historia con atención y autocompasión.",
      media: {
        poster: "/landing/media/stage-s3.webp",
        clip: "/landing/media/stage-s3.mp4",
        alt: "Un cuerpo de luz violeta con un punto cálido en el pecho avanza despacio.",
      },
    },
    {
      code: "S4",
      name: "Más Allá del Cuerpo",
      description: "Reflexionar sobre el yo, el cuerpo y la realidad.",
      media: {
        poster: "/landing/media/stage-s4.webp",
        clip: "/landing/media/stage-s4.mp4",
        alt: "Una figura de luz azul se disuelve en una forma luminosa más amplia.",
      },
    },
    {
      code: "S5",
      name: "Ofrenda",
      description: "Soltar, agradecer y ofrecer algo significativo al grupo.",
      media: {
        poster: "/landing/media/stage-s5.webp",
        clip: "/landing/media/stage-s5.mp4",
        alt: "Un anillo de pequeñas luces cálidas de color naranja.",
      },
    },
    {
      code: "S6",
      name: "Integración Grupal",
      description: "Dar sentido a lo vivido y compartir lo que permanece.",
      media: {
        poster: "/landing/media/stage-s6.webp",
        clip: "/landing/media/stage-s6.mp4",
        alt: "Dos cuerpos de luz violeta se encuentran y permanecen juntos.",
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
      body: "Comparte tu interés mediante el formulario de Qualtrics. Enviarlo no te compromete a participar.",
      visual: { src: "/landing/media/join-1.webp", alt: "Una presencia de luz azul, sola y tranquila, en la oscuridad." },
    },
    {
      numeral: "02",
      label: "Habla con el equipo",
      body: "El equipo revisará contigo los requisitos, resolverá tus dudas y explicará el estudio.",
      visual: { src: "/landing/media/join-2.webp", alt: "Dos cuerpos de luz violeta, uno frente al otro." },
    },
    {
      numeral: "03",
      label: "Decide con toda la información",
      body: "Si el estudio encaja y deseas continuar, recibirás la información de consentimiento antes de incorporarte.",
      visual: { src: "/landing/media/join-3.webp", alt: "Un anillo de luces cálidas, como un grupo reunido." },
    },
  ],
  supporting: "Mostrar interés no te compromete a participar.",
  visuals: missing("FOTOS_INCORPORACION", "Fotografías documentales aprobadas para los tres pasos de incorporación"),
} as const;

/** One definition for both branches: only the label may differ (D-042). */
export interface Branch {
  readonly label: string;
  readonly condition: Missing;
}

export const SPLIT = {
  eyebrow: "Por qué hay dos grupos",
  heading: "La asignación se realiza al azar.",
  body: "Un sistema te asignará a uno de los dos grupos. Ambos son necesarios para comparar los resultados con rigor.",
  branches: [
    { label: "Grupo del programa", condition: missing("CONDICION_GRUPO_PROGRAMA", "Descripción aprobada del grupo del programa") },
    { label: "Grupo control", condition: missing("CONDICION_GRUPO_CONTROL", "Descripción aprobada del grupo control") },
  ] as readonly [Branch, Branch],
  labels: missing("ETIQUETAS_GRUPOS", "Nombres aprobados de los dos grupos"),
  supporting: "Los dos grupos tienen la misma importancia para el estudio.",
} as const;

export interface FaqItem {
  readonly id: string;
  readonly topic: string;
  /** Statements the ethical design contract requires, or nothing yet. */
  readonly statements: readonly string[];
  readonly pending: Missing;
}

export const ELIGIBILITY = {
  heading: "¿Este estudio puede ser para mí?",
  intro: "La elegibilidad se confirma con el equipo. Aquí puedes revisar los criterios aprobados y las preguntas más frecuentes.",
  criteriaHeading: "Criterios de participación",
  criteria: missing("CRITERIOS", "Criterios de inclusión y exclusión aprobados"),
  requiredLine: "No se garantizan beneficios personales.",
  registry: missing("REGISTRO", "Registro público e identificador del estudio"),
  investigator: missing("EQUIPO", "Investigador responsable, promotor y centro"),
  participantAlt:
    "Una persona sentada con las piernas cruzadas en una sala luminosa, con unas gafas de realidad virtual y un mando en cada mano; una luz cálida y difusa en el centro del pecho.",
  faq: [
    {
      id: "participar",
      topic: "Qué implica participar",
      statements: ["La participación es voluntaria."],
      pending: missing("DEDICACION", "Duración total, número y formato de las sesiones, lugar y dedicación"),
    },
    {
      id: "beneficios",
      topic: "Posibles beneficios y riesgos",
      statements: ["No se garantiza un beneficio personal.", "Todavía no sabemos si esta experiencia ayuda."],
      pending: missing("RIESGOS", "Posibles beneficios, riesgos, molestias y cargas aprobados"),
    },
    {
      id: "grupos",
      topic: "Qué recibe cada grupo",
      statements: ["La asignación se realiza al azar. No puedes elegir el grupo."],
      pending: missing("CONDICION_GRUPOS", "Descripción aprobada de lo que recibe cada grupo"),
    },
    {
      id: "gafas",
      topic: "Uso de las gafas de realidad virtual",
      statements: [],
      pending: missing("EQUIPAMIENTO", "Entrega, configuración y devolución del equipo, y adaptaciones de accesibilidad"),
    },
    {
      id: "retirada",
      topic: "Participación voluntaria y retirada",
      statements: ["Puedes hacer preguntas antes de decidir.", "Puedes dejar el estudio según el procedimiento aprobado."],
      pending: missing("RETIRADA", "Procedimiento aprobado de retirada y de contacto"),
    },
    {
      id: "contacto",
      topic: "Contacto y registro del estudio",
      statements: [],
      pending: missing("CONTACTO", "Correo electrónico y teléfono del estudio, vía alternativa de contacto y enlace al registro"),
    },
  ] as readonly FaqItem[],
} as const;

export const INVITATION = {
  heading: "Decide con toda la información.",
  support: "Mostrar interés no equivale a dar consentimiento.",
  qualtricsUrl: missing("URL_QUALTRICS", "URL de producción del cuestionario Qualtrics (studies.screening_url)"),
  closed: "El cuestionario de interés no está disponible en este momento.",
  footer: {
    study: { href: "#porque", label: "Información del estudio" },
    privacy: missing("PRIVACIDAD", "Enlace aprobado a la información de privacidad"),
    contact: { href: "#contacto", label: "Contacto" },
    note: "Material de reclutamiento en preparación. La información definitiva se publicará tras su aprobación.",
    version: missing("VERSION_MATERIAL", "Versión y fecha del material de reclutamiento"),
  },
  arcAlt: "Un arco de cuerpos de luz azulada, difusos, sobre fondo oscuro.",
  fireAlt: "",
} as const;

export const META = {
  title: "aNUma Clear Light · Estudio de investigación",
  description:
    "Estudio de investigación con asignación al azar sobre una experiencia grupal de realidad virtual. Información pública en español para personas interesadas.",
} as const;

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
  add(JOIN.visuals);
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
  return [...seen.values()];
}

/** Every visible string, for the copy tests. */
export function visibleStrings(): readonly string[] {
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
  walk({ ACTIONS, NAV, HERO, WHY, WHAT, STAGES, JOIN, SPLIT, ELIGIBILITY, INVITATION, META });
  return out;
}
