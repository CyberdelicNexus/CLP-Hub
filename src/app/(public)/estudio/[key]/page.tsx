import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ContentBlocks } from "@/components/content/blocks";
import { CoverImage } from "@/components/content/cover-image";
import { CONTENT_KEY_PATTERN } from "@/domain/content";
import { parseLocale } from "@/domain/locale";
import { getPublishedByKey } from "@/services/content";

/**
 * A standalone public study page, e.g. /estudio/preparacion-vr or /estudio/ayuda.
 *
 * Only PUBLISHED content of a web-publishable type resolves here: a draft is
 * invisible, and a message template can never be reached as a page. The output
 * is the same for every reader.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  if (!CONTENT_KEY_PATTERN.test(key)) return {};
  const locale = parseLocale(await getLocale());
  const page = await getPublishedByKey({ key, locale });
  return page ? { title: page.title } : {};
}

export default async function StudyPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // Reject anything that is not a well-formed key before touching the database.
  if (!CONTENT_KEY_PATTERN.test(key)) notFound();

  const locale = parseLocale(await getLocale());
  const page = await getPublishedByKey({ key, locale });
  if (!page) notFound();

  const t = await getTranslations("public.study");

  return (
    <article className="flex flex-col">
      <CoverImage url={page.coverImageUrl} position={page.coverImagePosition} variant="hero" />
      {/* pt-20 clears the floating back-link/theme-toggle header when there's
          no cover to push content below it (see layout.tsx); when there IS a
          cover, its own height already does that, and this just adds a
          little breathing room before the title. pr-14 (vs. pl-4) reserves
          room below `sm:` for the fixed AccessibilityToolbar riding the
          right edge, so a wide block (e.g. a callout) never runs under it —
          from `sm:` up the column has margin to spare either side already. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pt-20 pr-14 pb-10 pl-4 sm:px-6 sm:pb-14">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {page.title}
          </h1>
          <p data-numeric className="text-xs text-muted-foreground">
            {t("updated", { date: formatDate(page.updatedAt) })}
          </p>
        </header>

        {/* text-lg: this audience skews older adult (2026-09-19 request) —
            the 1rem default read too small for a page meant to be read once
            and acted on, not skimmed. */}
        <div className="text-lg">
          <ContentBlocks body={page.body} />
        </div>
      </div>
    </article>
  );
}

/** Study pages are Spanish-first and published for a Spanish audience. */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(value);
}
