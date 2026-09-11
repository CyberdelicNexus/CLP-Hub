import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { countParticipantOps } from "@/services/participant-ops";
import { countApplicationsByStatus } from "@/services/recruitment";
import { AttentionPanel } from "./attention";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team.overview");
  return { title: t("title") };
}

/**
 * "Resumen" home. Counts are only shown once the phase that owns them exists and
 * the viewer holds the matching permission; everything else keeps an honest
 * em dash rather than a fabricated zero. The accent surface on each tile is
 * decoration only — it never encodes a value or a status.
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

  // Each tile is gated by the permission that owns its data, so a viewer sees a
  // number only where they are entitled to the underlying rows.
  const canReadApplications = ctx.permissions.has("applications.read");
  const canReadScreening = ctx.permissions.has("screening.read");
  const canReadParticipants = ctx.permissions.has("participants.read");

  const [counts, ops] = await Promise.all([
    canReadApplications ? countApplicationsByStatus(ctx.study.id) : null,
    canReadParticipants ? countParticipantOps(ctx.study.id) : null,
  ]);

  const totalApplications = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const awaitingReview = counts?.SUBMITTED ?? 0;

  const tileValues: Record<string, number | null> = {
    applications: totalApplications,
    screeningPending: canReadScreening ? (ops?.screeningPending ?? null) : null,
    eligible: ops?.eligible ?? null,
    enrolled: ops?.enrolled ?? null,
  };

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
        {STATS.map(({ key, surface }) => {
          const value = tileValues[key] ?? null;
          return (
            <Card key={key} className="transition-shadow duration-200 hover:shadow-lift">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t(`stats.${key}`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-3">
                <p
                  data-numeric
                  className={
                    value === null
                      ? "text-3xl font-semibold text-muted-foreground"
                      : "text-3xl font-semibold"
                  }
                >
                  {value ?? "—"}
                </p>
                {value === null ? (
                  <span className={`rounded-md px-2 py-0.5 text-[0.7rem] font-medium ${surface}`}>
                    {t("noData")}
                  </span>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
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
            {awaitingReview > 0 ? (
              <Link
                href={`${TEAM_BASE_PATH}/solicitudes?estado=SUBMITTED`}
                className="group inline-flex items-center gap-2 rounded-lg text-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span>{t("attentionApplications", { count: awaitingReview })}</span>
                <ArrowRight
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">{t("attentionEmpty")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        Everything that is actually waiting on a person, in one place and gated
        per section by the permission that owns the data.
      */}
      <div>
        <AttentionPanel ctx={ctx} />
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
