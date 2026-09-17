/**
 * English translation of legal.ts (D-063).
 *
 * STATUS: working draft, published at the founder's direction without native,
 * legal or ethics review. Spanish is the source text: the shape, the `Missing`
 * markers (reused by reference) and every `slug` must match legal.ts.
 */
import { LEGAL, LEGAL_MISSING as M, type LegalBlock, type LegalCopy } from "@/content/landing/legal";

const p = (text: string): LegalBlock => ({ kind: "p", text });

export const LEGAL_EN: LegalCopy = {
  draft: "Draft pending legal review. This text is not final.",
  back: "Back to the study",
  review: LEGAL.review,
  pages: [
    {
      slug: "aviso-legal",
      title: "Legal notice and terms of use",
      description: "Owner of the website and terms of use of the public information about the aNUma Clear Light study.",
      sections: [
        {
          heading: "Website owner",
          blocks: [
            p("Spain's Law 34/2002 on information society services and electronic commerce (LSSI-CE) requires the owner of this website to be identified:"),
            { kind: "rows", rows: [{ label: "Owner", value: M.TITULAR }] },
          ],
        },
        {
          heading: "Purpose of the site",
          blocks: [
            p("This site offers public information about the aNUma Clear Light research study and gives access to the interest questionnaire. It is not a health care service."),
          ],
        },
        {
          heading: "The information does not replace medical advice",
          blocks: [
            p("The content of this site is for information only. It is not medical advice, diagnosis, or treatment. If you have questions about your health, talk to your health care team."),
          ],
        },
        {
          heading: "Terms of use",
          blocks: [
            p("By using this site, you agree to do so lawfully and without harming how it works."),
            p("Showing interest or completing the questionnaire does not commit you to take part and is not the same as giving consent for the study. Consent is given later, with all the information."),
          ],
        },
        {
          heading: "Intellectual property",
          blocks: [
            p("The text, images, videos, and design of this site belong to its owner or are used with permission. They may not be reproduced without permission, except for personal use."),
          ],
        },
        {
          heading: "Third-party services",
          blocks: [
            p("This site links to the interest questionnaire, hosted on Qualtrics, and may show a video hosted on YouTube if you accept it. Those services have their own terms and privacy policies."),
          ],
        },
        {
          heading: "Applicable law",
          blocks: [p("These terms are governed by Spanish law.")],
        },
      ],
    },
    {
      slug: "privacidad",
      title: "Privacy policy",
      description: "How personal data is processed on the website and in the aNUma Clear Light study.",
      sections: [
        {
          heading: "Data controller",
          blocks: [
            {
              kind: "rows",
              rows: [
                { label: "Controller", value: M.RESPONSABLE },
                { label: "Data Protection Officer", value: M.DPO },
              ],
            },
          ],
        },
        {
          heading: "What data we process and why",
          blocks: [
            {
              kind: "list",
              items: [
                "Browsing this website: it does not use analytics or advertising cookies and does not create profiles. It only stores in your browser your choice about third-party content and, if you choose it, the language of the website.",
                "Interest questionnaire (Qualtrics): the data you decide to share so we can assess whether the study suits you. The questionnaire informs you and asks for your consent before collecting any data.",
                "Contact form: name, email address, and message, only to reply to you. Sending is not available yet and nothing is stored today.",
                "Taking part in the study: if you take part, the team processes your contact details and the information needed to organize the study, such as the schedule and the delivery of the headset, identifying you by a code. Research responses are stored in systems approved by the institution, separate from your contact details.",
              ],
            },
          ],
        },
        {
          heading: "Legal basis",
          blocks: [
            p("Data related to health is a special category of data under the General Data Protection Regulation (GDPR)."),
            { kind: "missing", item: M.BASE },
          ],
        },
        {
          heading: "Who it is shared with",
          blocks: [
            p("Some providers deliver technical services, such as hosting or questionnaires, and act as data processors."),
            { kind: "missing", item: M.ENCARGADOS },
          ],
        },
        {
          heading: "How long it is kept",
          blocks: [{ kind: "missing", item: M.PLAZO }],
        },
        {
          heading: "Your rights",
          blocks: [
            p("At any time, you can exercise your rights of:"),
            {
              kind: "list",
              items: [
                "Access to your data.",
                "Rectification of inaccurate data.",
                "Erasure.",
                "Objection and restriction of processing.",
                "Portability.",
                "Withdrawal of consent, without affecting what was processed before you withdrew it.",
              ],
            },
            p("To exercise them, write to the controller or to the Data Protection Officer using the details given above."),
            p("If you believe your rights have not been respected, you can file a complaint with the Spanish Data Protection Agency (Agencia Española de Protección de Datos, www.aepd.es)."),
          ],
        },
      ],
    },
    {
      slug: "cookies",
      title: "Cookie policy",
      description: "What cookies and browser storage the aNUma Clear Light study website uses.",
      sections: [
        {
          heading: "What cookies are",
          blocks: [
            p("Cookies and other similar technologies store information in your browser. Some are necessary for the website to work; others are only used if you accept them."),
          ],
        },
        {
          heading: "What this website uses",
          blocks: [
            {
              kind: "table",
              head: ["Name", "Owner", "Purpose", "Type", "Duration"],
              rows: [
                ["Consent preference", "First party", "Remember whether you accept or reject third-party content.", "Technical, necessary", "12 months"],
                ["Language (clp_public_locale)", "First party", "Remember the language you choose for the website. It is only created if you change the language.", "Technical, necessary", "12 months"],
                ["YouTube video (youtube-nocookie.com)", "Google", "Play the video in the “What” section. YouTube may store data so the player works.", "Third party, only if you accept it", "According to Google's policy"],
                ["Team session", "First party", "Keep the study staff's session active. Only in the team area.", "Technical, necessary", "For as long as the session lasts"],
              ],
            },
            p("This website does not use analytics or advertising cookies."),
          ],
        },
        {
          heading: "How to change your choice",
          blocks: [
            p("You can change it at any time from “Cookie settings” in the footer, or delete this site's data from your browser settings."),
          ],
        },
      ],
    },
  ],
};
