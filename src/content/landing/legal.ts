/**
 * Legal pages of the public site: legal notice and terms of use, privacy
 * policy, cookie policy (D-052).
 *
 * STATUS: drafts, pending review by a lawyer or the Data Protection Officer.
 * They follow the structure Spanish and EU law asks for (LSSI-CE art. 10 for
 * the site owner's identity, GDPR arts. 13 and 14 for the privacy notice,
 * LSSI-CE art. 22.2 and the AEPD cookie guidance for cookies), but whether they
 * meet those rules is a legal determination this code cannot make. Every fact
 * the study team has not supplied is a `Missing` marker, and every key blocks
 * publication through `missingContentList()`.
 *
 * Statements here describe only what the code actually does: the landing page
 * sets one cookie of its own only when the visitor picks a language (D-063),
 * stores one consent choice in the browser, loads YouTube only with consent,
 * and the contact form sends nothing yet.
 *
 * Spanish is the source text; legal.en.ts and legal.gl.ts translate it with
 * the same shape and the same `Missing` markers (D-063).
 */
import type { Missing } from "@/content/landing/clear-light";

const missing = (key: string, needs: string): Missing => ({ missing: true, key, needs });

const TITULAR = missing("TITULAR_WEB", "Titular del sitio web: denominación, NIF, domicilio, correo electrónico y datos registrales");
const RESPONSABLE = missing("RESPONSABLE_TRATAMIENTO", "Responsable del tratamiento: entidad, NIF, domicilio y contacto");
/**
 * Transcribed verbatim from the CEImG-approved participant consent form
 * (docs/Consentimiento castellano limpio (1).docx, "Información relativa a
 * sus datos", 2026-09-24): the USC Data Protection Officer's contact, plus
 * the SERGAS (CHUS) DPO named alongside it there. A DPO's contact is a public
 * fact GDPR art. 37(7) requires publishing, not a judgment call, so this one
 * marker resolves; `RESPONSABLE_TRATAMIENTO` stays open since that same
 * document names the institution but not its NIF or registered address, and
 * `REVISION_LEGAL` stays open because a lawyer still has to sign off on this
 * page's own wording (D-081).
 */
const DPO = "Universidade de Santiago de Compostela: dpd@usc.gal · 881 81 10 00. Delegado de Protección de Datos del SERGAS (CHUS): DPD@sergas.es.";
const BASE = missing("BASE_JURIDICA", "Base jurídica aprobada de cada tratamiento");
const PLAZO = missing("PLAZO_CONSERVACION", "Plazos de conservación de los datos");
const ENCARGADOS = missing(
  "ENCARGADOS_TRATAMIENTO",
  "Encargados del tratamiento, región de alojamiento y transferencias internacionales",
);
const REVISION = missing("REVISION_LEGAL", "Revisión legal del aviso legal, la política de privacidad y la política de cookies, con fecha de versión");

export type LegalBlock =
  | { readonly kind: "p"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "rows"; readonly rows: readonly { readonly label: string; readonly value: string | Missing }[] }
  | { readonly kind: "table"; readonly head: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: "missing"; readonly item: Missing };

export interface LegalCopy {
  readonly draft: string;
  readonly back: string;
  readonly review: Missing;
  readonly pages: readonly LegalPage[];
}

export interface LegalPage {
  readonly slug: "aviso-legal" | "privacidad" | "cookies";
  readonly title: string;
  readonly description: string;
  readonly sections: readonly { readonly heading: string; readonly blocks: readonly LegalBlock[] }[];
}

const p = (text: string): LegalBlock => ({ kind: "p", text });

/** The markers the translations reuse, so every language gates on the same keys. */
export const LEGAL_MISSING = { TITULAR, RESPONSABLE, DPO, BASE, PLAZO, ENCARGADOS, REVISION } as const;

export const LEGAL: LegalCopy = {
  draft: "Borrador pendiente de revisión legal. Este texto no es definitivo.",
  back: "Volver al estudio",
  review: REVISION,
  pages: [
    {
      slug: "aviso-legal",
      title: "Aviso legal y condiciones de uso",
      description: "Titular del sitio web y condiciones de uso de la información pública del estudio Clear Light.",
      sections: [
        {
          heading: "Titular del sitio web",
          blocks: [
            p("La Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), pide identificar al titular de este sitio web:"),
            { kind: "rows", rows: [{ label: "Titular", value: TITULAR }] },
          ],
        },
        {
          heading: "Objeto del sitio",
          blocks: [
            p("Este sitio ofrece información pública sobre el estudio de investigación Clear Light y da acceso al cuestionario de interés. No es un servicio de atención sanitaria."),
          ],
        },
        {
          heading: "La información no sustituye el consejo médico",
          blocks: [
            p("El contenido de este sitio es informativo. No es consejo médico, diagnóstico ni tratamiento. Si tienes dudas sobre tu salud, consulta con tu equipo sanitario."),
          ],
        },
        {
          heading: "Condiciones de uso",
          blocks: [
            p("Al usar este sitio te comprometes a hacerlo de forma lícita y sin dañar su funcionamiento."),
            p("Mostrar interés o completar el cuestionario no te compromete a participar y no equivale a dar consentimiento para el estudio. El consentimiento se da después, con toda la información."),
          ],
        },
        {
          heading: "Propiedad intelectual",
          blocks: [
            p("Los textos, imágenes, vídeos y diseño de este sitio pertenecen a su titular o se usan con autorización. No pueden reproducirse sin permiso, salvo para uso personal."),
          ],
        },
        {
          heading: "Servicios de terceros",
          blocks: [
            p("Este sitio enlaza al cuestionario de interés, alojado en Qualtrics, y puede mostrar un vídeo alojado en YouTube si lo aceptas. Esos servicios tienen sus propias condiciones y políticas de privacidad."),
          ],
        },
        {
          heading: "Legislación aplicable",
          blocks: [p("Estas condiciones se rigen por la legislación española.")],
        },
      ],
    },
    {
      slug: "privacidad",
      title: "Política de privacidad",
      description: "Cómo se tratan los datos personales en la web y en el estudio Clear Light.",
      sections: [
        {
          heading: "Responsable del tratamiento",
          blocks: [
            {
              kind: "rows",
              rows: [
                { label: "Responsable", value: RESPONSABLE },
                { label: "Delegado de Protección de Datos", value: DPO },
              ],
            },
          ],
        },
        {
          heading: "Qué datos tratamos y para qué",
          blocks: [
            {
              kind: "list",
              items: [
                "Navegación por esta web: no usa cookies de análisis ni de publicidad y no crea perfiles. Solo guarda en tu navegador tu elección sobre el contenido de terceros y, si lo eliges, el idioma de la web.",
                "Cuestionario de interés (Qualtrics): los datos que decidas compartir para valorar si el estudio encaja contigo. El cuestionario te informa y te pide consentimiento antes de recoger ningún dato.",
                "Formulario de contacto: nombre, correo electrónico y mensaje, solo para responderte. El envío todavía no está disponible y hoy no se guarda nada.",
                "Participación en el estudio: si participas, el equipo trata tus datos de contacto y la información necesaria para organizar el estudio, como el calendario y la entrega de las gafas, identificándote con un código. Las respuestas de investigación se guardan en sistemas aprobados por la institución, separadas de tus datos de contacto.",
              ],
            },
          ],
        },
        {
          heading: "Base jurídica",
          blocks: [
            p("Los datos relacionados con la salud son una categoría especial de datos según el Reglamento General de Protección de Datos (RGPD)."),
            { kind: "missing", item: BASE },
          ],
        },
        {
          heading: "Con quién se comparten",
          blocks: [
            p("Algunos proveedores prestan servicios técnicos, como el alojamiento o los cuestionarios, y actúan como encargados del tratamiento."),
            { kind: "missing", item: ENCARGADOS },
          ],
        },
        {
          heading: "Cuánto tiempo se conservan",
          blocks: [{ kind: "missing", item: PLAZO }],
        },
        {
          heading: "Tus derechos",
          blocks: [
            p("Puedes ejercer en cualquier momento tus derechos de:"),
            {
              kind: "list",
              items: [
                "Acceso a tus datos.",
                "Rectificación de datos inexactos.",
                "Supresión.",
                "Oposición y limitación del tratamiento.",
                "Portabilidad.",
                "Retirada del consentimiento, sin que afecte a lo tratado antes de retirarlo.",
              ],
            },
            p("Para ejercerlos, escribe al responsable o al Delegado de Protección de Datos en los datos indicados arriba."),
            p("Si consideras que no se han respetado tus derechos, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es)."),
          ],
        },
      ],
    },
    {
      slug: "cookies",
      title: "Política de cookies",
      description: "Qué cookies y almacenamiento del navegador usa la web del estudio Clear Light.",
      sections: [
        {
          heading: "Qué son las cookies",
          blocks: [
            p("Las cookies y otras tecnologías parecidas guardan información en tu navegador. Algunas son necesarias para que la web funcione; otras solo se usan si las aceptas."),
          ],
        },
        {
          heading: "Qué usa esta web",
          blocks: [
            {
              kind: "table",
              head: ["Nombre", "Titular", "Finalidad", "Tipo", "Duración"],
              rows: [
                ["Preferencia de consentimiento", "Propio", "Recordar si aceptas o rechazas el contenido de terceros.", "Técnica, necesaria", "12 meses"],
                ["Idioma (clp_public_locale)", "Propio", "Recordar el idioma que eliges para la web. Solo se crea si cambias de idioma.", "Técnica, necesaria", "12 meses"],
                ["Vídeo de YouTube (youtube-nocookie.com)", "Google", "Reproducir el vídeo de la sección «El qué». YouTube puede guardar datos para el funcionamiento del reproductor.", "De terceros, solo si la aceptas", "Según la política de Google"],
                ["Sesión del equipo", "Propio", "Mantener la sesión del personal del estudio. Solo en el área del equipo.", "Técnica, necesaria", "Mientras dura la sesión"],
              ],
            },
            p("Esta web no usa cookies de análisis ni de publicidad."),
          ],
        },
        {
          heading: "Cómo cambiar tu elección",
          blocks: [
            p("Puedes cambiarla en cualquier momento desde «Configurar cookies», en el pie de página, o borrar los datos de este sitio desde la configuración de tu navegador."),
          ],
        },
      ],
    },
  ],
};

export function legalPage(slug: LegalPage["slug"], legal: LegalCopy = LEGAL): LegalPage {
  const page = legal.pages.find((pg) => pg.slug === slug);
  if (!page) throw new Error(`Unknown legal page: ${slug}`);
  return page;
}

/** Every unresolved value on the legal pages. */
export function legalMissing(): readonly Missing[] {
  const out: Missing[] = [LEGAL.review];
  for (const page of LEGAL.pages)
    for (const s of page.sections)
      for (const b of s.blocks) {
        if (b.kind === "missing") out.push(b.item);
        if (b.kind === "rows") for (const r of b.rows) if (typeof r.value !== "string") out.push(r.value);
      }
  return out;
}
