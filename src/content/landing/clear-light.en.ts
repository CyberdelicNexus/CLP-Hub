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
    exploreCta: "Apply to the study",
    eligibilityCta: "Requirements to take part",
    contactCta: "Contact the team",
  },
  NAV: [
    { href: "#porque", label: "The study" },
    { href: "#incorporarse", label: "How to take part" },
    { href: "#elegibilidad", label: "Questions" },
  ],
  HERO: {
    eyebrow: "Randomized research study of a group virtual reality experience.",
    headline: "Can an immersive experience transform how we relate to mortality?",
    support:
      "This study investigates how an immersive, shared experience affects the mental health and well-being of people living with a serious illness.",
    reveal: {
      luminousAlt: "Six diffuse presences of blue-violet light arranged in a circle against a dark background.",
      physicalAlt:
        "Six people seated on chairs in a circle in a warm room, each with a Meta Quest 3 headset and two controllers in their hands.",
    },
  },
  WHY: {
    headline: "When a serious illness changes everything.",
    body: "A serious illness can change our relationship with our body, with time, and with the people we love. This study explores whether a shared experience can open a space for presence, connection, and meaning in the face of this natural process.",
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
          alt: "One pair of hands passes a virtual reality headset to another.",
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
          alt: "A laptop with a group video call sharing the presentation “How to prepare for the program?”",
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
        body: "Share your interest through the Qualtrics form. Submitting it does not commit you to take part. In this first questionnaire, you will receive all the information and need to sign the informed consent form. The team must first review your answers to see whether this study is suitable for you.",
        visual: {
          src: "/landing/media/join-responde-v2.webp",
          alt: "A woman answers a questionnaire on a tablet, sitting at the table in her home at dusk.",
        },
      },
      {
        numeral: "02",
        label: "Talk to the team",
        body: "If the study is suitable for you, the team will go over the requirements with you, answer your questions, and explain the study.",
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
    eyebrow: "The study's two groups",
    heading: "Assignment is made at random.",
    body: [
      "This study is a randomized controlled trial: to find out whether a program works, we need to compare. We form two groups of people in similar situations, and chance decides which group each person joins. At the end of the study, we compare how each group is doing.",
      "This helps us distinguish changes caused by the program from those that would have happened anyway. To keep the comparison fair, no one chooses their group.",
    ],
    branches: [
      {
        label: "Program group",
        lines: ["Takes part in the Clear Light program during the study.", "Continues with their usual medical care. Completes the same assessments as the other group."],
        condition: ES.SPLIT.branches[0].condition,
      },
      {
        label: "Comparison group",
        lines: ["Continues with their usual medical care.", "Completes the same assessments as the other group. At the end of their participation, they will be offered an optional PDF with the results and access to Clear Light Solo virtual reality."],
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
    criteriaItems: ["Have a serious or advanced illness.", "Speak Spanish."],
    criteriaText:
      "In the call with the team, we will review together whether the study suits you, according to all the criteria approved for the study.",
    criteria: ES.ELIGIBILITY.criteria,
    registry: ES.ELIGIBILITY.registry,
    investigator: ES.ELIGIBILITY.investigator,
    participantAlt:
      "A person sitting cross-legged on a woven rug, with a virtual reality headset and a controller in each hand; a violet aura surrounds them and a warm light glows at the center of their chest.",
    faq: [
      {
        id: "participar",
        topic: "What taking part involves",
        statements: [
          "The program has several stages: preparation, video call meetings, and virtual reality sessions. We will explain the duration and the schedule to you before you start.",
          "Participation is voluntary.",
        ],
        pending: ES.ELIGIBILITY.faq[0].pending,
      },
      {
        id: "beneficios",
        topic: "Possible benefits and risks",
        statements: [
          "Although previous studies suggest that this experience could be beneficial, personal benefits are not guaranteed: we cannot assure you that taking part will benefit you directly.",
          "Participation is voluntary and will be unpaid.",
          "Before you decide, the team will explain the possible benefits, risks, and discomforts to you in detail.",
        ],
        pending: ES.ELIGIBILITY.faq[1].pending,
      },
      {
        id: "grupos",
        topic: "What each group receives",
        statements: [
          "Assignment is made at random: you cannot choose your group, and the team does not decide it either.",
          "Both groups complete the same assessments throughout the study and continue with their usual medical care.",
          "The program group takes part in Clear Light, and at the end of their participation the comparison group receives a PDF with the results and access to Clear Light Solo.",
        ],
        pending: ES.ELIGIBILITY.faq[2].pending,
      },
      {
        id: "gafas",
        topic: "Using the virtual reality headset",
        statements: [
          "If you are assigned to the program group, a member of the team brings the headset to your home and explains how to use it.",
          "You take part in the entire program from home.",
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
          "To take part, you will need to sign an informed consent form that provides you with all the information.",
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
        ],
        pending: ES.ELIGIBILITY.faq[6].pending,
      },
    ] as readonly FaqItem[],
  },
  PARTNERS: {
    heading: "Collaborating on this study",
    items: [
      { name: ES.PARTNERS.items[0].name, logo: ES.PARTNERS.items[0].logo },
      { name: ES.PARTNERS.items[1].name, logo: ES.PARTNERS.items[1].logo },
      { name: ES.PARTNERS.items[2].name, logo: ES.PARTNERS.items[2].logo },
      { name: ES.PARTNERS.items[3].name, logo: ES.PARTNERS.items[3].logo },
    ],
    funding: {
      heading: "Funded by",
      name: ES.PARTNERS.funding.name,
      logo: ES.PARTNERS.funding.logo,
    },
  },
  INVITATION: {
    heading: "Decide with all the information.",
    support: "Showing interest is not the same as giving consent.",
    qualtricsUrl: ES.INVITATION.qualtricsUrl,
    closed: "The interest questionnaire is not available at the moment.",
    footer: {
      navLabel: "Footer",
      tagline: "Research study on a group virtual reality program.",
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
  APPLY: {
    eyebrow: "Interest questionnaire",
    title: "I want to take part in the study",
    intro:
      "First you leave your contact details, then you complete a short questionnaire on the study's platform. Showing interest does not commit you to taking part.",
    stepsLabel: "What will happen",
    steps: [
      {
        title: "First, your contact details",
        body: "You leave your name, email and phone number so the team can contact you. They are the only details this website keeps.",
      },
      {
        title: "Then, the questionnaire",
        body: "In the questionnaire you read the information about the study, decide whether to give your consent and answer some questions to see whether the study is right for you.",
      },
      {
        title: "Finally, the team gets in touch",
        body: "If you continue in the process, the study team will contact you.",
      },
    ],
    frame: {
      title: "Study interest questionnaire",
      note: "The questionnaire is hosted by Qualtrics, an external service. This website does not collect or store your answers.",
      open: "Open the questionnaire here",
      blocked: "To see the questionnaire here, accept the Qualtrics content.",
      accept: "Accept and open",
      newTab: "Open in a new tab",
      trouble: "Not displaying well, or prefer a full screen?",
    },
    form: {
      title: "Your contact details",
      intro: "We will only use them to contact you about the study. Please do not write anything about your health here.",
      firstName: "First name",
      lastName: "Surname",
      email: "Email",
      phone: "Phone",
      privacyBefore: "I have read the",
      privacyLink: "privacy policy",
      privacyAfter: " and agree that the study team may keep these details to contact me.",
      submit: "Continue to the questionnaire",
      sending: "Saving…",
      done: "Thank you, we have saved your details. Now continue with the questionnaire.",
      matchNote: "In the questionnaire, write your name, email and phone number exactly as you did here, so the team can match the two.",
      errors: {
        required: "This is required.",
        tooLong: "This text is too long.",
        invalidName: "Please check this.",
        invalidEmail: "Please check the email address.",
        invalidPhone: "Please check the phone number.",
        privacy: "To continue, please accept the privacy policy.",
        closed: "The interest questionnaire is not available right now.",
        failed: "We could not save your details. Please try again later.",
      },
    },
    back: "Back to the start",
    meta: {
      title: "I want to take part in the study · Clear Light",
      description:
        "The Clear Light study's interest questionnaire, completed on the study's platform. Showing interest does not commit you to taking part.",
    },
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
    unavailable: "We cannot receive messages right now. Please try again later.",
    sending: "Sending…",
    sentTitle: "Message sent",
    sent: "Thank you for writing to us. The study team will read your message and reply by email.",
    sentNote: "We keep your message only until we reply; after that it is deleted. If you do not find our reply, please check your spam folder too.",
    failed: "We could not send your message. Please try again later.",
    errors: {
      required: "This is required.",
      tooLong: "This text is too long.",
      invalidEmail: "Please check the email address.",
    },
  },
  CONSENT: {
    title: "Cookies and third-party content",
    body: "This website only uses the technical storage it needs to work. If you accept, we can also load the YouTube video and the Qualtrics questionnaire, which may store data in your browser.",
    accept: "Accept",
    reject: "Reject",
    policy: "Cookie policy",
    filmBlocked: "To watch the video, accept the YouTube content.",
    filmAccept: "Accept and play",
  },
  META: {
    title: "Clear Light · Research study",
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
