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
 * no counts are invented until the underlying phases exist.
 */
export default async function OverviewPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null; // layout already handled this case
  const t = await getTranslations("team.overview");
  const tStatus = await getTranslations("status.study");
  const tRoles = await getTranslations("roles");

  const stats = ["applications", "screeningPending", "eligible", "enrolled"] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ctx.study.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{ctx.study.title}</h1>
        </div>
        <StatusBadge tone={studyTone(ctx.study.status)}>{tStatus(ctx.study.status)}</StatusBadge>
      </header>

      <section aria-label={t("title")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`stats.${key}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums text-muted-foreground">—</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
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
        <p>
          {ctx.roles.map((r) => tRoles(r)).join(" · ")}
        </p>
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
