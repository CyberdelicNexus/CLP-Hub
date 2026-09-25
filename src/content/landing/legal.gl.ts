/**
 * Galician translation of legal.ts (D-063).
 *
 * STATUS: working draft, published at the founder's direction without native
 * editorial, legal or ethics review. Shape, slugs and `Missing` markers
 * (reused by reference) must match the Spanish source.
 */
import { LEGAL, LEGAL_MISSING as M, type LegalBlock, type LegalCopy } from "@/content/landing/legal";

const p = (text: string): LegalBlock => ({ kind: "p", text });

export const LEGAL_GL: LegalCopy = {
  draft: "Borrador pendente de revisión legal. Este texto non é definitivo.",
  back: "Volver ao estudo",
  review: LEGAL.review,
  pages: [
    {
      slug: "aviso-legal",
      title: "Aviso legal e condicións de uso",
      description: "Titular do sitio web e condicións de uso da información pública do estudo Clear Light.",
      sections: [
        {
          heading: "Titular do sitio web",
          blocks: [
            p("A Lei 34/2002, de servizos da sociedade da información e de comercio electrónico (LSSI-CE), pide identificar o titular deste sitio web:"),
            { kind: "rows", rows: [{ label: "Titular", value: M.TITULAR }] },
          ],
        },
        {
          heading: "Obxecto do sitio",
          blocks: [
            p("Este sitio ofrece información pública sobre o estudo de investigación Clear Light e dá acceso ao cuestionario de interese. Non é un servizo de atención sanitaria."),
          ],
        },
        {
          heading: "A información non substitúe o consello médico",
          blocks: [
            p("O contido deste sitio é informativo. Non é consello médico, diagnóstico nin tratamento. Se tes dúbidas sobre a túa saúde, consulta co teu equipo sanitario."),
          ],
        },
        {
          heading: "Condicións de uso",
          blocks: [
            p("Ao usar este sitio comprométeste a facelo de forma lícita e sen danar o seu funcionamento."),
            p("Amosar interese ou completar o cuestionario non te compromete a participar e non equivale a dar consentimento para o estudo. O consentimento dáse despois, con toda a información."),
          ],
        },
        {
          heading: "Propiedade intelectual",
          blocks: [
            p("Os textos, imaxes, vídeos e deseño deste sitio pertencen ao seu titular ou úsanse con autorización. Non poden reproducirse sen permiso, agás para uso persoal."),
          ],
        },
        {
          heading: "Servizos de terceiros",
          blocks: [
            p("Este sitio enlaza co cuestionario de interese, aloxado en Qualtrics, e pode amosalo dentro da páxina, así como un vídeo aloxado en YouTube, se o aceptas. Eses servizos teñen as súas propias condicións e políticas de privacidade."),
          ],
        },
        {
          heading: "Lexislación aplicable",
          blocks: [p("Estas condicións rexen pola lexislación española.")],
        },
      ],
    },
    {
      slug: "privacidad",
      title: "Política de privacidade",
      description: "Como se tratan os datos persoais na web e no estudo Clear Light.",
      sections: [
        {
          heading: "Responsable do tratamento",
          blocks: [
            {
              kind: "rows",
              rows: [
                { label: "Responsable", value: M.RESPONSABLE },
                { label: "Delegado de Protección de Datos", value: M.DPO },
              ],
            },
          ],
        },
        {
          heading: "Que datos tratamos e para que",
          blocks: [
            {
              kind: "list",
              items: [
                "Navegación por esta web: non usa cookies de análise nin de publicidade e non crea perfís. Só garda no teu navegador a túa elección sobre o contido de terceiros e, se o eliges, o idioma da web.",
                "Solicitude en «Comprobar se podo participar»: nome, correo electrónico e teléfono, só para que o equipo do estudo poida contactar contigo. Gárdanse cun código de solicitude formado polas túas iniciais e o mes e o ano da solicitude. O equipo relaciona a túa solicitude coas túas respostas do cuestionario polo teu nome, correo e teléfono. Non se garda ningún outro dato teu nesta web.",
                "Cuestionario de interese (Qualtrics): os datos que decidas compartir para valorar se o estudo encaixa contigo. O cuestionario infórmate e pídeche consentimento antes de facerche ningunha pregunta do estudo. As túas respostas quedan en Qualtrics.",
                "Formulario de contacto: nome, correo electrónico e mensaxe, só para responderche. O equipo léos e respóndeche por correo electrónico desde o seu sistema de xestión, e en canto responde borra o teu nome, o teu correo e a túa mensaxe dese sistema. Por iso pedímosche que non incluías datos sobre a túa saúde.",
                "Participación no estudo: se participas, o equipo trata os teus datos de contacto e a información necesaria para organizar o estudo, como o calendario e a entrega das gafas, identificándote cun código. As respostas de investigación gárdanse en sistemas aprobados pola institución, separadas dos teus datos de contacto.",
              ],
            },
          ],
        },
        {
          heading: "Base xurídica",
          blocks: [
            p("Os datos relacionados coa saúde son unha categoría especial de datos segundo o Regulamento xeral de protección de datos (RXPD)."),
            { kind: "missing", item: M.BASE },
          ],
        },
        {
          heading: "Con quen se comparten",
          blocks: [
            p("Algúns provedores prestan servizos técnicos, como o aloxamento ou os cuestionarios, e actúan como encargados do tratamento."),
            { kind: "missing", item: M.ENCARGADOS },
          ],
        },
        {
          heading: "Canto tempo se conservan",
          blocks: [{ kind: "missing", item: M.PLAZO }],
        },
        {
          heading: "Os teus dereitos",
          blocks: [
            p("Podes exercer en calquera momento os teus dereitos de:"),
            {
              kind: "list",
              items: [
                "Acceso aos teus datos.",
                "Rectificación de datos inexactos.",
                "Supresión.",
                "Oposición e limitación do tratamento.",
                "Portabilidade.",
                "Retirada do consentimento, sen que afecte ao que se tratou antes de retiralo.",
              ],
            },
            p("Para exercelos, escribe ao responsable ou ao Delegado de Protección de Datos nos datos indicados arriba."),
            p("Se consideras que non se respectaron os teus dereitos, podes presentar unha reclamación ante a Axencia Española de Protección de Datos (www.aepd.es)."),
          ],
        },
      ],
    },
    {
      slug: "cookies",
      title: "Política de cookies",
      description: "Que cookies e almacenamento do navegador usa a web do estudo Clear Light.",
      sections: [
        {
          heading: "Que son as cookies",
          blocks: [
            p("As cookies e outras tecnoloxías parecidas gardan información no teu navegador. Algunhas son necesarias para que a web funcione; outras só se usan se as aceptas."),
          ],
        },
        {
          heading: "Que usa esta web",
          blocks: [
            {
              kind: "table",
              head: ["Nome", "Titular", "Finalidade", "Tipo", "Duración"],
              rows: [
                ["Preferencia de consentimento", "Propio", "Lembrar se aceptas ou rexeitas o contido de terceiros.", "Técnica, necesaria", "12 meses"],
                ["Idioma (clp_public_locale)", "Propio", "Lembrar o idioma que elixes para a web. Só se crea se cambias de idioma.", "Técnica, necesaria", "12 meses"],
                ["Vídeo de YouTube (youtube-nocookie.com)", "Google", "Reproducir o vídeo da sección «O que». YouTube pode gardar datos para o funcionamento do reprodutor.", "De terceiros, só se a aceptas", "Segundo a política de Google"],
                ["Cuestionario de Qualtrics (qualtrics.com)", "Qualtrics", "Amosar o cuestionario de interese dentro da páxina «Comprobar se podo participar». Qualtrics pode gardar datos para o funcionamento do cuestionario.", "De terceiros, só se o aceptas", "Segundo a política de Qualtrics"],
                ["Sesión do equipo", "Propio", "Manter a sesión do persoal do estudo. Só na área do equipo.", "Técnica, necesaria", "Mentres dura a sesión"],
              ],
            },
            p("Esta web non usa cookies de análise nin de publicidade."),
          ],
        },
        {
          heading: "Como cambiar a túa elección",
          blocks: [
            p("Podes cambiala en calquera momento desde «Configurar cookies», no pé de páxina, ou borrar os datos deste sitio desde a configuración do teu navegador."),
          ],
        },
      ],
    },
  ],
};
