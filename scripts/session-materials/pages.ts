/**
 * The fourteen session pages (S0–S6, preparación + integración) for the real
 * CLP study, from the team's "Materiales de preparación e integración ·
 * Borrador consolidado v3" (2026-10-02). Written by
 * scripts/seed-session-materials.ts as published content versions.
 *
 * Study content, not UI strings (CLAUDE.md rule 7): this file only seeds the
 * database once. After that the pages are edited in the Hub (Contenido), and
 * re-running the script would publish this text over those edits.
 *
 * Pages carry nothing cohort-specific (D-003): no dates, no Zoom links, no
 * WhatsApp group links. Those travel in the WhatsApp messages
 * (./messages.ts), which point back here.
 */
import type { ContentBlock } from "@/domain/content";
import {
  markdownAstToRichTextDoc,
  plainTextToRichTextDoc,
  type RichTextDoc,
} from "@/domain/rich-text";

export const STUDY_EMAIL = "info@numadelic.org";

type DocNode = RichTextDoc["content"][number];

function heading(level: 2 | 3, text: string): DocNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function mdNodes(md: string): DocNode[] {
  return markdownAstToRichTextDoc(md).content;
}

function text(md: string): ContentBlock {
  return { type: "TEXT", align: "left", content: { type: "doc", content: mdNodes(md) } };
}

/** A heading with optional body text, as one TEXT block. */
function section(title: string, md?: string, level: 2 | 3 = 2): ContentBlock {
  const nodes = [heading(level, title), ...(md ? mdNodes(md) : [])];
  return { type: "TEXT", align: "left", content: { type: "doc", content: nodes } };
}

function steps(items: [title: string, md: string][]): ContentBlock[] {
  return items.map(([title, md], i) => ({
    type: "TECHNICAL_STEP",
    step: i + 1,
    color: "chart-1",
    titleContent: plainTextToRichTextDoc(title),
    ...(md ? { content: markdownAstToRichTextDoc(md) } : {}),
  }));
}

function checklist(title: string, items: string[]): ContentBlock {
  return { type: "CHECKLIST", title, items };
}

function callout(tone: "INFO" | "WARNING" | "SUPPORT", title: string, md: string): ContentBlock {
  return { type: "CALLOUT", tone, title, content: markdownAstToRichTextDoc(md) };
}

function contemplation(md: string): ContentBlock {
  return { type: "CONTEMPLATION", content: markdownAstToRichTextDoc(md) };
}

function bookmark(url: string, title: string, description: string): ContentBlock {
  return { type: "BOOKMARK", url, title, description, align: "left" };
}

function video(url: string, caption: string): ContentBlock {
  return { type: "VIDEO", url, caption, align: "left" };
}

function divider(): ContentBlock {
  return { type: "DIVIDER", style: "solid", thickness: "thin", color: "default" };
}

/**
 * The closing "write to us" box. The doc asks for a WhatsApp button, but the
 * study has no public WhatsApp number yet, so the box tells people to answer
 * any of the team's WhatsApp messages and links the email address.
 */
function contact(title: string, md: string): ContentBlock {
  return {
    type: "SUPPORT_BOX",
    title,
    content: markdownAstToRichTextDoc(
      `${md}\n\nPuedes responder a cualquiera de nuestros mensajes de WhatsApp o escribirnos a ${STUDY_EMAIL}.`,
    ),
    contactLabel: `Escribir a ${STUDY_EMAIL}`,
    contactUrl: `mailto:${STUDY_EMAIL}`,
  };
}

function signoff(line: string): ContentBlock {
  return text(`*${line}*`);
}

export interface SessionPage {
  /** session_templates.code, and the URL segment. */
  sessionCode: string;
  part: "preparacion" | "integracion";
  title: string;
  body: ContentBlock[];
}

export const SESSION_PAGES: SessionPage[] = [
  // ─── S0 · Preparación (visita en casa) ────────────────────────────────────
  {
    sessionCode: "s0",
    part: "preparacion",
    title: "Qué preparar para nuestra visita",
    body: [
      section(
        "¡Te damos la bienvenida a Clear Light!",
        "En los próximos días iremos a tu casa para darte las gafas de realidad virtual, enseñarte a usarlas con calma y resolver tus dudas antes de empezar. No necesitas saber nada de tecnología: te acompañaremos en cada paso, a ti y a quien esté contigo. Sin prisa y sin expectativas.",
      ),
      callout("INFO", "Datos de la visita", "- **Duración aproximada:** 2 horas."),
      section("Qué haremos en la visita"),
      ...steps([
        ["Te llevamos el equipo", "Las gafas llegan configuradas, limpias y listas para usar."],
        [
          "Ajustamos las gafas y vemos los mandos",
          "Te enseñamos a ponértelas sin presión. Si usas gafas graduadas o tienes movilidad reducida, adaptamos el equipo para que estés cómodo o cómoda.",
        ],
        [
          "Una primera experiencia guiada",
          "Durante unos minutos, con alguien del equipo a tu lado, te irás familiarizando con la imagen, el sonido, la luz y el movimiento. También probaremos un gesto sencillo con las manos que te acompañará durante el programa.",
        ],
        [
          "Cuestionarios del estudio",
          "Rellenaremos juntos algunas preguntas que forman parte de la investigación. Esta parte no te llevará más de 20 minutos.",
        ],
        [
          "Tus dudas",
          "Tendremos todo el tiempo que haga falta para tus preguntas, técnicas o sobre cómo será el programa.",
        ],
      ]),
      text("Puedes pedir una pausa, preguntar o parar cuando quieras."),
      divider(),
      section(
        "Cómo preparar el espacio",
        [
          "- **Un sitio cómodo para sentarte:** un sillón, un sofá o una silla que te sujete bien la espalda y, si puede ser, la cabeza, con algo de espacio alrededor para mover los brazos.",
          "- **Tus gafas graduadas,** si las usas (de cerca o de lejos), para ajustar bien las gafas de realidad virtual.",
          "- **Un rato tranquilo,** sin interrupciones ni llamadas urgentes.",
        ].join("\n"),
      ),
      section("Si te apetece: tres puntos de apoyo (2 minutos)", undefined, 3),
      contemplation(
        "Nota el contacto de los pies con el suelo, del cuerpo con el asiento y de una mano con la otra. Echa un vistazo a tu alrededor. ¿Hay algo que puedas ajustar para estar un poco más a gusto? No hace falta cambiar la respiración.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- ¿Qué me ayuda a sentirme a gusto cuando pruebo algo nuevo?",
          "- ¿Cómo prefiero avisar cuando necesito una pausa o ayuda?",
        ].join("\n"),
        3,
      ),
      contact(
        "¿Tienes alguna duda antes de vernos?",
        "Si necesitas cambiar la hora de la visita, preguntar algo sobre accesibilidad o cualquier otra cosa, escríbenos.",
      ),
      signoff("Hasta pronto, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s0",
    part: "integracion",
    title: "El viaje comienza",
    body: [
      section(
        "Gracias por abrirnos las puertas de tu casa.",
        "Hoy hemos dejado contigo las gafas de realidad virtual, hemos probado juntos cómo ponértelas y usar los mandos, y has hecho tu primera experiencia guiada. Gracias por tu tiempo y por confiar en este proceso. Las gafas son una herramienta para explorar, a tu ritmo y en compañía, la presencia y la conexión durante las próximas semanas.",
      ),
      section(
        "Volver al cuerpo (2 minutos)",
        "Después de una primera vez con las gafas es normal notar algo de cansancio, curiosidad o simplemente nada en especial.",
        3,
      ),
      contemplation(
        "Si te apetece, busca tres objetos en la habitación y nota el peso del cuerpo sobre el asiento. Puedes repetir solo la parte que te venga bien.",
      ),
      section(
        "Para tu diario (5 minutos, opcional)",
        [
          "- ¿En qué momento me sentí más cómodo o cómoda?",
          "- ¿Qué movimiento, imagen o sensación me despertó curiosidad?",
          "- ¿Qué necesito para llegar con tranquilidad al primer encuentro en grupo?",
        ].join("\n"),
        3,
      ),
      section(
        "Un gesto para el día a día",
        "Repite una vez, sin gafas, el gesto que probamos: las manos se abren al espirar, como si abrieras dos puertas desde el pecho, y vuelven al inspirar. O, simplemente, apoya un momento las manos en el pecho.",
        3,
      ),
      divider(),
      section("Próximos pasos"),
      ...steps([
        [
          "Únete al grupo de WhatsApp",
          "Lo usaremos para organizar las sesiones, resolver dudas rápidas y enviar recordatorios. Te mandamos el enlace para unirte por WhatsApp.",
        ],
        [
          "Confirma la cita",
          "Te llegará por el grupo de WhatsApp la invitación a la sesión de Orientación, por Zoom.",
        ],
        [
          "Piensa en el espacio",
          "Busca un sitio tranquilo y cómodo desde el que conectarte a Zoom, si puede ser junto a quien te acompañe.",
        ],
        [
          "Cuida las gafas",
          "Guárdalas en su caja, en un sitio seco y lejos del sol directo, porque la luz del sol puede dañar las lentes. Cárgalas con el cargador que te dejamos la noche antes de cada sesión, y si algo no funciona, escríbenos por WhatsApp.",
        ],
      ]),
      callout(
        "INFO",
        "Importante",
        "En Orientación **todavía no entraremos en la realidad virtual**. Será una conversación para conocernos, ver el mapa del recorrido y responder las preguntas que te hayan surgido. Unos días antes te enviaremos su página de preparación.",
      ),
      section("Si quieres seguir explorando (opcional)", undefined, 3),
      video(
        "https://www.youtube.com/watch?v=1ZOWbjE9JAU",
        "Mindfulness para vivir sin prisas, Jon Kabat-Zinn (Editorial Kairós). Una introducción muy accesible a la atención en el día a día. No forma parte del programa ni hace falta verlo antes de Orientación.",
      ),
      contact("¿Alguna duda?", "Si tienes cualquier duda, por pequeña que sea, escríbenos."),
      signoff("Un abrazo, el equipo de Clear Light"),
    ],
  },

  // ─── S1 · Orientación (Zoom) ──────────────────────────────────────────────
  {
    sessionCode: "s1",
    part: "preparacion",
    title: "Nos conocemos como grupo",
    body: [
      section(
        "Hola, ¡ya casi empezamos!",
        "La Sesión 1, Orientación, es nuestro primer encuentro como grupo. Será por Zoom, todavía sin gafas. Nos presentaremos, hablaremos de lo que nos trae aquí y de nuestra relación con la muerte, y repasaremos juntos el mapa del recorrido y las dudas que tengas. No tienes que sentirte de ninguna manera concreta para participar: puedes hablar poco, hablar mucho o pasar.",
      ),
      callout(
        "INFO",
        "Datos del encuentro",
        "- **Duración:** 1 hora.\n- **Dónde:** por Zoom. El enlace te llega por el grupo de WhatsApp el día antes.",
      ),
      checklist("Para tenerlo listo", [
        "Un sitio tranquilo y con algo de privacidad, si puede ser junto a quien te acompañe.",
        "El ordenador o la tableta cargados y el enlace de Zoom a mano.",
        "Auriculares, si te ayudan a escuchar mejor.",
        "Conectarte unos minutos antes, por si hay que ajustar el sonido o la cámara.",
      ]),
      section("Práctica: llegar como estás (3 minutos)", undefined, 3),
      contemplation(
        "Antes de conectarte, nota el asiento, el espacio a tu alrededor y cómo estás ahora mismo, sin cambiar nada. Antes de terminar, recuerda: no tienes que sentirte de ninguna manera concreta para participar.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- Si tuviera que describir cómo llego hoy en tres palabras, ¿cuáles serían?",
          "- ¿Qué necesito para escuchar y compartir a mi ritmo?",
          "- *Si te apetece ir un poco más allá:* ¿qué pregunta sobre la muerte o lo desconocido me acompaña hoy?",
        ].join("\n"),
        3,
      ),
      section("Para explorar (opcional)", undefined, 3),
      video(
        "https://www.youtube.com/watch?v=lv_QYmUzlkM",
        "Hablar de la muerte para vivir y morir mejor, Montse Esquerda. Una charla cercana que invita a abrir conversaciones sobre la muerte. Incluye referencias directas a la enfermedad y la muerte.",
      ),
      contact("¿Problemas con Zoom o alguna duda?", "Escríbenos y te ayudamos."),
      signoff("Nos vemos muy pronto, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s1",
    part: "integracion",
    title: "Lo que te llevas del primer encuentro",
    body: [
      section(
        "Gracias por estar hoy.",
        "En nuestro primer encuentro nos hemos presentado, hemos empezado a hablar de nuestra relación con la muerte y hemos visto juntos el mapa del recorrido. Gracias por tu presencia, tu escucha y lo que hayas querido compartir. Una conversación así puede seguir dándote vueltas horas después de apagar la pantalla. Antes de darle sentido, fíjate en cómo estás y qué necesitas ahora.",
      ),
      section("Volver al presente (2 minutos)", undefined, 3),
      contemplation(
        "Echa un vistazo alrededor. Fíjate en la temperatura y en los sonidos de la habitación. Bebe un poco de agua, si te apetece.",
      ),
      section(
        "Para tu diario",
        [
          "- ¿Qué frase o qué silencio se me ha quedado?",
          "- ¿Qué me resultó fácil y qué me costó al escuchar?",
          "- ¿Cómo me gustaría cuidarme entre un encuentro y otro?",
        ].join("\n"),
        3,
      ),
      section(
        "Un gesto para el día a día",
        "Resérvate cinco minutos de calma en algún momento de la semana. Si te surge una pregunta, apúntala, sin necesidad de responderla.",
        3,
      ),
      section(
        "Si te apetece compartir",
        "Puedes escribir en el grupo de WhatsApp «Me quedo con...» en una frase. Habla siempre desde tu experiencia y no cuentes lo que compartió otra persona.",
        3,
      ),
      callout(
        "INFO",
        "Lo que viene ahora",
        "La próxima sesión es **Cuerpos de Luz**, nuestro primer encuentro en grupo dentro de la realidad virtual. Te confirmaremos la fecha y la hora por WhatsApp, y unos días antes te enviaremos su página de preparación. Mientras tanto, mantén las gafas cargadas.",
      ),
      section("Para profundizar (opcional)", undefined, 3),
      bookmark(
        "https://www.rtve.es/play/videos/para-todos-la-2/entrevista-montse-esquerda/6541718/",
        "Entrevista a Montse Esquerda en «Para todos La 2» (RTVE, 10 min)",
        "Una mirada tranquila y reflexiva sobre el final de la vida.",
      ),
      contact(
        "¿Quieres hablarlo?",
        "Si algo de lo que se habló hoy te ha removido y quieres comentarlo, escríbenos.",
      ),
      signoff("Un abrazo, el equipo de Clear Light"),
    ],
  },

  // ─── S2 · Cuerpos de Luz (RV) ─────────────────────────────────────────────
  {
    sessionCode: "s2",
    part: "preparacion",
    title: "Tu primera sesión en grupo en realidad virtual",
    body: [
      section(
        "Hola, llega el momento de ponerse las gafas en grupo.",
        "Cuerpos de Luz es nuestra primera sesión juntos en realidad virtual. Conocerás tu forma de luz y las del resto del grupo, compartiremos una intención y exploraremos qué se siente al respirar, dar y recibir en este espacio compartido. También habrá momentos de escucha por parejas. Puedes pedir una pausa siempre que lo necesites.",
      ),
      callout(
        "INFO",
        "Datos de la sesión",
        "- **Duración:** 1 hora.\n- **Dónde:** en tu casa, con las gafas de realidad virtual.",
      ),
      checklist("Antes de entrar", [
        "Tengo las gafas y los mandos cargados.",
        "Tengo un asiento cómodo con espacio para mover los brazos.",
        "Sé cómo entrar en la sesión y cómo volver a entrar si se corta la conexión.",
        "Sé a quién avisar si algo no funciona.",
      ]),
      section("Práctica: movimiento y atención (3 minutos)", undefined, 3),
      contemplation(
        "Mueve una mano despacio. Fíjate en lo que pasa en el hombro, el pecho o la tripa. Luego déjala descansar. ¿Qué cambia cuando prestas atención al movimiento? Quedarse quieto también cuenta.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- ¿Qué me gustaría recibir de esta experiencia?",
          "- ¿Qué puedo aportar al grupo sin exigirme más de lo que tengo hoy?",
        ].join("\n"),
        3,
      ),
      contact(
        "Si algo no funciona",
        "Si algo no funciona el día de la sesión, escríbenos y te ayudamos.",
      ),
      signoff("Nos vemos dentro, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s2",
    part: "integracion",
    title: "Lo que sigue presente",
    body: [
      section(
        "Gracias por este primer encuentro en la luz.",
        "Hoy nos hemos visto por primera vez como formas de luz, hemos compartido una intención, hemos respirado juntos y hemos practicado dar, recibir y escuchar por parejas. Puede que la experiencia haya sido cálida, rara, neutra o un poco de todo. Cualquier forma de vivirla vale.",
      ),
      section("Volver al cuerpo", undefined, 3),
      contemplation(
        "Si acabas de quitarte las gafas, espera un momento antes de levantarte. Nota cómo te sujeta el asiento y fija la mirada en algo estable de la habitación.",
      ),
      section(
        "Para tu diario",
        [
          "- ¿Hubo un momento en que me sentí acompañado o acompañada?",
          "- ¿Qué noté al ofrecer, al recibir o al escuchar?",
          "- ¿Qué cambió cuando escuché sin estar preparando una respuesta?",
        ].join("\n"),
        3,
      ),
      section(
        "Un gesto para el día a día",
        "Escucha a alguien durante dos minutos sin preparar una respuesta. Si no puede ser, escucha durante dos minutos los sonidos de tu alrededor.",
        3,
      ),
      section("Si te apetece compartir", "Una palabra en el grupo sobre lo que sigue presente.", 3),
      callout(
        "INFO",
        "Lo que viene ahora",
        "La próxima sesión es **Vida**, también en realidad virtual. Te confirmaremos la fecha y la hora por WhatsApp, y unos días antes te enviaremos su página de preparación.",
      ),
      section("Para leer (opcional)", undefined, 3),
      bookmark(
        "https://mediahub.fundacionlacaixa.org/es/social/programas-sociales/personas-mayores/2026-03-23/personas-mayores-talleres-duelo-escuchar-cuidar-8063.html",
        "Personas mayores ante el duelo: escuchar para cuidar (Fundación «la Caixa»)",
        "Una reflexión sobre el valor de escuchar sin invadir, a partir de talleres de duelo con personas mayores.",
      ),
      contact(
        "¿Cómo te encuentras?",
        "Si notas mareo, cansancio o cualquier cosa que quieras comentarnos, escríbenos.",
      ),
      signoff("Un abrazo, el equipo de Clear Light"),
    ],
  },

  // ─── S3 · Vida (RV) ───────────────────────────────────────────────────────
  {
    sessionCode: "s3",
    part: "preparacion",
    title: "Mirar tu historia con amabilidad",
    body: [
      section(
        "Hola, se acerca la sesión Vida.",
        "En esta sesión de realidad virtual recorreremos distintas etapas de la vida: momentos significativos, luminosos y difíciles, y la forma en que podemos mirarlos hoy con más cariño. Tú eliges qué recuerdos acercar y cuáles prefieres dejar descansar. Al final volveremos juntos al grupo.\n\n**No necesitas saber cómo fue tu nacimiento ni recordar tu infancia con detalle.**",
      ),
      callout(
        "INFO",
        "Datos de la sesión",
        "- **Duración:** 1 hora.\n- **Antes de entrar:** gafas y mandos cargados, un asiento cómodo y un rato sin interrupciones.",
      ),
      section("Práctica: un recuerdo manejable (4 minutos)", undefined, 3),
      contemplation(
        "Elige un recuerdo del día a día que puedas mirar con cierta comodidad. No hace falta remover heridas ni buscar explicaciones. Nota dónde está tu cuerpo ahora, qué sensación aparece y qué le diría la persona que eres hoy a la de aquel momento. Para terminar, echa un vistazo a la habitación.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- ¿Qué recuerdo quiero acercar con cariño?",
          "- ¿Qué parte de mi historia agradece que la reconozca sin tener que explicarla?",
        ].join("\n"),
        3,
      ),
      callout(
        "SUPPORT",
        "Una nota de cuidado",
        "Puede que aparezca emoción, y está bien. Durante la sesión puedes tener los ojos abiertos, saltarte cualquier pregunta, elegir un recuerdo neutro o pedir apoyo a la persona que facilita. Si un recuerdo se vuelve demasiado intenso, para, mira a tu alrededor y habla con el equipo.",
      ),
      section("Lectura sugerida (opcional)", undefined, 3),
      bookmark(
        "https://www.planetadelibros.com/libro-se-amable-contigo-mismo/400342",
        "Sé amable contigo mismo, Kristin Neff (Paidós)",
        "Un libro para quien quiera explorar una forma más amable de tratarse. No hace falta leerlo durante el programa.",
      ),
      contact("¿Alguna duda antes de la sesión?", "Escríbenos."),
      signoff("Nos vemos pronto, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s3",
    part: "integracion",
    title: "Volver al presente con cariño",
    body: [
      section(
        "Gracias por estar en Vida.",
        "Hoy hemos recorrido distintas etapas de la vida, hemos mirado algunos recuerdos y hemos probado a ofrecer cuidado a versiones nuestras del pasado. Es una sesión que puede dejar emoción, cansancio o una sensación de calma. Todo vale. Antes de escribir sobre la vida, vuelve a este momento.",
      ),
      section("Volver al presente (3 minutos)", undefined, 3),
      contemplation("Di dónde estás, qué día es y un objeto que ves. Nota qué está sujetando tu cuerpo."),
      section("Para tu diario, en tres pasos", undefined, 3),
      ...steps([
        ["Qué apareció", ""],
        [
          "Qué noté en mí",
          "¿Qué historia me conté sobre ese momento? ¿Puedo mirarla con algo de curiosidad?",
        ],
        ["Qué necesito ahora", "¿Qué gesto de cuidado puedo tener conmigo hoy?"],
      ]),
      text("Puedes dejar de escribir en cualquier momento."),
      section(
        "Un gesto para el día a día",
        "Escribe una nota breve a una versión de ti del pasado: «Te veo. Hoy puedo ofrecerte...». Si se te hace demasiado, escríbesela a la persona que eres hoy.",
        3,
      ),
      section(
        "Si te apetece compartir",
        "En el grupo puedes contar algo que te haya ayudado, sin entrar en detalles íntimos.",
        3,
      ),
      callout(
        "INFO",
        "Lo que viene ahora",
        "La próxima sesión es **Más allá del cuerpo**. Te confirmaremos la fecha y la hora por WhatsApp, y unos días antes te enviaremos su página de preparación.",
      ),
      section("Práctica en audio (opcional)", undefined, 3),
      bookmark(
        "https://www.msc-spanish.com/audios-msc",
        "Audios oficiales de Mindful Self-Compassion en español",
        "Te recomendamos la «Pausa de la Autocompasión» para cuidarte después de la sesión. Se escucha en su propia web.",
      ),
      contact(
        "¿Quieres hablarlo?",
        "Si algún recuerdo se ha quedado contigo y quieres hablarlo, escríbenos.",
      ),
      signoff("Un abrazo, el equipo de Clear Light"),
    ],
  },

  // ─── S4 · Más allá del cuerpo (RV) ────────────────────────────────────────
  {
    sessionCode: "s4",
    part: "preparacion",
    title: "Antes de ir más allá del cuerpo",
    body: [
      section(
        "Hola, se acerca la sesión Más allá del cuerpo.",
        "Esta sesión de realidad virtual entra en terreno de incertidumbre. Exploraremos el cuerpo, la identidad y lo desconocido, y qué pasa cuando soltamos un momento nuestros puntos de referencia. Después hablaremos en grupo. Habrá imágenes relacionadas con la muerte, por eso te lo contamos antes: puedes ir a tu propio ritmo.\n\n**No tienes que estar de acuerdo con ninguna interpretación espiritual de la experiencia para participar.**",
      ),
      callout(
        "INFO",
        "Datos de la sesión",
        "- **Duración:** 1 hora.\n- **Antes de entrar:** gafas y mandos cargados, un asiento cómodo y un rato sin interrupciones.",
      ),
      section("Práctica: sostener y aflojar (3 minutos)", undefined, 3),
      contemplation(
        "Nota una mano apoyada y, muy despacio, ábrela. ¿Qué estaba intentando proteger? ¿Cuánta apertura te resulta posible hoy? Respira con naturalidad, sin aguantar el aire.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- ¿Qué parte de mí siento importante cuidar?",
          "- ¿A qué me agarro cuando aparece la incertidumbre?",
          "- ¿Qué apoyo me permite explorar sin forzarme?",
        ].join("\n"),
        3,
      ),
      callout(
        "SUPPORT",
        "Para cuidarte",
        "Resérvate unos minutos tranquilos después de la sesión, antes de ponerte con otras cosas.",
      ),
      contact(
        "¿Alguna duda o preocupación?",
        "Si tienes cualquier duda o preocupación antes de la sesión, escríbenos.",
      ),
      signoff("Nos vemos pronto, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s4",
    part: "integracion",
    title: "Volver a lo cercano",
    body: [
      section(
        "Gracias por atreverte a explorar hoy.",
        "En Más allá del cuerpo hemos explorado la identidad, el cuerpo y lo desconocido, hemos practicado soltar con la respiración y hemos compartido en grupo. Es una de las sesiones más intensas del programa, así que lo primero es volver.",
      ),
      section("Lo primero: volver", undefined, 3),
      contemplation(
        "Mira a tu alrededor y di dónde estás. Apoya las dos manos y nota el contacto con el suelo o la silla. Elige algo sencillo y cotidiano para hacer ahora. Luego decide si te apetece escribir.",
      ),
      callout(
        "SUPPORT",
        "Sin prisa",
        "**Puedes dejar cosas sin resolver. No hace falta sacar ninguna conclusión hoy.**",
      ),
      section(
        "Para tu diario",
        [
          "- ¿Qué sentí amplio o nuevo?",
          "- ¿Qué me resultó difícil?",
          "- ¿Qué me ayudó a volver?",
          "- ¿Hay algo que prefiero dejar sin resolver por ahora?",
        ].join("\n"),
        3,
      ),
      callout(
        "INFO",
        "Lo que viene ahora",
        "La próxima sesión es **Ofrenda**, nuestra última sesión en realidad virtual. Unos días antes te enviaremos su página de preparación.",
      ),
      section("Recurso práctico (opcional)", undefined, 3),
      bookmark(
        "https://www.contraelcancer.es/sites/default/files/ebooks/Digital%20-%20Gu%C3%ADa%20para%20facilitar%20la%20comunicaci%C3%B3n%20al%20final%20de%20la%20vida.pdf",
        "¿Hablamos? Guía para facilitar la comunicación al final de la vida (Asociación Española Contra el Cáncer)",
        "Por si sientes la necesidad de hablar de estos temas con tus seres queridos. Está escrita en un contexto oncológico.",
      ),
      contact(
        "Estamos aquí",
        "Si te ha quedado algo removido y necesitas hablar, escríbenos.",
      ),
      signoff("Un abrazo, el equipo de Clear Light"),
    ],
  },

  // ─── S5 · Ofrenda (RV) ────────────────────────────────────────────────────
  {
    sessionCode: "s5",
    part: "preparacion",
    title: "Lo que pesa y lo que sostiene",
    body: [
      section(
        "Hola, se acerca Ofrenda, nuestra última sesión en realidad virtual.",
        "En esta sesión, el círculo será un espacio para dos movimientos: dejar descansar algo que pesa y recibir un apoyo o una cualidad que necesites. Al final, quizá quieras reconocer algo que te gustaría ofrecer al mundo o a alguien cercano.\n\n**Puedes hablar, decir una sola palabra o quedarte en silencio. No tienes que contarle tu historia a nadie.**",
      ),
      callout("INFO", "Datos de la sesión", "- **Duración:** 1 hora."),
      checklist("Antes de entrar", [
        "Tengo las gafas cargadas.",
        "Tengo un sitio cómodo.",
        "Sé cómo pedir una pausa.",
      ]),
      section("Práctica: dos manos (4 minutos)", undefined, 3),
      contemplation(
        "En una mano, imagina algo que te gustaría dejar descansar un rato. En la otra, una cualidad que te gustaría recibir. Mira las dos manos y pregúntate: ¿qué necesitaría para tratar esto con cariño? También vale no encontrar respuesta.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- ¿Qué carga puedo nombrar sin contar su historia?",
          "- ¿Qué cualidad me vendría bien ahora?",
          "- ¿A quién o a qué me gustaría ofrecer esa cualidad, si me sale de dentro?",
        ].join("\n"),
        3,
      ),
      contact("¿Alguna duda antes de la sesión?", "Escríbenos."),
      signoff("Nos vemos pronto, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s5",
    part: "integracion",
    title: "Cuidar lo que elegiste recibir",
    body: [
      section(
        "Gracias por todo lo que has traído hoy al círculo.",
        "En Ofrenda hemos dejado descansar algo que pesa, hemos recibido una cualidad o un apoyo y hemos pensado en qué nos gustaría ofrecer. Lo que pesa puede volver. La práctica no busca que desaparezca, sino ayudarte a llevarlo con menos dureza.",
      ),
      section("Volver al cuerpo", undefined, 3),
      contemplation("Nota las manos y el asiento. Si te apetece, pasa unos minutos sin pantallas."),
      section(
        "Para tu diario",
        [
          "- ¿Qué elegí dejar descansar?",
          "- ¿Qué cualidad quise recibir?",
          "- Si aquello vuelve, ¿cómo puedo responderme con menos dureza?",
        ].join("\n"),
        3,
      ),
      section(
        "Un gesto para el día a día",
        "Elige algo pequeño, de menos de cinco minutos, para cuidar esta semana la cualidad que elegiste: pedir compañía, mandar un mensaje, salir a que te dé el aire, regalarte una pausa o dar las gracias.",
        3,
      ),
      section(
        "Si te apetece compartir",
        "Puedes decir en el grupo qué cualidad elegiste. No hace falta contar lo que decidiste soltar.",
        3,
      ),
      callout(
        "INFO",
        "Lo que viene ahora",
        "Nos queda el último encuentro, **Integración Grupal**, por Zoom. Te confirmaremos la fecha y la hora por WhatsApp, y unos días antes te enviaremos su página de preparación.",
      ),
      section("Para seguir trabajando (opcional)", undefined, 3),
      bookmark(
        "https://www.edesclee.com/biblioteca-de-psicologia/2352-cuaderno-de-trabajo-de-mindfulness-y-autocompasion.html",
        "Cuaderno de trabajo de mindfulness y autocompasión, Kristin Neff y Christopher Germer (Desclée De Brouwer)",
        "Una herramienta estructurada para profundizar cuando termine el programa.",
      ),
      contact(
        "¿Necesitas una conversación?",
        "Si lo vivido hoy necesita una conversación, escríbenos.",
      ),
      signoff("Un abrazo, el equipo de Clear Light"),
    ],
  },

  // ─── S6 · Integración Grupal (Zoom) ───────────────────────────────────────
  {
    sessionCode: "s6",
    part: "preparacion",
    title: "Nuestro último encuentro",
    body: [
      section(
        "Hola, llegamos al final del recorrido.",
        "Integración Grupal es nuestro último encuentro, por Zoom y sin gafas. Volveremos a recorrer juntos las imágenes de este camino, desde la visita en casa hasta Ofrenda, y escucharemos lo que se queda en cada uno. También hablaremos de cómo seguir cuidando lo vivido cuando termine el programa. Puedes traer una frase, una pregunta o, simplemente, tu presencia.",
      ),
      callout(
        "INFO",
        "Datos del encuentro",
        "- **Duración:** 1 hora.\n- **Dónde:** por Zoom. El enlace te llega por el grupo de WhatsApp el día antes.",
      ),
      checklist("Para tenerlo listo", [
        "Hora y enlace de Zoom comprobados.",
        "Un sitio con algo de privacidad.",
        "Un rato libre después de la llamada.",
      ]),
      section("Práctica: tres momentos, una intención (5 minutos)", undefined, 3),
      contemplation(
        "Elige tres momentos del recorrido: uno que te sostuvo, uno que todavía te hace preguntas y uno que quieres llevarte a tu día a día.",
      ),
      section(
        "Para pensar (solo para ti)",
        [
          "- ¿Qué me queda por decir?",
          "- ¿Qué me gustaría que el grupo escuchara de mí?",
          "- ¿Qué prefiero guardarme?",
        ].join("\n"),
        3,
      ),
      callout(
        "SUPPORT",
        "A tu manera",
        "**Compartir no es rendir cuentas. Puedes hablar un poco o pasar.**",
      ),
      contact("¿Problemas con Zoom o alguna duda?", "Escríbenos y te ayudamos."),
      signoff("Nos vemos en el último encuentro, el equipo de Clear Light"),
    ],
  },
  {
    sessionCode: "s6",
    part: "integracion",
    title: "Un lugar al que volver",
    body: [
      section(
        "Gracias por recorrer este camino con nosotros.",
        "Hoy hemos cerrado el programa juntos: hemos vuelto a las imágenes de cada sesión, nos hemos escuchado y hemos pensado en cómo llevar lo vivido a la vida que sigue. El programa termina, pero tu ritmo continúa. Integrar no es cerrar un capítulo de golpe, sino seguir llevando lo vivido a tu día a día.",
      ),
      section("Cierre (3 minutos)", undefined, 3),
      contemplation(
        "Nota el espacio en el que estás y reconoce el esfuerzo de haber estado presente, a tu manera, durante todo el recorrido.",
      ),
      section(
        "Para tu diario",
        [
          "- ¿Qué ha cambiado en mi forma de hacerme preguntas?",
          "- ¿Qué conversación quiero seguir teniendo?",
          "- ¿A quién puedo acudir si necesito compañía?",
        ].join("\n"),
        3,
      ),
      section(
        "Una práctica para los próximos siete días",
        "Elige una sola práctica sencilla, de dos a cinco minutos, para mantener durante la próxima semana: cuándo la harás, cómo te vas a acordar y a quién puedes acudir si necesitas apoyo. Puede ser el gesto de las manos que aprendiste en la visita, los tres puntos de apoyo o escuchar dos minutos sin preparar respuesta. Es una propuesta flexible, no un compromiso.",
        3,
      ),
      section("Lo que viene ahora"),
      ...steps([
        [
          "Contesta el último cuestionario",
          "Te enviaremos el enlace por WhatsApp. Nos ayuda mucho que lo respondas.",
        ],
        [
          "Quedamos para recoger las gafas",
          "En unos días te escribiremos por privado para quedar para la última visita, en la que recogeremos las gafas.",
        ],
      ]),
      section(
        "Si necesitas un acompañamiento más específico",
        "Si tú o tu familia estáis pasando por una pérdida y necesitáis apoyo especializado, aquí tienes algunos recursos externos:",
        3,
      ),
      bookmark(
        "https://fundacionlacaixa.org/documents/d/guest/guia-de-acompanamiento-en-el-duelo-pdf",
        "Guía de acompañamiento en el duelo (Fundación «la Caixa»)",
        "Para quien está pasando por una pérdida.",
      ),
      bookmark(
        "https://www.contraelcancer.es/es/atencion-duelo",
        "Atención al duelo (Asociación Española Contra el Cáncer)",
        "Apoyo especializado en el duelo.",
      ),
      contact("Seguimos aquí", "Seguimos aquí para lo que necesites."),
      signoff("Gracias de corazón. Un abrazo, el equipo de Clear Light"),
    ],
  },
];
