import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page";
import { LEGAL_COPY } from "@/content/landing/copy";
import { legalPage } from "@/content/landing/legal";
import { getPublicLocale } from "@/i18n/public-locale";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

export async function generateMetadata(): Promise<Metadata> {
  const page = legalPage("aviso-legal", LEGAL_COPY[await getPublicLocale()]);
  return { title: { absolute: `${page.title} · Clear Light` }, description: page.description };
}

export default function AvisoLegalPage() {
  return <LegalPageView slug="aviso-legal" />;
}
