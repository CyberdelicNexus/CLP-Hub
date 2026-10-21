/**
 * The 24 participant messages for the real CLP study, from the team's
 * "Clear Light RCT · Mensajes a participantes". Written by
 * scripts/seed-session-materials.ts as communication templates.
 *
 * How the doc's [brackets] became placeholders (the closed list in
 * src/domain/communication.ts):
 * - [nombre] → {{nombre}}; [fecha y hora] → {{fecha}} {{hora}};
 *   [nombre de la persona del equipo] → {{responsable}}.
 * - The one link that changes per cohort (Zoom, the WhatsApp group, a
 *   Qualtrics questionnaire) → {{enlace}}.
 * - Free-form gaps (a list of dates, a choice of visit times, how the
 *   headsets are collected) → {{instrucciones}}, typed in at send time.
 * - Links to the session pages never change, so they are written out in
 *   full rather than left as a placeholder.
 *
 * Group messages (WhatsApp grupal) are COHORT_CHANNEL templates, which may not
 * name anyone (D-041) — none of them do.
 *
 * Email templates: the template's name is the email's subject (D-116), so it
 * holds the doc's "Asunto" line. Bodies are plain text: an email renders
 * blank-line paragraphs and makes https links clickable, nothing more.
 */
import type {
  CommunicationAudience,
  CommunicationChannel,
  CommunicationStage,
} from "@/domain/communication";
import { STUDY_EMAIL } from "./pages";

const PAGES = "https://numadelic.org/clearlight/estudio/sesiones";
const page = (session: string, part: "preparacion" | "integracion") => `${PAGES}/${session}/${part}`;

const QUESTIONNAIRE_STEPS = [
  "1. Antes de poneros las gafas, abrid el enlace y responded la primera parte.",
  "2. Dejadlo abierto mientras hacéis la sesión de realidad virtual.",
  "3. Al terminar la sesión, responded la segunda parte.",
].join("\n");

const CONTROL_REWARD_REMINDER =
  "Recuerda que, si contestas los cuestionarios, más adelante podrás recibir un informe personal con tus resultados y acceso a la experiencia de realidad virtual de Clear Light.";

export interface MessageTemplate {
  key: string;
  stage: CommunicationStage;
  channel: CommunicationChannel;
  audience: CommunicationAudience;
  /** session_templates.code, or null for a message not about one session. */
  sessionCode: string | null;
  nameEs: string;
  bodyEs: string;
}

const lines = (...parts: string[]) => parts.join("\n\n");

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // ─── Evaluación ───────────────────────────────────────────────────────────
  {
    key: "m01-evaluacion-positiva",
    stage: "ELIGIBILITY_CONFIRMED",
    channel: "EMAIL",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "Clear Light: cumples los criterios para participar en el estudio",
    bodyEs: lines(
      "Hola, {{nombre}}:",
      "Gracias por tu interés en Clear Light. Hemos revisado tu solicitud y nos alegra decirte que cumples todos los criterios requeridos para participar en el estudio.",
      "En los próximos días nos pondremos en contacto contigo para darte más información y detalles sobre tu participación.",
      `Si tienes cualquier duda, escríbenos a ${STUDY_EMAIL} o responde a este mensaje.`,
      "Un saludo,\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m02-evaluacion-negativa",
    stage: "ELIGIBILITY_CONFIRMED",
    channel: "EMAIL",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "Clear Light: respuesta a tu solicitud",
    bodyEs: lines(
      "Hola, {{nombre}}:",
      "Muchas gracias por tu interés en Clear Light y por el tiempo y la confianza que has puesto en tu solicitud.",
      "La hemos revisado con mucho cuidado y creemos que, en este momento, el estudio no se ajusta a tu situación. Por eso, lamentamos decirte que esta vez no podrás participar.",
      "Sabemos que quizá esperabas otra respuesta, y te agradecemos de corazón que quisieras formar parte de este proyecto. Si tienes cualquier pregunta o quieres hablar con nosotros, aquí estamos.",
      "Un abrazo,\nEl equipo de Clear Light",
    ),
  },

  // ─── Grupo control (email) ────────────────────────────────────────────────
  {
    key: "m03-asignacion-control",
    stage: "INITIAL_SESSION_SCHEDULING",
    channel: "EMAIL",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "Clear Light: tu grupo en el estudio",
    bodyEs: lines(
      "Hola, {{nombre}}:",
      "Gracias por firmar el consentimiento. Te escribimos para contarte que, por sorteo, formas parte del grupo control del estudio.",
      "Tu participación consiste en responder unos cuestionarios en línea en tres momentos:\n{{instrucciones}}",
      "Te enviaremos cada enlace por aquí en su momento. Tu papel es fundamental: sin el grupo control no podríamos saber si el programa funciona de verdad.",
      "Y tu participación tiene recompensa. Si al terminar has respondido a más del 85 % de los cuestionarios que te enviemos, recibirás:",
      "• Un informe personal con todos tus resultados. Podrás ver de forma clara cómo están tu bienestar emocional y tu salud mental, a partir de todos los datos que recojamos durante el estudio.\n• Acceso a la experiencia de realidad virtual de Clear Light. Podrás vivir en primera persona la experiencia que estamos investigando, una oportunidad que muy pocas personas tienen.",
      "Más adelante te daremos todos los detalles. ¡Gracias por formar parte de esta investigación!",
      "Un saludo,\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m04-cuestionario-pre-control",
    stage: "FOLLOW_UP",
    channel: "EMAIL",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "Clear Light: primer cuestionario",
    bodyEs: lines(
      "Hola, {{nombre}}:",
      "Somos el equipo del estudio de investigación Clear Light. Tal como te habíamos informado, necesitamos que respondas el primer cuestionario del estudio. No te llevará más de 20 minutos: {{enlace}}",
      "Te pedimos, por favor, que lo respondas lo antes posible. Si tienes cualquier problema con el enlace, escríbenos.",
      CONTROL_REWARD_REMINDER,
      "Gracias,\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m05-cuestionario-post-control",
    stage: "FOLLOW_UP",
    channel: "EMAIL",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "Clear Light: segundo cuestionario",
    bodyEs: lines(
      "Hola, {{nombre}}:",
      "Somos el equipo del estudio de investigación Clear Light. Tal como te habíamos informado, necesitamos que respondas el segundo cuestionario del estudio. No te llevará más de 20 minutos: {{enlace}}",
      "Te pedimos, por favor, que lo respondas lo antes posible. Gracias por seguir con nosotros.",
      CONTROL_REWARD_REMINDER,
      "Un saludo,\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m06-cuestionario-3m-control",
    stage: "CLOSING",
    channel: "EMAIL",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "Clear Light: último cuestionario",
    bodyEs: lines(
      "Hola, {{nombre}}:",
      "Somos el equipo del estudio de investigación Clear Light. Tal como te habíamos informado, necesitamos que respondas el último cuestionario del estudio. No te llevará más de 20 minutos: {{enlace}}",
      "Te pedimos, por favor, que lo respondas lo antes posible. Con este cuestionario terminas tu participación.",
      CONTROL_REWARD_REMINDER,
      "Muchas gracias por acompañarnos durante todo este tiempo.",
      "Un saludo,\nEl equipo de Clear Light",
    ),
  },

  // ─── Grupo oficial: mensajes privados ─────────────────────────────────────
  {
    key: "m07-asignacion-programa",
    stage: "INITIAL_SESSION_SCHEDULING",
    channel: "WHATSAPP",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "07 · Asignación al grupo del programa",
    bodyEs: lines(
      "¡Hola, {{nombre}}! Gracias por firmar el consentimiento. Te escribimos para contarte que, por sorteo, formas parte del *grupo que hará el programa Clear Light*.",
      "El programa tiene 7 encuentros:\n• Sesión 0: visita a tu casa para entregarte las gafas de realidad virtual.\n• Sesiones 1 y 6: encuentros en grupo por Zoom.\n• Sesiones 2 a 5: sesiones en grupo con las gafas, desde tu casa.",
      "Aquí tienes el calendario: {{instrucciones}}\nEn unos días te escribiremos para quedar para la visita.",
      "Cualquier duda, escríbenos por aquí.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m08-s0-una-semana-antes",
    stage: "INITIAL_SESSION_SCHEDULING",
    channel: "WHATSAPP",
    audience: "PARTICIPANT",
    sessionCode: "s0",
    nameEs: "08 · S0: una semana antes (quedar para la visita)",
    bodyEs: lines(
      "¡Hola, {{nombre}}! Queremos quedar contigo para llevarte las gafas de realidad virtual y hacer juntos la primera sesión en tu casa. La visita durará como máximo una hora y media.",
      "¿Te viene bien alguno de estos días? {{instrucciones}}",
      "Si puede estar contigo la persona que te acompañe, mejor.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m09-s0-un-dia-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "PARTICIPANT",
    sessionCode: "s0",
    nameEs: "09 · S0: un día antes",
    bodyEs: lines(
      "¡Hola, {{nombre}}! Te recordamos que mañana, {{fecha}} a las {{hora}}, vamos a tu casa. Irá {{responsable}}.",
      "Para ese día, solo necesitas:\n• Un asiento cómodo con espacio para mover los brazos.\n• Tus gafas graduadas, si las usas.\n• Un rato tranquilo, sin interrupciones.",
      `Aquí tienes una guía breve de la visita: ${page("s0", "preparacion")}\n¡Hasta mañana!`,
      "El equipo de Clear Light",
    ),
  },
  {
    key: "m10-s0-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "PARTICIPANT",
    sessionCode: "s0",
    nameEs: "10 · S0: después de la visita",
    bodyEs: lines(
      "Gracias por recibirnos hoy, {{nombre}}. Ya tienes las gafas en casa.",
      "Próximos pasos:\n• Únete al grupo de WhatsApp del programa: {{enlace}}\n• La sesión 1 será por Zoom el {{fecha}} a las {{hora}}; te mandaremos el enlace el día antes.\n• Guarda las gafas en su caja y cárgalas la noche antes de cada sesión.",
      `Aquí tienes una página con todo esto y una práctica breve: ${page("s0", "integracion")}\nCualquier duda, escríbenos.`,
      "El equipo de Clear Light",
    ),
  },

  // ─── Grupo oficial: grupo de WhatsApp ─────────────────────────────────────
  {
    key: "m11-s1-dia-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s1",
    nameEs: "11 · S1 Orientación: el día antes (grupo)",
    bodyEs: lines(
      "¡Hola a todo el grupo! Mañana, {{fecha}} a las {{hora}}, tenemos el primer encuentro, por Zoom y todavía sin gafas. Nos presentaremos y veremos juntos cómo será el programa.",
      `• Enlace de Zoom: {{enlace}}\n• Cómo prepararos: ${page("s1", "preparacion")}`,
      "Os recomendamos conectaros unos minutos antes. ¡Nos vemos!\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m12-s1-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s1",
    nameEs: "12 · S1 Orientación: después (grupo, 1 a 3 h)",
    bodyEs: lines(
      `Gracias a todo el grupo por el encuentro de hoy. Os dejamos una página con una práctica breve y unas preguntas, por si os apetece escribir sobre lo vivido: ${page("s1", "integracion")}`,
      "Si queréis, podéis compartir una frase en el grupo, siempre desde vuestra propia experiencia.",
      "El equipo de Clear Light",
    ),
  },
  {
    key: "m13-s2-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s2",
    nameEs: "13 · S2 Cuerpos de Luz: antes (grupo)",
    bodyEs: lines(
      "¡Hola a todo el grupo! El {{fecha}} a las {{hora}} tenemos la primera sesión juntos con las gafas de realidad virtual.",
      `• Cómo prepararos: ${page("s2", "preparacion")}\n• Cuestionario breve del estudio (no más de 5 minutos): {{enlace}}\nTiene dos partes y un único enlace:\n${QUESTIONNAIRE_STEPS}`,
      "Acordaos de cargar las gafas y los mandos.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m14-s2-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s2",
    nameEs: "14 · S2 Cuerpos de Luz: después (grupo, 1 a 3 h)",
    bodyEs: lines(
      `Gracias a todo el grupo por este primer encuentro con las gafas. Antes de seguir con el día, tomaos un momento para volver a la habitación. Aquí tenéis una práctica breve y unas preguntas: ${page("s2", "integracion")}`,
      "Si no llegasteis a responder la segunda parte del cuestionario, escribidnos y os ayudamos.",
      "El equipo de Clear Light",
    ),
  },
  {
    key: "m15-s3-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s3",
    nameEs: "15 · S3 Vida: antes (grupo)",
    bodyEs: lines(
      "¡Hola a todo el grupo! El {{fecha}} a las {{hora}} tenemos la sesión Vida, para mirar distintas etapas de nuestra vida con cariño. Cada persona elige qué recuerdos acercar.",
      `• Cómo prepararos: ${page("s3", "preparacion")}\n• Cuestionario breve del estudio (no más de 5 minutos): {{enlace}}\nRecordad cómo funciona:\n${QUESTIONNAIRE_STEPS}`,
      "Acordaos de cargar las gafas.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m16-s3-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s3",
    nameEs: "16 · S3 Vida: después (grupo, 1 a 3 h)",
    bodyEs: lines(
      `Gracias a todo el grupo por estar hoy en Vida. Os hemos preparado una forma sencilla de volver al presente y escribir solo lo que queráis guardar: ${page("s3", "integracion")}`,
      "Si no llegasteis a responder la segunda parte del cuestionario, escribidnos y os ayudamos.",
      "Cuidaos mucho hoy.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m17-s4-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s4",
    nameEs: "17 · S4 Más allá del cuerpo: antes (grupo)",
    bodyEs: lines(
      "¡Hola a todo el grupo! El {{fecha}} a las {{hora}} tenemos la sesión Más allá del cuerpo. Es una sesión intensa, con imágenes relacionadas con la muerte, y podéis ir a vuestro ritmo y hacer una pausa siempre que lo necesitéis.",
      `• Cómo prepararos: ${page("s4", "preparacion")}\n• Cuestionario breve del estudio (no más de 5 minutos): {{enlace}}\nRecordad cómo funciona:\n${QUESTIONNAIRE_STEPS}`,
      "Os recomendamos reservaros un rato tranquilo después de la sesión.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m18-s4-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s4",
    nameEs: "18 · S4 Más allá del cuerpo: después (grupo, 1 a 3 h)",
    bodyEs: lines(
      `Gracias a todo el grupo por la sesión de hoy. Después de algo tan intenso, lo primero es volver a lo cercano. Aquí tenéis una práctica para situaros y algunas preguntas opcionales: ${page("s4", "integracion")}`,
      "Si no llegasteis a responder la segunda parte del cuestionario, escribidnos y os ayudamos.",
      "Si algo os ha removido y queréis hablarlo, escribidnos por privado.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m19-s5-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s5",
    nameEs: "19 · S5 Ofrenda: antes (grupo)",
    bodyEs: lines(
      "¡Hola a todo el grupo! El {{fecha}} a las {{hora}} tenemos Ofrenda, nuestra última sesión con las gafas. Basta con una palabra para participar, y el silencio también es bienvenido.",
      `• Cómo prepararos: ${page("s5", "preparacion")}`,
      "Acordaos de cargar las gafas.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m20-s5-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s5",
    nameEs: "20 · S5 Ofrenda: después (grupo, 1 a 3 h)",
    bodyEs: lines(
      `Gracias a todo el grupo por lo compartido hoy. En esta página tenéis unas preguntas y un gesto pequeño para cuidar la cualidad que elegisteis: ${page("s5", "integracion")}`,
      "No hace falta contar en el grupo lo que decidisteis soltar.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m21-s6-antes",
    stage: "SESSION_REMINDER",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s6",
    nameEs: "21 · S6 Integración grupal: antes (grupo)",
    bodyEs: lines(
      "¡Hola a todo el grupo! El {{fecha}} a las {{hora}} tenemos nuestro último encuentro, por Zoom y sin gafas.",
      `• Enlace de Zoom: {{enlace}}\n• Cómo prepararos: ${page("s6", "preparacion")}`,
      "Sobre las gafas: {{instrucciones}}\n¡Nos vemos en el último encuentro!\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m22-s6-despues",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "COHORT_CHANNEL",
    sessionCode: "s6",
    nameEs: "22 · S6 Integración grupal: después (grupo, 1 a 3 h)",
    bodyEs: lines(
      `Gracias a todo el grupo por recorrer este camino juntos. Os dejamos las prácticas, preguntas y recursos para los próximos días: ${page("s6", "integracion")}`,
      "En unos días os escribiremos por privado para quedar para la última visita. Si os apetece, compartid una frase de cierre en el grupo.",
      "El equipo de Clear Light",
    ),
  },

  // ─── Grupo oficial: cierre (privado) ──────────────────────────────────────
  {
    key: "m23-visita-post",
    stage: "FOLLOW_UP",
    channel: "WHATSAPP",
    audience: "PARTICIPANT",
    sessionCode: "s6",
    nameEs: "23 · Visita POST: una semana después de S6",
    bodyEs: lines(
      "¡Hola, {{nombre}}! Para terminar el programa, queremos pasar por tu casa para hacer el último cuestionario, tomar unas medidas fisiológicas y recoger las gafas. La visita durará como máximo una hora y media.",
      "¿Te viene bien alguno de estos días? {{instrucciones}}",
      "Gracias por todo lo que has compartido en este camino.\nEl equipo de Clear Light",
    ),
  },
  {
    key: "m24-tres-meses-programa",
    stage: "CLOSING",
    channel: "WHATSAPP",
    audience: "PARTICIPANT",
    sessionCode: null,
    nameEs: "24 · A los 3 meses (grupo del programa)",
    bodyEs: lines(
      "¡Hola, {{nombre}}! Han pasado tres meses desde que terminamos el programa Clear Light, y nos acordamos mucho de este camino que hemos recorrido juntos.",
      "Te pedimos un último favor: responder este cuestionario, que lleva unos 20 minutos: {{enlace}}\nTe pedimos, por favor, que lo respondas lo antes posible.",
      "Con este cuestionario termina tu participación en el estudio. Muchísimas gracias por tu confianza, tu tiempo y todo lo que has compartido. Ha sido un placer vivir esta experiencia contigo, y tu participación nos ayuda a que este programa pueda llegar a muchas más personas.",
      "Un abrazo muy fuerte,\nEl equipo de Clear Light",
    ),
  },
];
