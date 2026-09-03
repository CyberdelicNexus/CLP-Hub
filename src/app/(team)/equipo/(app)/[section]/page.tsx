import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { ComingSoon } from "@/components/team/coming-soon";
import { NoAccess } from "@/components/team/no-access";
import { sectionByPath } from "@/domain/navigation";

type Params = { section: string };

/**
 * Placeholder for every dashboard section until its phase lands.
 * Real sections are added as static routes, which take precedence over
 * this dynamic segment, so stubs disappear naturally.
 */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { section } = await params;
  const nav = sectionByPath(section);
  if (!nav) return {};
  const t = await getTranslations("nav");
  return { title: t(nav.key) };
}

export default async function SectionStubPage({ params }: { params: Promise<Params> }) {
  const { section } = await params;
  const nav = sectionByPath(section);
  if (!nav || nav.path === "") notFound();

  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  const allowed = nav.permissions.length === 0 || nav.permissions.some((p) => ctx.permissions.has(p));
  if (!allowed) return <NoAccess message={t("common.noAccess")} />;

  return (
    <ComingSoon
      title={t(`nav.${nav.key}`)}
      badge={t("common.comingSoon")}
      description={t("common.comingSoonDescription")}
    />
  );
}
