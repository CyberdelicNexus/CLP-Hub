/**
 * Joana Vidal's review of the session pages (comments on the "Clear Light ·
 * Materiales de preparación e integración" Google Doc, 2026-11-03), D-136.
 *
 * Each pair is one whole string on the live page, as it reads before and after.
 * scripts/revise-session-pages.ts swaps exactly these strings on the live
 * Spanish pages, and their Galician versions (./galician.json) on the live
 * Galician pages, leaving every other word, including edits made in the Hub,
 * as it is. ./pages.ts already carries the new text.
 */

export const REVISION_PAIRS: Record<string, [before: string, after: string][]> = {
  "s0-preparacion": [
    [
      "Tendremos todo el tiempo que haga falta para tus preguntas, técnicas o sobre cómo será el programa.",
      "Dispondremos de todo el tiempo necesario para resolver tus dudas, tanto técnicas como sobre el funcionamiento del programa.",
    ],
    [
      "Nota el contacto de los pies con el suelo, del cuerpo con el asiento y de una mano con la otra. Echa un vistazo a tu alrededor. ¿Hay algo que puedas ajustar para estar un poco más a gusto? No hace falta cambiar la respiración.",
      "Toma conciencia del contacto de los pies con el suelo, del cuerpo apoyado en el asiento y de una mano sobre la otra. Echa un vistazo a tu alrededor. ¿Hay algo que quieras ajustar para sentirte un poco más a gusto? No hace falta modificar la respiración; simplemente deja que fluya.",
    ],
  ],
  "s0-integracion": [
    [
      "Si te apetece, busca tres objetos en la habitación y nota el peso del cuerpo sobre el asiento. Puedes repetir solo la parte que te venga bien.",
      "Si te apetece, prueba esto: localiza tres objetos a tu alrededor y fíjate en el peso de tu cuerpo apoyado en el asiento. Puedes repetirlo siempre que quieras, o hacer solo la parte que te resulte útil.",
    ],
    [
      "Repite una vez, sin gafas, el gesto que probamos: las manos se abren al espirar, como si abrieras dos puertas desde el pecho, y vuelven al inspirar. O, simplemente, apoya un momento las manos en el pecho.",
      "Ya sin las gafas, repite una vez el gesto que probamos antes: abre las manos desde el pecho al espirar, como quien abre dos puertas, y devuélvelas al pecho al inspirar. O, si te resulta más cómodo, apoya las manos en el pecho un momento.",
    ],
    [
      "Lo usaremos para organizar las sesiones, resolver dudas rápidas y enviar recordatorios. Te mandamos el enlace para unirte por WhatsApp.",
      "Lo usaremos para organizar las sesiones, resolver dudas rápidas y enviar recordatorios. Te enviaremos por mensaje privado el enlace para unirte al grupo.",
    ],
    [
      "Guárdalas en su caja, en un sitio seco y lejos del sol directo, porque la luz del sol puede dañar las lentes. Cárgalas con el cargador que te dejamos la noche antes de cada sesión, y si algo no funciona, escríbenos por WhatsApp.",
      "Guarda las gafas en su caja, en un lugar seco y alejado del sol directo, ya que la luz solar puede dañar los cristales. La noche antes de cada sesión, cárgalas con el cargador que te hemos dejado. Si algo no funciona, escríbenos por WhatsApp.",
    ],
    [
      "En Orientación",
      "En la sesión de Orientación",
    ],
    [
      "todavía no entraremos en la realidad virtual",
      "todavía no usaremos la realidad virtual",
    ],
    [
      ". Será una conversación para conocernos, ver el mapa del recorrido y responder las preguntas que te hayan surgido. Unos días antes te enviaremos su página de preparación.",
      ". Será una conversación para conocernos, explicarte cómo será el recorrido y responder a las preguntas que te hayan surgido. Unos días antes te enviaremos la página de preparación de esa sesión.",
    ],
  ],
  "s1-preparacion": [
    [
      "La Sesión 1, Orientación, es nuestro primer encuentro como grupo. Será por Zoom, todavía sin gafas. Nos presentaremos, hablaremos de lo que nos trae aquí y de nuestra relación con la muerte, y repasaremos juntos el mapa del recorrido y las dudas que tengas. No tienes que sentirte de ninguna manera concreta para participar: puedes hablar poco, hablar mucho o pasar.",
      "La Sesión 1, Orientación, es nuestro primer encuentro como grupo. Será por Zoom, todavía sin gafas. Nos presentaremos, hablaremos de lo que nos trae aquí y de nuestra relación con la muerte, y repasaremos juntos cómo serán las sesiones y las dudas que tengas. No tienes que sentirte de ninguna manera concreta para participar: puedes hablar poco, hablar mucho o simplemente escuchar.",
    ],
    [
      "Un sitio tranquilo y con algo de privacidad, si puede ser junto a quien te acompañe.",
      "Un sitio tranquilo y con algo de privacidad, si puede ser con tu acompañante cerca.",
    ],
    [
      "Si tuviera que describir cómo llego hoy en tres palabras, ¿cuáles serían?",
      "Si tuviera que describir en tres palabras cómo llego hoy a la sesión, ¿cuáles serían?",
    ],
  ],
  "s1-integracion": [
    [
      "En nuestro primer encuentro nos hemos presentado, hemos empezado a hablar de nuestra relación con la muerte y hemos visto juntos el mapa del recorrido. Gracias por tu presencia, tu escucha y lo que hayas querido compartir. Una conversación así puede seguir dándote vueltas horas después de apagar la pantalla. Antes de darle sentido, fíjate en cómo estás y qué necesitas ahora.",
      "En nuestro primer encuentro nos hemos presentado, hemos empezado a hablar de nuestra relación con la muerte y hemos repasado juntos cómo serán las sesiones. Gracias por tu presencia, tu escucha y lo que hayas querido compartir. Es normal que una conversación así te siga rondando la cabeza horas después de terminar la sesión. Antes de darle sentido, fíjate en cómo estás y qué necesitas ahora.",
    ],
  ],
  "s2-preparacion": [
    [
      "Mueve una mano despacio. Fíjate en lo que pasa en el hombro, el pecho o la tripa. Luego déjala descansar. ¿Qué cambia cuando prestas atención al movimiento? Quedarse quieto también cuenta.",
      "Mueve una mano despacio. Fíjate en lo que pasa en el hombro, el pecho o la tripa. Luego déjala descansar. ¿Qué cambia cuando prestas atención al movimiento? Si prefieres no moverte, también está bien; puedes simplemente observar.",
    ],
  ],
  "s2-integracion": [
    [
      "Hoy nos hemos visto por primera vez como formas de luz, hemos compartido una intención, hemos respirado juntos y hemos practicado dar, recibir y escuchar por parejas. Puede que la experiencia haya sido cálida, rara, neutra o un poco de todo. Cualquier forma de vivirla vale.",
      "Hoy nos hemos visto por primera vez como formas de luz, hemos compartido una intención, hemos respirado juntos y hemos practicado dar, recibir y escuchar por parejas. Puede que la experiencia haya sido cálida, rara, neutra o un poco de todo. Cualquier forma de vivirla está bien.",
    ],
  ],
  "s3-preparacion": [
    [
      "En esta sesión de realidad virtual recorreremos distintas etapas de la vida: momentos significativos, luminosos y difíciles, y la forma en que podemos mirarlos hoy con más cariño. Tú eliges qué recuerdos acercar y cuáles prefieres dejar descansar. Al final volveremos juntos al grupo.",
      "En esta sesión de realidad virtual recorreremos distintas etapas de la vida: momentos significativos, tanto luminosos como difíciles, y veremos cómo podemos mirarlos hoy con más cariño. Tú decides qué recuerdos quieres traer a la memoria y cuáles prefieres dejar a un lado. Al terminar, volveremos a reunirnos en grupo.",
    ],
    [
      "Elige un recuerdo del día a día que puedas mirar con cierta comodidad. No hace falta remover heridas ni buscar explicaciones. Nota dónde está tu cuerpo ahora, qué sensación aparece y qué le diría la persona que eres hoy a la de aquel momento. Para terminar, echa un vistazo a la habitación.",
      "Elige un recuerdo que puedas mirar con cierta comodidad. No hace falta remover heridas ni buscar explicaciones. Nota dónde está tu cuerpo ahora, qué sensación aparece y qué le diría la persona que eres hoy a la de aquel momento. Para terminar, echa un vistazo a la habitación.",
    ],
    [
      "¿Qué recuerdo quiero acercar con cariño?",
      "¿Qué recuerdo quiero mirar con cariño?",
    ],
    [
      "¿Qué parte de mi historia agradece que la reconozca sin tener que explicarla?",
      "¿Qué parte de mi historia necesita ser reconocida, sin tener que explicarla?",
    ],
  ],
  "s3-integracion": [
    [
      "Hoy hemos recorrido distintas etapas de la vida, hemos mirado algunos recuerdos y hemos probado a ofrecer cuidado a versiones nuestras del pasado. Es una sesión que puede dejar emoción, cansancio o una sensación de calma. Todo vale. Antes de escribir sobre la vida, vuelve a este momento.",
      "Hoy hemos recorrido distintas etapas de la vida, hemos mirado algunos recuerdos y hemos probado a ofrecer cuidado a versiones nuestras del pasado. Después de esta sesión puedes sentirte emocionado o emocionada, cansado o cansada, o con una sensación de calma. Cualquier reacción es válida. Antes de ponerte a escribir sobre tu vida, tómate un momento para volver al presente.",
    ],
    [
      "Di dónde estás, qué día es y un objeto que ves. Nota qué está sujetando tu cuerpo.",
      "Di en voz alta dónde estás, qué día es y nombra un objeto que veas. Después, fíjate en qué superficie sostiene tu cuerpo: la silla, el sofá o el suelo.",
    ],
    [
      "Escribe una nota breve a una versión de ti del pasado: «Te veo. Hoy puedo ofrecerte...». Si se te hace demasiado, escríbesela a la persona que eres hoy.",
      "Escribe una nota breve a la persona que fuiste en algún momento del pasado. Puedes empezar así: «Te veo. Hoy puedo ofrecerte...». Si te resulta demasiado intenso, puedes escribírsela a la persona que eres hoy.",
    ],
  ],
  "s4-preparacion": [
    [
      "Esta sesión de realidad virtual entra en terreno de incertidumbre. Exploraremos el cuerpo, la identidad y lo desconocido, y qué pasa cuando soltamos un momento nuestros puntos de referencia. Después hablaremos en grupo. Habrá imágenes relacionadas con la muerte, por eso te lo contamos antes: puedes ir a tu propio ritmo.",
      "En esta sesión de realidad virtual nos adentraremos en la incertidumbre. Exploraremos el cuerpo, la identidad y lo desconocido, y veremos qué ocurre cuando soltamos por un momento nuestros puntos de referencia. Aparecerán imágenes relacionadas con la muerte; te lo contamos de antemano para que lo sepas. Puedes ir a tu propio ritmo. Al terminar, hablaremos en grupo.",
    ],
  ],
  "s4-integracion": [
    [
      "¿Qué sentí amplio o nuevo?",
      "¿Noté alguna sensación de amplitud o algo que no había sentido antes?",
    ],
    [
      "Si te ha quedado algo removido y necesitas hablar, escríbenos.",
      "Si algo se ha removido en ti y necesitas hablar, escríbenos.",
    ],
  ],
  "s5-preparacion": [
    [
      "En esta sesión, el círculo será un espacio para dos movimientos: dejar descansar algo que pesa y recibir un apoyo o una cualidad que necesites. Al final, quizá quieras reconocer algo que te gustaría ofrecer al mundo o a alguien cercano.",
      "En esta sesión, el grupo será un espacio para dos cosas: soltar algo que te pesa y recibir el apoyo o la cualidad que necesitas. Al final, quizá quieras pensar en algo que te gustaría ofrecer al mundo o a alguien cercano.",
    ],
    [
      "En una mano, imagina algo que te gustaría dejar descansar un rato. En la otra, una cualidad que te gustaría recibir. Mira las dos manos y pregúntate: ¿qué necesitaría para tratar esto con cariño? También vale no encontrar respuesta.",
      "En una mano, imagina algo que te gustaría soltar o dejar a un lado por un rato. En la otra, una cualidad que te gustaría recibir. Mira las dos manos y pregúntate: ¿qué necesitaría para tratar lo que siento con cariño? Si no encuentras respuesta, también está bien.",
    ],
  ],
  "s5-integracion": [
    [
      "Gracias por todo lo que has traído hoy al círculo.",
      "Gracias por todo lo que has traído hoy al grupo.",
    ],
    [
      "En Ofrenda hemos dejado descansar algo que pesa, hemos recibido una cualidad o un apoyo y hemos pensado en qué nos gustaría ofrecer. Lo que pesa puede volver. La práctica no busca que desaparezca, sino ayudarte a llevarlo con menos dureza.",
      "En la sesión de Ofrenda hemos soltado por un momento algo que nos pesa, hemos recibido una cualidad o un apoyo y hemos pensado en lo que nos gustaría ofrecer. Es posible que lo que pesa vuelva. La práctica no pretende que desaparezca, sino ayudarte a llevarlo con más suavidad.",
    ],
    [
      "¿Qué elegí dejar descansar?",
      "¿Qué elegí soltar por un momento?",
    ],
    [
      "Si aquello vuelve, ¿cómo puedo responderme con menos dureza?",
      "Si lo que me pesa vuelve, ¿cómo puedo tratarme con más suavidad?",
    ],
    [
      "Elige algo pequeño, de menos de cinco minutos, para cuidar esta semana la cualidad que elegiste: pedir compañía, mandar un mensaje, salir a que te dé el aire, regalarte una pausa o dar las gracias.",
      "Piensa en un gesto sencillo, de menos de cinco minutos, que te ayude a cultivar esta semana la cualidad que recibiste. Por ejemplo: pedir compañía, enviar un mensaje a alguien, salir a tomar el aire, regalarte una pausa o dar las gracias.",
    ],
  ],
  "s6-preparacion": [
    [
      "Integración Grupal es nuestro último encuentro, por Zoom y sin gafas. Volveremos a recorrer juntos las imágenes de este camino, desde la visita en casa hasta Ofrenda, y escucharemos lo que se queda en cada uno. También hablaremos de cómo seguir cuidando lo vivido cuando termine el programa. Puedes traer una frase, una pregunta o, simplemente, tu presencia.",
      "Integración Grupal es nuestro último encuentro, por Zoom y sin gafas. Repasaremos juntos el camino que hemos recorrido, desde la visita en casa hasta la sesión de Ofrenda, y compartiremos lo que cada uno se lleva. También hablaremos de cómo seguir cuidando lo vivido cuando termine el programa. Puedes traer una frase, una pregunta o, simplemente, venir tal como estés.",
    ],
    [
      "Elige tres momentos del recorrido: uno que te sostuvo, uno que todavía te hace preguntas y uno que quieres llevarte a tu día a día.",
      "Elige tres momentos del recorrido: uno que te haya servido de apoyo, otro que todavía te despierte preguntas y otro que te gustaría llevarte a tu día a día.",
    ],
    [
      "Compartir no es rendir cuentas. Puedes hablar un poco o pasar.",
      "Compartir no es una obligación ni un examen. Puedes hablar un poco o simplemente escuchar.",
    ],
  ],
  "s6-integracion": [
    [
      "Hoy hemos cerrado el programa juntos: hemos vuelto a las imágenes de cada sesión, nos hemos escuchado y hemos pensado en cómo llevar lo vivido a la vida que sigue. El programa termina, pero tu ritmo continúa. Integrar no es cerrar un capítulo de golpe, sino seguir llevando lo vivido a tu día a día.",
      "Hoy hemos cerrado el programa juntos: hemos repasado las imágenes de cada sesión, nos hemos escuchado y hemos pensado en cómo llevar esta experiencia a nuestra vida. El programa termina, pero tu proceso continúa. Integrar no significa cerrar un capítulo de golpe, sino seguir incorporando poco a poco lo vivido a tu día a día.",
    ],
    [
      "Elige una sola práctica sencilla, de dos a cinco minutos, para mantener durante la próxima semana: cuándo la harás, cómo te vas a acordar y a quién puedes acudir si necesitas apoyo. Puede ser el gesto de las manos que aprendiste en la visita, los tres puntos de apoyo o escuchar dos minutos sin preparar respuesta. Es una propuesta flexible, no un compromiso.",
      "Elige una práctica sencilla, de dos a cinco minutos, para hacer durante la próxima semana. Puede ser el gesto de las manos que aprendiste en la visita, los tres puntos de apoyo o escuchar a alguien durante dos minutos sin pensar en qué vas a responder. Después, decide cuándo la harás, cómo te acordarás de hacerla y a quién puedes acudir si necesitas apoyo. Es una propuesta flexible, no una obligación.",
    ],
    [
      "Te enviaremos el enlace por WhatsApp. Nos ayuda mucho que lo respondas.",
      "Te enviaremos el enlace por WhatsApp. Es muy importante para nosotros que lo respondas.",
    ],
  ],
};

/**
 * Whole blocks replaced by the block with the same title in ./pages.ts:
 * S3's "Una nota de cuidado" callout becomes a contact box (Joana asked for the
 * contact button and the email there).
 */
export const BLOCK_SWAPS: { key: string; type: string; title: string }[] = [
  { key: "s3-preparacion", type: "CALLOUT", title: "Una nota de cuidado" },
];
