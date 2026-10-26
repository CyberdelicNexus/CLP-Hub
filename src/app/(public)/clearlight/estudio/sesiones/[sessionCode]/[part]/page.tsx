import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentBlocks } from "@/components/content/blocks";
import { CoverImage } from "@/components/content/cover-image";
import type { ContentType } from "@/domain/content";
import { StudyLanguageLinks } from "@/components/content/language-links";
import { STUDY_PAGE_COPY } from "@/content/study-pages";
import { getPublicLocale } from "@/i18n/public-locale";
import { getPublishedForSession, inReadersLanguage } from "@/services/content";

/**
 * Session preparation and integration pages, e.g.
 * /estudio/sesiones/demo_intro/preparacion
 *
 * The URL names a session from the study's programme, never a cohort and never
 * a participant: two people in different cohorts read exactly the same page.
 * Which version a given cohort was pinned to is recorded internally
 * (content_assignments) and is not expressed in the URL.
 */

const PARTS: Record<string, Extract<ContentType, "SESSION_PREPARATION" | "SESSION_INTEGRATION">> = {
  preparacion: "SESSION_PREPARATION",
  integracion: "SESSION_INTEGRATION",
};

const SESSION_CODE_PATTERN = /^[a-z][a-z0-9_-]{1,48}$/;

type Params = { sessionCode: string; part: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { sessionCode, part } = await params;
  const type = PARTS[part];
  if (!type || !SESSION_CODE_PATTERN.test(sessionCode)) return {};
  const locale = await getPublicLocale();
  const found = await inReadersLanguage(locale, (l) => getPublishedForSession({ sessionCode, type, locale: l }));
  return found ? { title: found.page.title } : {};
}

export default async function SessionContentPage({ params }: { params: Promise<Params> }) {
  const { sessionCode, part } = await params;
  const type = PARTS[part];
  if (!type || !SESSION_CODE_PATTERN.test(sessionCode)) notFound();

  // The reader's language (D-135), else the Spanish page with a note saying so.
  const locale = await getPublicLocale();
  const found = await inReadersLanguage(locale, (l) => getPublishedForSession({ sessionCode, type, locale: l }));
  if (!found) notFound();
  const { page, shown } = found;
  const copy = STUDY_PAGE_COPY[locale];

  return (
    <article className="flex flex-col">
      <CoverImage url={page.coverImageUrl} position={page.coverImagePosition} variant="hero" />
      {/* pt-20: see [key]/page.tsx's identical wrapper for why. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-20 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StudyLanguageLinks
            locale={locale}
            from={`/estudio/sesiones/${sessionCode}/${part}`}
            label={copy.language}
          />
          {shown !== locale ? (
            <p role="status" lang={locale} className="text-sm text-muted-foreground">
              {copy.fallback}
            </p>
          ) : null}
        </div>
        <header className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {page.sessionName} · {copy.part[part as keyof typeof copy.part]}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {page.title}
          </h1>
        </header>

        {/* text-[1.125em] (== text-lg's 1.125rem at the default root size): this
            audience skews older adult (2026-09-19 request) — the 1rem default
            read too small for a page meant to be read once and acted on, not
            skimmed. Uses an em value rather than text-lg's rem so it compounds
            with AccessibilityToolbar's own em-based text-size multiplier
            (src/components/accessibility-toolbar.tsx) instead of overriding it —
            text-lg silently defeated that toggle for all of this page's body
            content (2026-09-29 finding). */}
        <div lang={shown} className="text-[1.125em]">
          <ContentBlocks body={page.body} />
        </div>
      </div>
    </article>
  );
}
