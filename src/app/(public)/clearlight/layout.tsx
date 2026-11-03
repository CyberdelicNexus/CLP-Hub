import { WhatsAppButton } from "@/components/whatsapp-button";

/**
 * Frame for every Clear Light page (landing, /participar, legal pages and the
 * study pages): only the floating WhatsApp button (D-138). Each page keeps its
 * own header; /estudio adds its own layout inside this one.
 */
export default function ClearLightLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <WhatsAppButton />
    </>
  );
}
