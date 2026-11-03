import { WHATSAPP_BUTTON_COPY, whatsappChatUrl } from "@/content/contact";
import { getPublicLocale } from "@/i18n/public-locale";

/**
 * Floating "write to us on WhatsApp" button for the Clear Light pages (D-138,
 * Joana's proposal: many participants, older people especially, read WhatsApp
 * and not email). A plain link to wa.me: no script, no tracking, nothing sent
 * until the person presses send in WhatsApp. Icon only on phones, icon and a
 * short label from `sm` up. The green is darker than WhatsApp's own so the
 * white label passes 4.5:1 (#0E7A6E, 5.2:1).
 */
export async function WhatsAppButton() {
  const copy = WHATSAPP_BUTTON_COPY[await getPublicLocale()];

  return (
    <a
      href={whatsappChatUrl(copy.prefill)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.label}
      title={copy.label}
      className="fixed right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#0E7A6E] p-3.5 text-white shadow-lg shadow-black/20 transition-[transform,background-color] hover:bg-[#0B6E5F] focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-95 motion-reduce:transition-none sm:right-6 sm:px-5 sm:py-3 print:hidden"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-7 shrink-0 fill-current sm:size-6">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.47A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.04c0 2 .52 3.95 1.52 5.67L.6 23.6l6.04-1.58a11.3 11.3 0 0 0 5.4 1.38h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02" />
      </svg>
      <span className="hidden text-sm font-semibold sm:inline">{copy.short}</span>
    </a>
  );
}
