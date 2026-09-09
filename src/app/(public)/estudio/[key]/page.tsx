import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ContentBlocks } from "@/components/content/blocks";
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
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {page.title}
        </h1>
        <p data-numeric className="text-xs text-muted-foreground">
          {t("updated", { date: formatDate(page.updatedAt) })}
        </p>
      </header>

      <ContentBlocks body={page.body} />
    </article>
  );
}

/** Study pages are Spanish-first and published for a Spanish audience. */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(value);
}
