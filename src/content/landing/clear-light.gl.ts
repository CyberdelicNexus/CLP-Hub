/**
 * Galician translation of clear-light.ts (D-063).
 *
 * STATUS: working draft, published at the founder's direction without native
 * editorial or ethics review. Shape, `Missing` markers (reused by reference),
 * `href`, `src` and `id` values must match the Spanish source.
 */

import { LANDING_ES as ES, type LandingCopy } from "@/content/landing/clear-light";

export const LANDING_GL: LandingCopy = {
  ACTIONS: {
    primaryCta: "Comprobar se podo participar",
    exploreCta: "Coñecer o estudo",
    contactCta: "Contactar co equipo",
  },
  NAV: [
    { href: "#porque", label: "O estudo" },
    { href: "#incorporarse", label: "Participar" },
    { href: "#elegibilidad", label: "Preguntas" },
  ],
  HERO: {
    eyebrow: "Estudo de investigación · Realidade virtual compartida",
    headline: "Pode unha experiencia inmersiva transformar como nos relacionamos coa mortalidade?",
    support:
      "Este estudo investiga se é posible reducir a ansiedade ante a morte e aumentar a aceptación deste proceso universal.",
    reveal: {
      luminousAlt: "Sete presenzas de luz azul violeta, difusas, sentadas nun arco pouco profundo sobre un fondo escuro.",
      physicalAlt:
        "Sete persoas sentadas en círculo nunha sala cálida, cada unha cunhas gafas Meta Quest 3 e dous mandos nas mans.",
    },
  },
  WHY: {
    headline: "Mirar de fronte o que nos transforma.",
    body: "Unha enfermidade que ameaza a vida pode cambiar a nosa relación co corpo, o tempo e con quen amamos. Este estudo explora se unha experiencia compartida pode abrir un espazo de presenza, conexión e sentido.",
  },
  WHAT: {
    headline: "Unha experiencia guiada para explorar xuntos.",
    body: "Clear Light é un programa experiencial en pequeno grupo. Combina preparación, encontros por videochamada e sesións inmersivas de realidade virtual para explorar a vida, a identidade, a impermanencia e a conexión.",
    facts: ["Pequeno grupo", "Acompañamento humano", "Realidade virtual guiada"],
    film: {
      label: "Unha ollada ao proxecto",
      play: "Reproducir o vídeo",
      posterAlt:
        "Unha persoa sentada coas pernas cruzadas diante dun fondo azul, cunhas gafas de realidade virtual e un mando en cada man; unha luz cálida no peito.",
      captions: ES.WHAT.film.captions,
    },
  },
  STAGES: {
    heading: "Etapas do Programa",
    intro: "Unha experiencia progresiva para preparar, explorar, compartir e integrar.",
    approval: ES.STAGES.approval,
    items: [
      {
        code: "S0",
        name: "Preparación",
        description: "Posta a punto técnica e persoal antes de comezar.",
        media: {
          src: "/landing/media/etapa-s0.webp",
          width: 1536,
          height: 1024,
          alt: "Un portátil cunha videochamada de grupo que comparte a presentación «Como prepararse para o programa?».",
        },
      },
      {
        code: "S1",
        name: "Orientación",
        description: "O grupo coñécese e sitúa a experiencia.",
        media: {
          src: "/landing/media/etapa-s1.webp",
          width: 1536,
          height: 1024,
          alt: "Unhas mans entregan a outras unhas gafas de realidade virtual.",
        },
      },
      {
        code: "S2",
        name: "Corpos de Luz",
        description: "Explorar como se sente habitar unha forma feita de luz.",
        media: {
          src: "/landing/media/etapa-s2-v4.webp",
          width: 3632,
          height: 2048,
          alt: "Unha muller cunha luz cálida no peito e nas palmas, envolta nun contorno de luz violeta.",
        },
      },
      {
        code: "S3",
        name: "Vida",
        description: "Percorrer a propia historia con atención e autocompaixón.",
        media: {
          src: "/landing/media/etapa-s3.webp",
          width: 1915,
          height: 821,
          alt: "Unha tira de película con escenas dunha vida: a man dun bebé, unhas zapatillas infantís, un caderno, unhas chaves e unha man anciá.",
        },
      },
      {
        code: "S4",
        name: "Máis Alá do Corpo",
        description: "Reflexionar sobre o eu, o corpo e a realidade.",
        media: {
          src: "/landing/media/etapa-s4.webp",
          width: 1376,
          height: 768,
          alt: "Unha muller sentada con gafas de realidade virtual xunto a unha forma de luz violeta que se eleva ao seu carón.",
        },
      },
      {
        code: "S5",
        name: "Ofrenda",
        description: "Soltar, agradecer e ofrecer algo significativo ao grupo.",
        media: {
          src: "/landing/media/etapa-s5.webp",
          width: 1536,
          height: 1024,
          alt: "Unha persoa sentada no centro dun círculo de corpos de luz violeta, cunha luz nas mans.",
        },
      },
      {
        code: "S6",
        name: "Integración Grupal",
        description: "Dar sentido ao vivido e compartir o que permanece.",
        media: {
          src: "/landing/media/etapa-s6.webp",
          width: 1536,
          height: 1024,
          alt: "Un home participa desde o seu portátil nunha videochamada co grupo.",
        },
      },
    ],
  },
  JOIN: {
    heading: "Como incorporarse ao estudo",
    steps: [
      {
        numeral: "01",
        label: "Responde o cuestionario",
        body: "Comparte o teu interese mediante o formulario de Qualtrics. Envialo non te compromete a participar.",
        visual: {
          src: "/landing/media/join-responde-v2.webp",
          alt: "Unha muller responde un cuestionario nunha tableta, sentada á mesa da súa casa ao anoitecer.",
        },
      },
      {
        numeral: "02",
        label: "Fala co equipo",
        body: "O equipo revisará contigo os requisitos, resolverá as túas dúbidas e explicará o estudo.",
        visual: {
          src: "/landing/media/join-habla.webp",
          alt: "Unha muller conversa por videochamada cunha profesional desde un portátil na súa casa.",
        },
      },
      {
        numeral: "03",
        label: "Asignación á túa cohorte",
        body: "Se resultas seleccionado/a, asignarémoste a unha cohorte do estudo e coordinaremos unha visita para entregarche as gafas de realidade virtual e explicarche como utilizalas.",
        visual: {
          src: "/landing/media/join-recibe.webp",
          alt: "Unha integrante do equipo entrega na porta dunha casa unhas gafas de realidade virtual no seu estoxo.",
        },
      },
    ],
    supporting: "Amosar interese non te compromete a participar.",
  },
  SPLIT: {
    eyebrow: "Por que hai dous grupos",
    heading: "A asignación realízase ao azar.",
    body: [
      "Este estudo é un ensaio controlado aleatorizado. Formamos dous grupos parecidos: un participa no programa Clear Light e o outro nunha experiencia similar. Ao final comparamos como está cada grupo.",
      "Así podemos saber que cambios se deben ao programa e non a outros factores. Para que a comparación sexa xusta, ninguén elixe o seu grupo: decídeo o azar.",
    ],
    branches: [
      {
        label: "Grupo do programa",
        lines: ["Participa no programa Clear Light.", "Móstranos que cambia coa experiencia."],
        condition: ES.SPLIT.branches[0].condition,
      },
      {
        label: "Grupo control",
        lines: ["Recibe unha experiencia similar para comparar.", "Permítenos medir os resultados con rigor."],
        condition: ES.SPLIT.branches[1].condition,
      },
    ],
    labels: ES.SPLIT.labels,
    supporting: "Os dous grupos teñen a mesma importancia para o estudo.",
  },
  ELIGIBILITY: {
    heading: "Este estudo pode ser para min?",
    intro: "A elixibilidade confírmase co equipo. Aquí podes revisar os criterios aprobados e as preguntas máis frecuentes.",
    criteriaHeading: "Criterios de participación",
    criteriaItems: ["Ter unha enfermidade que ameaza a vida.", "Falar castelán."],
    criteriaText:
      "Na chamada co equipo revisaremos xuntos se o estudo encaixa contigo, segundo todos os criterios aprobados para o estudo.",
    criteria: ES.ELIGIBILITY.criteria,
    requiredLine: "Non se garanten beneficios persoais.",
    registry: ES.ELIGIBILITY.registry,
    investigator: ES.ELIGIBILITY.investigator,
    participantAlt:
      "Unha persoa sentada coas pernas cruzadas sobre unha alfombra tecida, cunhas gafas de realidade virtual e un mando en cada man; unha aura violeta envólvea e unha luz cálida brilla no centro do peito.",
    faq: [
      {
        id: "participar",
        topic: "Que implica participar",
        statements: [
          "O programa ten sete etapas: preparación, encontros por videochamada e sesións de realidade virtual. Explicarémosche a duración e o calendario antes de comezar.",
          "A participación é voluntaria.",
        ],
        pending: ES.ELIGIBILITY.faq[0].pending,
      },
      {
        id: "beneficios",
        topic: "Posibles beneficios e riscos",
        statements: [
          "Non se espera que obteñas ningún beneficio directo por participar no estudo. A participación é voluntaria e non será remunerada.",
          "A investigación pretende descubrir aspectos descoñecidos ou pouco claros sobre o potencial do uso da realidade virtual na saúde mental e no benestar en persoas con diagnóstico de enfermidade ameazante para a vida. Esta información poderá ser de utilidade nun futuro para outras persoas.",
          "Antes de decidir, o equipo explicarache con detalle os posibles beneficios, riscos e molestias.",
        ],
        pending: ES.ELIGIBILITY.faq[1].pending,
      },
      {
        id: "grupos",
        topic: "Que recibe cada grupo",
        statements: [
          "A asignación realízase ao azar. Non podes elixir o grupo.",
          "O grupo do programa participa en Clear Light. O grupo control recibe unha experiencia similar para poder comparar.",
        ],
        pending: ES.ELIGIBILITY.faq[2].pending,
      },
      {
        id: "gafas",
        topic: "Uso das gafas de realidade virtual",
        statements: [
          "Unha persoa do equipo entrégache as gafas na casa e explícache como usalas.",
          "Se tes dúbidas durante o estudo, o equipo axúdate.",
        ],
        pending: ES.ELIGIBILITY.faq[3].pending,
      },
      {
        id: "retirada",
        topic: "Participación voluntaria e retirada",
        statements: [
          "Podes facer preguntas antes de decidir.",
          "Podes deixar o estudo en calquera momento, sen ter que dar explicacións.",
        ],
        pending: ES.ELIGIBILITY.faq[4].pending,
      },
      {
        id: "datos",
        topic: "Confidencialidade e protección de datos",
        statements: [
          "Os teus datos persoais trataranse de forma confidencial e só para os fins do estudo.",
          "O equipo identifica cada participante cun código, non co seu nome. As respostas dos cuestionarios gárdanse en sistemas aprobados pola institución, separadas dos teus datos de contacto.",
          "Podes pedir acceder aos teus datos, corrixilos ou suprimilos, e retirar o teu consentimento en calquera momento. Atoparás os detalles na política de privacidade e na información de consentimento.",
        ],
        pending: ES.ELIGIBILITY.faq[5].pending,
      },
      {
        id: "contacto",
        topic: "Contacto e rexistro do estudo",
        statements: [
          "Cando completes o cuestionario, o equipo porase en contacto contigo.",
          "Publicaremos aquí o rexistro do estudo e os datos de contacto.",
        ],
        pending: ES.ELIGIBILITY.faq[6].pending,
      },
    ],
  },
  INVITATION: {
    heading: "Decide con toda a información.",
    support: "Amosar interese non equivale a dar consentimento.",
    qualtricsUrl: ES.INVITATION.qualtricsUrl,
    closed: "O cuestionario de interese non está dispoñible neste momento.",
    footer: {
      navLabel: "Pé de páxina",
      tagline: "Estudo de investigación sobre unha experiencia grupal de realidade virtual.",
      groups: [
        {
          heading: "O estudo",
          links: [
            { href: "#porque", label: "Información do estudo" },
            { href: "#elegibilidad", label: "Preguntas frecuentes" },
            { href: "#contacto", label: "Contacto" },
          ],
        },
        {
          heading: "Legal",
          links: [
            { href: "/aviso-legal", label: "Aviso legal e condicións de uso" },
            { href: "/privacidad", label: "Política de privacidade" },
            { href: "/cookies", label: "Política de cookies" },
          ],
        },
      ],
      cookieSettings: "Configurar cookies",
      still: { pause: "Pausar animación", resume: "Retomar animación" },
      note: "Material de recrutamento en preparación. A información definitiva publicarase tras a súa aprobación.",
      privacy: ES.INVITATION.footer.privacy,
      version: ES.INVITATION.footer.version,
    },
    arcAlt: "Un arco de seis corpos de luz azulada cun pequeno lume laranxa no centro, sobre fondo escuro.",
  },
  CONTACT: {
    title: "Contactar co equipo",
    intro: "Escríbenos se tes dúbidas sobre o estudo.",
    name: "Nome",
    email: "Correo electrónico",
    message: "Mensaxe",
    healthNote: "Por favor, non inclúas información sobre a túa saúde na mensaxe.",
    privacyBefore: "Usaremos estes datos só para responderche. Consulta a",
    privacyLink: "política de privacidade",
    submit: "Enviar mensaxe",
    close: "Pechar",
    unavailable: "O envío de mensaxes estará dispoñible proximamente. A túa mensaxe non se enviou nin se gardou.",
    destination: ES.CONTACT.destination,
  },
  CONSENT: {
    title: "Cookies e contido de terceiros",
    body: "Esta web só usa o almacenamento técnico necesario para funcionar. Se o aceptas, tamén poderemos cargar o vídeo de YouTube, que pode gardar datos no teu navegador.",
    accept: "Aceptar",
    reject: "Rexeitar",
    policy: "Política de cookies",
    filmBlocked: "Para ver o vídeo, acepta o contido de YouTube.",
    filmAccept: "Aceptar e reproducir",
  },
  META: {
    title: "aNUma Clear Light · Estudo de investigación",
    description:
      "Estudo de investigación con asignación ao azar sobre unha experiencia grupal de realidade virtual. Información pública para persoas interesadas.",
  },
  LANGUAGE: {
    label: "Idioma",
  },
  HOLDING: {
    title: "Sitio en preparación",
    body: "A información pública do estudo publicarase cando estea aprobada.",
  },
};
