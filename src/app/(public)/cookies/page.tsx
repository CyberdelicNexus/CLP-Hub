import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page";
import { LEGAL_COPY } from "@/content/landing/copy";
import { legalPage } from "@/content/landing/legal";
import { getPublicLocale } from "@/i18n/public-locale";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

export async function generateMetadata(): Promise<Metadata> {
  const page = legalPage("cookies", LEGAL_COPY[await getPublicLocale()]);
  return { title: { absolute: `${page.title} · aNUma Clear Light` }, description: page.description };
}

export default function CookiesPage() {
  return <LegalPageView slug="cookies" />;
}
