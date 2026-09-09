import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ContentBlocks } from "@/components/content/blocks";
import type { ContentType } from "@/domain/content";
import { parseLocale } from "@/domain/locale";
import { getPublishedForSession } from "@/services/content";

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
  const locale = parseLocale(await getLocale());
  const page = await getPublishedForSession({ sessionCode, type, locale });
  return page ? { title: page.title } : {};
}

export default async function SessionContentPage({ params }: { params: Promise<Params> }) {
  const { sessionCode, part } = await params;
  const type = PARTS[part];
  if (!type || !SESSION_CODE_PATTERN.test(sessionCode)) notFound();

  const locale = parseLocale(await getLocale());
  const page = await getPublishedForSession({ sessionCode, type, locale });
  if (!page) notFound();

  const t = await getTranslations("public.study");

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {page.sessionName} · {t(`part.${part}`)}
        </p>
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

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(value);
}
