import type { Metadata } from "next";
import { PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { Meditate } from "@/components/meditate/meditate";
import { MEDITATE_COPY } from "@/content/meditate";
import { parseSettings } from "@/domain/breathing";
import { getPublicLocale } from "@/i18n/public-locale";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";
import "@/components/meditate/meditate.css";

/**
 * The breathing guide (D-120): the home page's light, breathing at a rhythm a
 * facilitator can set, with words, tones, a timer and full screen. Public and
 * stateless; the settings come from the address, so a prepared session is a link.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { meta } = MEDITATE_COPY[await getPublicLocale()];
  return { title: { absolute: meta.title }, description: meta.description };
}

export default async function MeditatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getPublicLocale();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }

  return (
    <div className={`cl ${PUBLIC_FONT_CLASS}`} lang={locale}>
      <Meditate copy={MEDITATE_COPY[locale]} locale={locale} initial={parseSettings(query)} />
    </div>
  );
}
