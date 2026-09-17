/**
 * English translation of clear-light.ts (D-063).
 *
 * STATUS: working draft, published at the founder's direction without native
 * editorial or ethics review. Spanish is the source text: the shape, the
 * `Missing` markers (reused by reference) and every `href`, `src` and `id` must
 * match clear-light.ts.
 */

import { LANDING_ES as ES, type FaqItem, type LandingCopy, type Stage } from "@/content/landing/clear-light";

export const LANDING_EN: LandingCopy = {
  ACTIONS: {
    primaryCta: "Check if I can take part",
    exploreCta: "Learn about the study",
    contactCta: "Contact the team",
  },
  NAV: [
    { href: "#porque", label: "The study" },
    { href: "#incorporarse", label: "Taking part" },
    { href: "#elegibilidad", label: "Questions" },
  ],
  HERO: {
    eyebrow: "Research study · Shared virtual reality",
    headline: "Can an immersive experience transform how we relate to mortality?",
    support:
      "This study investigates whether it is possible to reduce anxiety about death and increase acceptance of this universal process.",
    reveal: {
      luminousAlt: "Seven diffuse presences of blue-violet light, seated in a shallow arc against a dark background.",
      physicalAlt:
        "Seven people seated in a circle in a warm room, each with a Meta Quest 3 headset and two controllers in their hands.",
    },
  },
  WHY: {
    headline: "Looking directly at what transforms us.",
    body: "A life-threatening illness can change our relationship with our body, with time, and with the people we love. This study explores whether a shared experience can open a space for presence, connection, and meaning.",
  },
  WHAT: {
    headline: "A guided experience to explore together.",
    body: "Clear Light is an experiential small-group program. It combines preparation, video call meetings, and immersive virtual reality sessions to explore life, identity, impermanence, and connection.",
    facts: ["Small group", "Human support", "Guided virtual reality"],
    film: {
      label: "A look at the project",
      play: "Play the video",
      posterAlt:
        "A person sitting cross-legged against a blue background, with a virtual reality headset and a controller in each hand; a warm light in their chest.",
      captions: ES.WHAT.film.captions,
    },
  },
  STAGES: {
    heading: "Program stages",
    intro: "A progressive experience to prepare, explore, share, and integrate.",
    approval: ES.STAGES.approval,
    items: [
      {
        code: "S0",
        name: "Preparation",
        description: "Getting ready, technically and personally, before starting.",
        media: {
          src: "/landing/media/etapa-s0.webp",
          width: 1536,
          height: 1024,
          alt: "A laptop with a group video call sharing the presentation “How to prepare for the program?”",
        },
      },
      {
        code: "S1",
        name: "Orientation",
        description: "The group gets to know one another and places the experience in context.",
        media: {
          src: "/landing/media/etapa-s1.webp",
          width: 1536,
          height: 1024,
          alt: "One pair of hands passes a virtual reality headset to another.",
        },
      },
      {
        code: "S2",
        name: "Bodies of Light",
        description: "Exploring how it feels to inhabit a form made of light.",
        media: {
          src: "/landing/media/etapa-s2-v4.webp",
          width: 3632,
          height: 2048,
          alt: "A woman with a warm light in her chest and palms, wrapped in an outline of violet light.",
        },
      },
      {
        code: "S3",
        name: "Life",
        description: "Going through your own story with attention and self-compassion.",
        media: {
          src: "/landing/media/etapa-s3.webp",
          width: 1915,
          height: 821,
          alt: "A film strip with scenes from a life: a baby's hand, children's sneakers, a notebook, some keys, and an elderly hand.",
        },
      },
      {
        code: "S4",
        name: "Beyond the Body",
        description: "Reflecting on the self, the body, and reality.",
        media: {
          src: "/landing/media/etapa-s4.webp",
          width: 1376,
          height: 768,
          alt: "A seated woman wearing a virtual reality headset, with a form of violet light rising beside her.",
        },
      },
      {
        code: "S5",
        name: "Offering",
        description: "Letting go, giving thanks, and offering something meaningful to the group.",
        media: {
          src: "/landing/media/etapa-s5.webp",
          width: 1536,
          height: 1024,
          alt: "A person seated at the center of a circle of bodies of violet light, holding a light in their hands.",
        },
      },
      {
        code: "S6",
        name: "Group Integration",
        description: "Making sense of what you have lived through and sharing what remains.",
        media: {
          src: "/landing/media/etapa-s6.webp",
          width: 1536,
          height: 1024,
          alt: "A man takes part in a video call with the group from his laptop.",
        },
      },
    ] as readonly Stage[],
  },
  JOIN: {
    heading: "How to join the study",
    steps: [
      {
        numeral: "01",
        label: "Answer the questionnaire",
        body: "Share your interest through the Qualtrics form. Sending it does not commit you to take part.",
        visual: {
          src: "/landing/media/join-responde-v2.webp",
          alt: "A woman answers a questionnaire on a tablet, sitting at the table in her home at dusk.",
        },
      },
      {
        numeral: "02",
        label: "Talk to the team",
        body: "The team will go over the requirements with you, answer your questions, and explain the study.",
        visual: {
          src: "/landing/media/join-habla.webp",
          alt: "A woman talks with a professional by video call from a laptop in her home.",
        },
      },
      {
        numeral: "03",
        label: "Assignment to your cohort",
        body: "If you are selected, we will assign you to a study cohort and arrange a visit to give you the virtual reality headset and explain how to use it.",
        visual: {
          src: "/landing/media/join-recibe.webp",
          alt: "A team member, at the door of a home, hands over a virtual reality headset in its case.",
        },
      },
    ],
    supporting: "Showing interest does not commit you to take part.",
  },
  SPLIT: {
    eyebrow: "Why there are two groups",
    heading: "Assignment is made at random.",
    body: [
      "This study is a randomized controlled trial. We form two similar groups: one takes part in the Clear Light program and the other in a similar experience. At the end, we compare how each group is doing.",
      "This way we can tell which changes are due to the program and not to other factors. To keep the comparison fair, no one chooses their group: chance decides.",
    ],
    branches: [
      {
        label: "Program group",
        lines: ["Takes part in the Clear Light program.", "Shows us what changes with the experience."],
        condition: ES.SPLIT.branches[0].condition,
      },
      {
        label: "Control group",
        lines: ["Receives a similar experience for comparison.", "Lets us measure the results rigorously."],
        condition: ES.SPLIT.branches[1].condition,
      },
    ],
    labels: ES.SPLIT.labels,
    supporting: "Both groups are equally important to the study.",
  },
  ELIGIBILITY: {
    heading: "Could this study be for me?",
    intro: "Eligibility is confirmed with the team. Here you can review the approved criteria and the most frequently asked questions.",
    criteriaHeading: "Participation criteria",
    criteriaItems: ["Have a life-threatening illness.", "Speak Spanish."],
    criteriaText:
      "In the call with the team, we will review together whether the study suits you, according to all the criteria approved for the study.",
    criteria: ES.ELIGIBILITY.criteria,
    requiredLine: "Personal benefits are not guaranteed.",
    registry: ES.ELIGIBILITY.registry,
    investigator: ES.ELIGIBILITY.investigator,
    participantAlt:
      "A person sitting cross-legged on a woven rug, with a virtual reality headset and a controller in each hand; a violet aura surrounds them and a warm light glows at the center of their chest.",
    faq: [
      {
        id: "participar",
        topic: "What taking part involves",
        statements: [
          "The program has seven stages: preparation, video call meetings, and virtual reality sessions. We will explain the duration and the schedule to you before you start.",
          "Participation is voluntary.",
        ],
        pending: ES.ELIGIBILITY.faq[0].pending,
      },
      {
        id: "beneficios",
        topic: "Possible benefits and risks",
        statements: [
          "You are not expected to get any direct benefit from taking part in the study. Participation is voluntary and will be unpaid.",
          "The research aims to uncover unknown or unclear aspects of the potential of using virtual reality for mental health and well-being in people diagnosed with a life-threatening illness. This information may be useful to other people in the future.",
          "Before you decide, the team will explain the possible benefits, risks, and discomforts to you in detail.",
        ],
        pending: ES.ELIGIBILITY.faq[1].pending,
      },
      {
        id: "grupos",
        topic: "What each group receives",
        statements: [
          "Assignment is made at random. You cannot choose your group.",
          "The program group takes part in Clear Light. The control group receives a similar experience so the groups can be compared.",
        ],
        pending: ES.ELIGIBILITY.faq[2].pending,
      },
      {
        id: "gafas",
        topic: "Using the virtual reality headset",
        statements: [
          "A member of the team brings the headset to your home and explains how to use it.",
          "If you have questions during the study, the team helps you.",
        ],
        pending: ES.ELIGIBILITY.faq[3].pending,
      },
      {
        id: "retirada",
        topic: "Voluntary participation and withdrawal",
        statements: [
          "You can ask questions before you decide.",
          "You can leave the study at any time, without having to give a reason.",
        ],
        pending: ES.ELIGIBILITY.faq[4].pending,
      },
      {
        id: "datos",
        topic: "Confidentiality and data protection",
        statements: [
          "Your personal data will be handled confidentially and only for the purposes of the study.",
          "The team identifies each participant by a code, not by name. Questionnaire responses are stored in systems approved by the institution, separate from your contact details.",
          "You can ask to access, correct, or delete your data, and withdraw your consent at any time. You will find the details in the privacy policy and in the consent information.",
        ],
        pending: ES.ELIGIBILITY.faq[5].pending,
      },
      {
        id: "contacto",
        topic: "Contact and study registry",
        statements: [
          "When you complete the questionnaire, the team will get in touch with you.",
          "We will publish the study registry entry and the contact details here.",
        ],
        pending: ES.ELIGIBILITY.faq[6].pending,
      },
    ] as readonly FaqItem[],
  },
  INVITATION: {
    heading: "Decide with all the information.",
    support: "Showing interest is not the same as giving consent.",
    qualtricsUrl: ES.INVITATION.qualtricsUrl,
    closed: "The interest questionnaire is not available at the moment.",
    footer: {
      navLabel: "Footer",
      tagline: "Research study on a group virtual reality experience.",
      groups: [
        {
          heading: "The study",
          links: [
            { href: "#porque", label: "Study information" },
            { href: "#elegibilidad", label: "Frequently asked questions" },
            { href: "#contacto", label: "Contact" },
          ],
        },
        {
          heading: "Legal",
          links: [
            { href: "/aviso-legal", label: "Legal notice and terms of use" },
            { href: "/privacidad", label: "Privacy policy" },
            { href: "/cookies", label: "Cookie policy" },
          ],
        },
      ],
      cookieSettings: "Cookie settings",
      still: { pause: "Pause animation", resume: "Resume animation" },
      note: "Recruitment material in preparation. The final information will be published once it is approved.",
      privacy: ES.INVITATION.footer.privacy,
      version: ES.INVITATION.footer.version,
    },
    arcAlt: "An arc of six bodies of bluish light with a small orange fire at the center, against a dark background.",
  },
  CONTACT: {
    title: "Contact the team",
    intro: "Write to us if you have questions about the study.",
    name: "Name",
    email: "Email",
    message: "Message",
    healthNote: "Please do not include information about your health in the message.",
    privacyBefore: "We will use this information only to reply to you. See the",
    privacyLink: "privacy policy",
    submit: "Send message",
    close: "Close",
    unavailable: "Sending messages will be available soon. Your message has not been sent or saved.",
    destination: ES.CONTACT.destination,
  },
  CONSENT: {
    title: "Cookies and third-party content",
    body: "This website only uses the technical storage it needs to work. If you accept, we can also load the YouTube video, which may store data in your browser.",
    accept: "Accept",
    reject: "Reject",
    policy: "Cookie policy",
    filmBlocked: "To watch the video, accept the YouTube content.",
    filmAccept: "Accept and play",
  },
  META: {
    title: "aNUma Clear Light · Research study",
    description:
      "Research study with random assignment on a group virtual reality experience. Public information for people who are interested.",
  },
  LANGUAGE: {
    label: "Language",
  },
  HOLDING: {
    title: "Site in preparation",
    body: "The public information about the study will be published once it is approved.",
  },
};
