import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page";
import { legalPage } from "@/content/landing/legal";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

const page = legalPage("aviso-legal");

export const metadata: Metadata = { title: { absolute: `${page.title} · aNUma Clear Light` }, description: page.description };

export default function AvisoLegalPage() {
  return <LegalPageView slug="aviso-legal" />;
}
