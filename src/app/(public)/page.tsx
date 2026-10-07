import type { Metadata } from "next";
import { HOLDING_FONT_CLASS } from "@/components/landing/fonts";
import { HOME_COPY } from "@/content/home";
import { PUBLIC_BASE_PATH } from "@/domain/navigation";
import { getPublicLocale } from "@/i18n/public-locale";
import "@/components/landing/scrollcraft.css";
import "@/components/landing/landing.css";

/**
 * Placeholder home page for the domain's root (D-104). The Clear Light site
 * lives under /clearlight; this page only keeps the root from being empty
 * until the organisation has a site of its own to put here.
 */

export async function generateMetadata(): Promise<Metadata> {
  const copy = HOME_COPY[await getPublicLocale()];
  return { title: { absolute: copy.title }, description: copy.body };
}

export default async function HomePage() {
  const locale = await getPublicLocale();
  const copy = HOME_COPY[locale];

  return (
    <main id="main" className={`cl holding ${HOLDING_FONT_CLASS}`} lang={locale}>
      <div>
        <h1 className="cl-title--md">{copy.title}</h1>
        <p className="cl-lead">{copy.body}</p>
        <p>
          {/* Full document load, not <Link>: the landing's scroll engine mounts on page load. */}
          <a href={PUBLIC_BASE_PATH} className="cl-link">
            {copy.study}
          </a>
        </p>
      </div>
    </main>
  );
}
