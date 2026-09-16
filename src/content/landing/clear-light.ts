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

import { LEGAL, legalMissing } from "@/content/landing/legal";

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
  eyebrow: "Estudio de investigación · Realidad virtual compartida",
  headline: "¿Puede una experiencia inmersiva transformar cómo nos relacionamos con la mortalidad?",
  support:
    "Este estudio investiga si es posible reducir la ansiedad ante la muerte y aumentar la aceptación de este proceso universal.",
  reveal: {
    /** Alt text for the layered still. No explicit toggle labels: the control was removed (D-054). */
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
        alt: "Un portátil con una videollamada de grupo que comparte la presentación «¿Cómo prepararse para el programa?».",
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
        alt: "Unas manos entregan a otras unas gafas de realidad virtual.",
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
      body: "Comparte tu interés mediante el formulario de Qualtrics. Enviarlo no te compromete a participar.",
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
      body: "El equipo revisará contigo los requisitos, resolverá tus dudas y explicará el estudio.",
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
  eyebrow: "Por qué hay dos grupos",
  heading: "La asignación se realiza al azar.",
  body: [
    "Este estudio es un ensayo controlado aleatorizado. Formamos dos grupos parecidos: uno participa en el programa Clear Light y el otro en una experiencia similar. Al final comparamos cómo está cada grupo.",
    "Así podemos saber qué cambios se deben al programa y no a otros factores. Para que la comparación sea justa, nadie elige su grupo: lo decide el azar.",
  ],
  branches: [
    {
      label: "Grupo del programa",
      lines: ["Participa en el programa Clear Light.", "Nos muestra qué cambia con la experiencia."],
      condition: missing("CONDICION_GRUPO_PROGRAMA", "Descripción aprobada del grupo del programa"),
    },
    {
      label: "Grupo control",
      lines: ["Recibe una experiencia similar para comparar.", "Nos permite medir los resultados con rigor."],
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
  criteriaItems: ["Tener una enfermedad que amenaza la vida.", "Hablar castellano."],
  criteriaText:
    "En la llamada con el equipo revisaremos juntos si el estudio encaja contigo, según todos los criterios aprobados para el estudio.",
  criteria: missing("CRITERIOS", "Criterios de inclusión y exclusión aprobados"),
  requiredLine: "No se garantizan beneficios personales.",
  registry: missing("REGISTRO", "Registro público e identificador del estudio"),
  investigator: missing("EQUIPO", "Investigador responsable, promotor y centro"),
  participantAlt:
    "Una persona sentada con las piernas cruzadas sobre una alfombra tejida, con unas gafas de realidad virtual y un mando en cada mano; un aura violeta la envuelve y una luz cálida brilla en el centro del pecho.",
  faq: [
    {
      id: "participar",
      topic: "Qué implica participar",
      statements: [
        "El programa tiene siete etapas: preparación, encuentros por videollamada y sesiones de realidad virtual. Te explicaremos la duración y el calendario antes de empezar.",
        "La participación es voluntaria.",
      ],
      pending: missing("DEDICACION", "Duración total, número y formato de las sesiones, lugar y dedicación"),
    },
    {
      id: "beneficios",
      topic: "Posibles beneficios y riesgos",
      statements: [
        // Founder wording (D-052), in the page's "tú" register.
        "No se espera que obtengas ningún beneficio directo por participar en el estudio. La participación es voluntaria y no será remunerada.",
        "La investigación pretende descubrir aspectos desconocidos o poco claros sobre el potencial del uso de la realidad virtual en la salud mental y el bienestar en personas con diagnóstico de enfermedad amenazante para la vida. Esta información podrá ser de utilidad en un futuro para otras personas.",
        "Antes de decidir, el equipo te explicará con detalle los posibles beneficios, riesgos y molestias.",
      ],
      pending: missing("RIESGOS", "Posibles beneficios, riesgos, molestias y cargas aprobados"),
    },
    {
      id: "grupos",
      topic: "Qué recibe cada grupo",
      statements: [
        "La asignación se realiza al azar. No puedes elegir el grupo.",
        "El grupo del programa participa en Clear Light. El grupo control recibe una experiencia similar para poder comparar.",
      ],
      pending: missing("CONDICION_GRUPOS", "Descripción aprobada de lo que recibe cada grupo"),
    },
    {
      id: "gafas",
      topic: "Uso de las gafas de realidad virtual",
      statements: [
        "Una persona del equipo te entrega las gafas en casa y te explica cómo usarlas.",
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
        "Publicaremos aquí el registro del estudio y los datos de contacto.",
      ],
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
    tagline: "Estudio de investigación sobre una experiencia grupal de realidad virtual.",
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
  walk({ ACTIONS, NAV, HERO, WHY, WHAT, STAGES, JOIN, SPLIT, ELIGIBILITY, INVITATION, CONTACT, CONSENT, META, LEGAL });
  return out;
}
