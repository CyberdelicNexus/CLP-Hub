/**
 * The two emails an inquiry can cause (D-088), as pure text so they can be
 * tested. Neither is scheduled or rule-driven: one is sent when a visitor
 * submits a question, the other when a person presses "send reply".
 */

export type InquiryLocale = "es" | "en" | "gl";

/**
 * To the staff who answer inquiries. It deliberately says nothing about WHAT
 * was asked or by whom: a mailbox is a worse place for a possible health detail
 * than the Hub, so the question is read in the Hub only.
 */
export function staffNotification(params: { count: number; inboxUrl: string | null }): { subject: string; text: string } {
  const { count, inboxUrl } = params;
  const lines = [
    count === 1
      ? "Ha llegado una consulta nueva desde la web de Clear Light."
      : `Hay ${count} consultas nuevas sin responder en el Hub.`,
    "",
    inboxUrl ? `Léela y respóndela en el Hub: ${inboxUrl}` : "Léela y respóndela en el Hub, en Consultas.",
    "",
    "Este aviso no incluye la pregunta a propósito: puede contener datos personales.",
  ];
  return { subject: "Nueva consulta en el Hub de Clear Light", text: lines.join("\n") };
}

const REPLY_COPY: Record<InquiryLocale, { subject: string; yourQuestion: string; footer: string }> = {
  es: {
    subject: "Respuesta a tu consulta sobre el estudio Clear Light",
    yourQuestion: "Tu consulta:",
    footer: "Puedes responder a este correo si tienes más dudas.",
  },
  en: {
    subject: "Reply to your question about the Clear Light study",
    yourQuestion: "Your question:",
    footer: "You can reply to this email if you have more questions.",
  },
  gl: {
    subject: "Resposta á túa consulta sobre o estudo Clear Light",
    yourQuestion: "A túa consulta:",
    footer: "Podes responder a este correo se tes máis dúbidas.",
  },
};

/** To the person who asked. Their own question is quoted, since the Hub keeps no copy. */
export function replyEmail(params: {
  locale: InquiryLocale;
  reply: string;
  question: string;
}): { subject: string; text: string } {
  const c = REPLY_COPY[params.locale];
  const quoted = params.question
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join("\n");
  return {
    subject: c.subject,
    text: [params.reply.trim(), "", "--", c.footer, "", c.yourQuestion, quoted].join("\n"),
  };
}
