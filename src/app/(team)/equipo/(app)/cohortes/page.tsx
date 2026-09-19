import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Layers, Plus, TriangleAlert, UserCog, Users } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CohortOccupancy } from "@/components/team/cohort-occupancy";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listCohorts, listStudyArms } from "@/services/cohorts";
import { listProgramStages } from "@/services/program-stages";
import { CreateCohortForm } from "./cohort-forms";
import { CohortPanel } from "./cohort-panel";
import { cohortTone } from "./tone";
import type { CohortStatus } from "@/domain/cohort";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("cohorts") };
}

/**
 * The cohort workspace (2026-09-18 merge request) — a vertical stack of
 * cohorts on the left, the selected one's full picture on the right:
 * lifecycle, staff, members, its programme sessions with their content and
 * communications, and its open tasks as a checklist. This absorbs what used
 * to be four separate pages (Cohortes, Sesiones, Comunicaciones, Contenido);
 * see D-068 for the reasoning and what deliberately stayed separate
 * (template/content AUTHORING, which isn't a per-cohort action).
 *
 * Selection is `?cohorte=<id>`, a link like every other filter in this app —
 * shareable, and works without client JS.
 */
export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ cohorte?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("cohorts.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("cohorts.manage");
  const narrowed = ctx.cohortScope !== null;
  const [rows, arms, stages] = await Promise.all([
    listCohorts(ctx.study.id, { scope: ctx.cohortScope }),
    canManage ? listStudyArms(ctx.study.id) : Promise.resolve([]),
    listProgramStages(ctx.study.id),
  ]);

  const { cohorte } = await searchParams;
  const selectedId = rows.some((r) => r.id === cohorte) ? cohorte : rows[0]?.id;
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const occupancyLabels = {
    under: t("cohorts.size.underShort"),
    over: t("cohorts.size.over"),
    remaining: "",
  };

  // At-a-glance counts (2026-09-19 request), the same "cards like the
  // dashboard" pattern from team/(app)/page.tsx — computed from `rows`
  // already fetched above, no extra query.
  const totalParticipants = rows.reduce((sum, r) => sum + r.memberCount, 0);
  const needsAttention = rows.filter((r) => r.size.verdict !== "WITHIN").length;
  const inProgress = rows.filter((r) => r.currentStageId !== null).length;
  const glanceTiles = [
    { key: "total", label: t("cohorts.glance.total"), value: rows.length },
    { key: "participants", label: t("cohorts.glance.participants"), value: totalParticipants },
    { key: "inProgress", label: t("cohorts.glance.inProgress"), value: inProgress },
    { key: "needsAttention", label: t("cohorts.glance.needsAttention"), value: needsAttention },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.cohorts")}</h1>
          <p className="text-sm text-muted-foreground">{t("cohorts.subtitle")}</p>
        </div>
        {canManage ? (
          <Dialog>
            <DialogTrigger render={<Button size="sm" className="gap-1.5 rounded-lg" />}>
              <Plus className="size-3.5" aria-hidden />
              {t("cohorts.create")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("cohorts.createTitle")}</DialogTitle>
              </DialogHeader>
              <CreateCohortForm
                arms={arms.map((a) => ({ id: a.id, label: `${a.code} · ${a.nameEs}` }))}
                labels={{
                  submit: t("cohorts.create"),
                  submitting: t("common.loading"),
                  code: t("cohorts.field.code"),
                  name: t("cohorts.field.name"),
                  start: t("cohorts.field.start"),
                  end: t("cohorts.field.end"),
                  minSize: t("cohorts.field.minSize"),
                  maxSize: t("cohorts.field.maxSize"),
                  sizeHelp: t("cohorts.field.sizeHelp"),
                  arm: t("cohorts.field.arm"),
                  armHelp: t("cohorts.field.armHelp"),
                  armAny: t("cohorts.field.armAny"),
                  errors: {
                    forbidden: t("common.noAccess"),
                    invalid: t("cohorts.error.invalid"),
                    duplicateCode: t("cohorts.error.duplicateCode"),
                    failed: t("cohorts.error.failed"),
                  },
                }}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </header>

      {narrowed ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("cohorts.scopedNotice")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("cohorts.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {narrowed ? t("cohorts.emptyScoped") : t("cohorts.emptyDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label={t("cohorts.glance.title")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {glanceTiles.map((tile) => (
              <Card key={tile.key} className="card-accent relative overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {tile.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p data-numeric className="text-3xl font-semibold">
                    {tile.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* `min-w-0` on both children matters, not just tidiness: a CSS
              grid item's default `min-width` is `auto` — its content's own
              min-content size — so without it, this column refuses to
              shrink below the widest thing inside a cohort card (a badge, an
              unbroken name) and the whole page overflows on mobile instead
              of that content wrapping/truncating (2026-09-19 report: "have
              to zoom out to see"). */}
          <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
            {/* Sticks 10px below the floating horizontal nav bar (2026-09-19
                request), not at the viewport edge: the header is `mt-3` (0.75rem)
                plus `h-14` (3.5rem) tall, so its bottom edge sits at 4.25rem —
                +10px (0.625rem) lands the offset at 4.875rem. */}
            <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-[4.875rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pb-2">
              {rows.map((row) => {
                const active = row.id === selectedId;
                const stage = row.currentStageId ? stageById.get(row.currentStageId) : null;
                return (
                  <Link
                    key={row.id}
                    href={`${TEAM_BASE_PATH}/cohortes?cohorte=${row.id}`}
                    aria-current={active ? "true" : undefined}
                    className={
                      active
                        ? "card-accent relative flex flex-col gap-2 overflow-hidden rounded-2xl p-3"
                        : "relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-card p-3 shadow-soft ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {row.code}
                      </span>
                      <StatusBadge tone={cohortTone(row.status as CohortStatus)}>
                        {t(`cohorts.status.${row.status}`)}
                      </StatusBadge>
                    </div>
                    <p className="truncate text-sm font-semibold">{row.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <IconChip
                        icon={Users}
                        tone="sky"
                        title={t("cohorts.members")}
                      >
                        <CohortOccupancy size={row.size} labels={occupancyLabels} showWarning={row.size.verdict === "OVER"} />
                      </IconChip>
                      <IconChip icon={UserCog} tone="lilac" title={t("cohorts.staff")}>
                        {row.staffCount}
                      </IconChip>
                      {row.size.verdict !== "WITHIN" ? (
                        <IconChip icon={TriangleAlert} tone="peach" title={t("cohorts.size.needsAttention")}>
                          {row.size.verdict === "UNDER" ? t("cohorts.size.underShort") : t("cohorts.size.over")}
                        </IconChip>
                      ) : null}
                    </div>
                    {stage ? (
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Layers className="size-3 shrink-0" aria-hidden />
                        {stage.nameEs}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="min-w-0">{selectedId ? <CohortPanel ctx={ctx} cohortId={selectedId} /> : null}</div>
          </div>
        </>
      )}
    </div>
  );
}

const CHIP_TONES = {
  sky: "bg-surface-sky text-surface-sky-ink",
  lilac: "bg-surface-lilac text-surface-lilac-ink",
  peach: "bg-surface-peach text-surface-peach-ink",
  mint: "bg-surface-mint text-surface-mint-ink",
} as const;

/**
 * A small colour-coded, outlined pill for one piece of at-a-glance cohort
 * data (occupancy, team size, a size warning) — plain gray icon+number
 * blended in too easily (2026-09-19: "make the icons a bit more clear with
 * outlines or colors, the most important info at a glance").
 */
function IconChip({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Users;
  tone: keyof typeof CHIP_TONES;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-foreground/5 ${CHIP_TONES[tone]}`}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}
