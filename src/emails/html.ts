/**
 * The Hub's emails in the Clear Light site's style (D-119), as HTML strings.
 *
 * Why strings and not React Email components: rendering React to HTML needs
 * `react-dom/server`, which Next.js refuses inside the server code that sends
 * these emails (server actions, the webhook, the processor) — "react-dom/server
 * is not supported in React Server Components". Plain functions work in all of
 * them, in scripts and in tests, with nothing to bundle.
 *
 * Email-safe by construction, following the email-best-practices skill: one
 * centred 560px table, inline styles only, no flexbox, grid or media queries,
 * a hidden preview line, `lang`, a single heading, presentation tables, and
 * text contrast above 4.5:1 on the dark surface. Every value from outside
 * (a reply, a question, a template body) goes through `esc`, so nothing a
 * person typed can become markup.
 *
 * Pure: no environment, no I/O. `render.ts` supplies URLs and the logo.
 */

import type { InquiryLocale } from "@/domain/inquiry-mail";

/** The landing page's tokens (`src/components/landing/landing.css`). */
export const EMAIL = {
  canvas: "#000000",
  surface: "#0f1322",
  surfaceSoft: "#151a2b",
  line: "#262c3a",
  ink: "#f2f5ef",
  inkSoft: "#c3cbc6",
  muted: "#8f9ba4",
  accent: "#b79cff",
  accentStrong: "#d3c2ff",
  accentInk: "#170c30",
  gradient: "linear-gradient(90deg,#cdb9ff 0%,#a888f6 48%,#dba8ee 100%)",
  font: "Manrope,'Segoe UI',Helvetica,Arial,sans-serif",
} as const;

export const LOGO_CID = "clear-light-logo";

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const URL_PATTERN = /(https:\/\/[^\s<>"')]+)/g;

/** Escaped text with https links made clickable. */
function linkify(line: string): string {
  return line
    .split(URL_PATTERN)
    .map((part, i) =>
      i % 2 === 1
        ? `<a href="${esc(part)}" style="color:${EMAIL.accentStrong};text-decoration:underline;word-break:break-all;">${esc(part)}</a>`
        : esc(part),
    )
    .join("");
}

/** Blank-line paragraphs, line breaks kept, links clickable. */
export function richText(text: string, color: string = EMAIL.inkSoft): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:${color};font-size:15px;line-height:24px;">${p
          .split("\n")
          .map(linkify)
          .join("<br>")}</p>`,
    )
    .join("");
}

function footerLine(html: string): string {
  return `<p style="margin:0 0 6px;color:${EMAIL.muted};font-size:12px;line-height:18px;">${html}</p>`;
}

function link(href: string, label: string): string {
  return `<a href="${esc(href)}" style="color:${EMAIL.accentStrong};text-decoration:underline;">${esc(label)}</a>`;
}

function heading(text: string, size = 24): string {
  return `<h1 style="margin:0 0 14px;color:${EMAIL.ink};font-size:${size}px;line-height:${size + 6}px;font-weight:600;letter-spacing:-0.02em;font-family:${EMAIL.font};">${esc(text)}</h1>`;
}

function button(href: string, label: string): string {
  // A table cell button: holds its padding and colour in Outlook too.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;"><tr><td style="border-radius:999px;background-color:${EMAIL.accent};"><a href="${esc(href)}" style="display:inline-block;padding:12px 24px;border-radius:999px;color:${EMAIL.accentInk};font-size:14px;font-weight:600;text-decoration:none;font-family:${EMAIL.font};">${esc(label)}</a></td></tr></table>`;
}

/**
 * The shared frame: the gradient line, the logo and name, the content, a
 * quieter footer. `logoSrc` is `cid:…` when sent (the logo travels inline, so
 * it shows where remote images are blocked) or a data URI for a preview.
 */
export function layout(params: {
  lang: string;
  title: string;
  preview: string;
  eyebrow: string;
  content: string;
  footer: string;
  logoSrc?: string;
}): string {
  const logoSrc = params.logoSrc ?? `cid:${LOGO_CID}`;
  // Pads the preview so the inbox does not pull body text in after it.
  const previewPad = "&#847;&zwnj;&nbsp;".repeat(40);
  return `<!DOCTYPE html>
<html lang="${esc(params.lang)}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${EMAIL.canvas};">${esc(params.preview)}${previewPad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL.canvas};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${EMAIL.surface};border:1px solid ${EMAIL.line};border-radius:16px;font-family:${EMAIL.font};">
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:${EMAIL.accent};background-image:${EMAIL.gradient};border-radius:16px 16px 0 0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="width:56px;vertical-align:middle;"><img src="${esc(logoSrc)}" width="44" height="44" alt="Clear Light" style="display:block;border:0;"></td>
<td style="vertical-align:middle;">
<p style="margin:0;color:${EMAIL.ink};font-size:17px;line-height:22px;font-weight:600;letter-spacing:-0.01em;">Clear Light</p>
<p style="margin:2px 0 0;color:${EMAIL.accentStrong};font-size:11px;line-height:14px;letter-spacing:0.12em;text-transform:uppercase;">${esc(params.eyebrow)}</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px 20px;">${params.content}</td></tr>
<tr><td style="padding:18px 32px 22px;border-top:1px solid ${EMAIL.line};background-color:${EMAIL.surfaceSoft};border-radius:0 0 16px 16px;">${params.footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// The three emails
// ---------------------------------------------------------------------------

/**
 * To the staff who answer inquiries and the team mailbox. It still says nothing
 * about WHAT was asked or by whom (D-088): the question is read in the Hub.
 */
export function staffNoticeHtml(params: { count: number; inboxUrl: string | null; logoSrc?: string }): string {
  const { count, inboxUrl } = params;
  const title = count === 1 ? "Ha llegado una consulta nueva" : `Hay ${count} consultas sin responder`;
  const lead =
    count === 1
      ? "Alguien ha escrito al estudio, desde la web o por email a info@."
      : "Hay varias personas esperando respuesta, desde la web o por email a info@.";
  return layout({
    lang: "es",
    title,
    preview: `${title}. Léela y respóndela en el Hub.`,
    eyebrow: "Hub del equipo",
    logoSrc: params.logoSrc,
    content:
      heading(title) +
      richText(`${lead} Léela y respóndela en Consultas: tu respuesta le llega por email.`) +
      (inboxUrl ? button(inboxUrl, "Abrir Consultas") : ""),
    footer:
      footerLine("Este aviso no incluye la pregunta a propósito: puede contener datos personales, y se lee solo en el Hub.") +
      footerLine("Lo recibes porque respondes consultas del estudio o es el buzón del equipo."),
  });
}

const REPLY_COPY: Record<InquiryLocale, { title: string; eyebrow: string; yourQuestion: string; footer: string; site: string }> = {
  es: {
    title: "Respuesta a tu consulta",
    eyebrow: "Estudio de investigación",
    yourQuestion: "Tu consulta",
    footer: "Puedes responder a este correo si tienes más dudas.",
    site: "Más información sobre el estudio",
  },
  en: {
    title: "Reply to your question",
    eyebrow: "Research study",
    yourQuestion: "Your question",
    footer: "You can reply to this email if you have more questions.",
    site: "More about the study",
  },
  gl: {
    title: "Resposta á túa consulta",
    eyebrow: "Estudo de investigación",
    yourQuestion: "A túa consulta",
    footer: "Podes responder a este correo se tes máis dúbidas.",
    site: "Máis información sobre o estudo",
  },
};

/** To the person who asked. Their question is quoted, since the Hub keeps no copy. */
export function inquiryReplyHtml(params: {
  locale: InquiryLocale;
  reply: string;
  question: string;
  siteUrl: string | null;
  logoSrc?: string;
}): string {
  const c = REPLY_COPY[params.locale];
  const quote = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr><td style="padding:14px 16px 2px;background-color:${EMAIL.surfaceSoft};border-left:3px solid ${EMAIL.accent};border-radius:8px;">
<p style="margin:0 0 8px;color:${EMAIL.accentStrong};font-size:11px;line-height:14px;letter-spacing:0.12em;text-transform:uppercase;">${esc(c.yourQuestion)}</p>
${richText(params.question, EMAIL.muted)}
</td></tr></table>`;
  return layout({
    lang: params.locale,
    title: c.title,
    preview: params.reply.replace(/\s+/g, " ").slice(0, 110),
    eyebrow: c.eyebrow,
    logoSrc: params.logoSrc,
    content: heading(c.title, 22) + richText(params.reply, EMAIL.ink) + quote,
    footer: footerLine(esc(c.footer)) + (params.siteUrl ? footerLine(link(params.siteUrl, c.site)) : ""),
  });
}

/**
 * An automatic email to a participant (D-116): the study's own template,
 * rendered, in the study's frame. Spanish, like every participant message.
 */
export function participantMessageHtml(params: {
  subject: string;
  body: string;
  siteUrl: string | null;
  logoSrc?: string;
}): string {
  return layout({
    lang: "es",
    title: params.subject,
    preview: params.body.replace(/\s+/g, " ").slice(0, 110),
    eyebrow: "Estudio de investigación",
    logoSrc: params.logoSrc,
    content: heading(params.subject, 22) + richText(params.body),
    footer:
      footerLine("Recibes este mensaje porque participas en el estudio Clear Light.") +
      footerLine("Si tienes dudas, responde a este correo y te contestará el equipo.") +
      (params.siteUrl ? footerLine(link(params.siteUrl, "Información del estudio")) : ""),
  });
}
