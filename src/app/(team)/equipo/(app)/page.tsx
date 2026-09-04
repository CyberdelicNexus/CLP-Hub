import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team.overview");
  return { title: t("title") };
}

/**
 * "Resumen" home. Phase 0 renders the structure with honest empty states:
 * no counts are invented until the underlying phases exist. The accent surface
 * on each tile is decoration only — it never encodes a value or a status.
 */

const STATS = [
  { key: "applications", surface: "bg-surface-lilac text-surface-lilac-ink" },
  { key: "screeningPending", surface: "bg-surface-peach text-surface-peach-ink" },
  { key: "eligible", surface: "bg-surface-sky text-surface-sky-ink" },
  { key: "enrolled", surface: "bg-surface-mint text-surface-mint-ink" },
] as const;

export default async function OverviewPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null; // layout already handled this case
  const t = await getTranslations("team.overview");
  const tStatus = await getTranslations("status.study");
  const tRoles = await getTranslations("roles");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {ctx.study.code}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{ctx.study.title}</h1>
        </div>
        <StatusBadge tone={studyTone(ctx.study.status)}>{tStatus(ctx.study.status)}</StatusBadge>
      </header>

      <section aria-label={t("title")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ key, surface }) => (
          <Card key={key} className="transition-shadow duration-200 hover:shadow-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t(`stats.${key}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-3">
              {/* No value exists yet: show a dash, never a fabricated number. */}
              <p data-numeric className="text-3xl font-semibold text-muted-foreground">
                —
              </p>
              <span className={`rounded-md px-2 py-0.5 text-[0.7rem] font-medium ${surface}`}>
                {t("noData")}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("today")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("todayEmpty")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("attention")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("attentionEmpty")}</p>
          </CardContent>
        </Card>
      </div>

      <footer className="space-y-1 text-xs text-muted-foreground">
        <p>{ctx.roles.map((r) => tRoles(r)).join(" · ")}</p>
        <p>{t("foundationNote")}</p>
      </footer>
    </div>
  );
}

function studyTone(status: string): "neutral" | "success" | "warning" | "info" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PAUSED":
      return "warning";
    case "DRAFT":
      return "info";
    default:
      return "neutral";
  }
}
