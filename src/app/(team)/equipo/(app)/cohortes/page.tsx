import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Layers, LayoutGrid, Plus, TriangleAlert, UserCog, Users } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArmBadge, armGlowColor, armToneClass } from "@/components/team/arm-badge";
import { CohortOccupancy } from "@/components/team/cohort-occupancy";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listCohorts, listStudyArms } from "@/services/cohorts";
import { listProgramStages } from "@/services/program-stages";
import { CreateCohortForm } from "./cohort-forms";
import { CohortPanel } from "./cohort-panel";
import { CohortWorkspace } from "./cohort-workspace";
import { cohortTone } from "./tone";
import type { CohortStatus } from "@/domain/cohort";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("cohorts") };
}

/**
 * The cohort workspace (2026-09-18 merge request; grid view 2026-10-14) — a
 * grid of every cohort by default, filterable by study group; opening one moves
 * the grid into a column on the left and shows that cohort's full picture:
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
  searchParams: Promise<{ cohorte?: string; grupo?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("cohorts.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("cohorts.manage");
  const narrowed = ctx.cohortScope !== null;
  // Arms for everyone who can read cohorts, not only managers: the group badge
  // and the filter are how the team tells control and programme apart (D-116).
  const [allRows, arms, stages] = await Promise.all([
    listCohorts(ctx.study.id, { scope: ctx.cohortScope, includeArchived: true }),
    listStudyArms(ctx.study.id),
    listProgramStages(ctx.study.id),
  ]);
  // Archived cohorts (2026-09-28 request) stay out of the main grid and its
  // at-a-glance counts, but a direct link to one (from the archived section
  // below, or an old bookmark) still opens it — see `selectedId` below.
  const activeRows = allRows.filter((r) => !r.archivedAt);
  const archivedRows = allRows.filter((r) => r.archivedAt);

  const { cohorte, grupo } = await searchParams;

  // Group filter (2026-10-14 request): every configured arm by its code, plus
  // "no group" when some cohort has none. An unknown value shows everything.
  const armByCode = new Map(arms.map((a, i) => [a.code, { arm: a, position: i }]));
  const armById = new Map(arms.map((a, i) => [a.id, { arm: a, position: i }]));
  const filter = grupo === NO_ARM || (grupo && armByCode.has(grupo)) ? grupo : null;
  const matches = (row: (typeof allRows)[number]) =>
    filter === null ? true : filter === NO_ARM ? !row.armId : armByCode.get(filter)?.arm.id === row.armId;
  const rows = activeRows.filter(matches);

  // No cohort selected is the default now: the grid of all of them (2026-10-14).
  const selectedId = cohorte && allRows.some((r) => r.id === cohorte) ? cohorte : null;
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const hrefWith = (params: { cohorte?: string | null; grupo?: string | null }) => {
    const q = new URLSearchParams();
    const g = params.grupo === undefined ? filter : params.grupo;
    const c = params.cohorte === undefined ? selectedId : params.cohorte;
    if (g) q.set("grupo", g);
    if (c) q.set("cohorte", c);
    const s = q.toString();
    return `${TEAM_BASE_PATH}/cohortes${s ? `?${s}` : ""}`;
  };

  const occupancyLabels = {
    under: t("cohorts.size.underShort"),
    over: t("cohorts.size.over"),
    remaining: "",
  };

  // At-a-glance counts (2026-09-19 request), over the cohorts the filter shows.
  const totalParticipants = rows.reduce((sum, r) => sum + r.memberCount, 0);
  const needsAttention = rows.filter((r) => r.size.verdict !== "WITHIN").length;
  const inProgress = rows.filter((r) => r.currentStageId !== null).length;
  const glanceTiles = [
    { key: "total", label: t("cohorts.glance.total"), value: rows.length },
    { key: "participants", label: t("cohorts.glance.participants"), value: totalParticipants },
    { key: "inProgress", label: t("cohorts.glance.inProgress"), value: inProgress },
    { key: "needsAttention", label: t("cohorts.glance.needsAttention"), value: needsAttention },
  ];

  const filterTags = [
    { value: null, label: t("cohorts.filter.all"), count: activeRows.length, position: null },
    ...arms.map((a, i) => ({
      value: a.code,
      label: a.nameEs,
      count: activeRows.filter((r) => r.armId === a.id).length,
      position: i,
    })),
    ...(activeRows.some((r) => !r.armId)
      ? [{ value: NO_ARM, label: t("cohorts.filter.noArm"), count: activeRows.filter((r) => !r.armId).length, position: null }]
      : []),
  ];

  const open = selectedId !== null;

  const cards = rows.map((row) => {
    const active = row.id === selectedId;
    const stage = row.currentStageId ? stageById.get(row.currentStageId) : null;
    const arm = row.armId ? armById.get(row.armId) : null;
    return (
      <Link
        key={row.id}
        data-flip-id={row.id}
        href={hrefWith({ cohorte: row.id })}
        scroll={false}
        aria-current={active ? "true" : undefined}
        // The glow takes the card's group colour, so the edge also says which
        // group it is; cohorts with no group keep the brand colour.
        style={arm ? ({ "--glow-color": armGlowColor(arm.position) } as React.CSSProperties) : undefined}
        className={cn(
          "edge-glow flex flex-col overflow-hidden rounded-2xl",
          // Bigger in the grid (2026-10-14 request); compact once the list is a column.
          open ? "gap-2 p-3" : "min-h-44 gap-3 p-5 hover:-translate-y-0.5",
          active
            ? "card-accent"
            : "bg-card shadow-soft ring-1 ring-foreground/10 transition-colors hover:bg-muted/40",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {row.code}
          </span>
          <StatusBadge tone={cohortTone(row.status as CohortStatus)}>
            {t(`cohorts.status.${row.status}`)}
          </StatusBadge>
        </div>
        <p className={cn("truncate font-semibold", open ? "text-sm" : "text-lg tracking-tight")}>{row.name}</p>
        {arm ? <ArmBadge name={arm.arm.nameEs} position={arm.position} className="self-start" /> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <IconChip icon={Users} tone="sky" title={t("cohorts.members")}>
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
          <p className={cn("flex items-center gap-1 truncate text-xs text-muted-foreground", !open && "mt-auto")}>
            <Layers className="size-3 shrink-0" aria-hidden />
            {stage.nameEs}
          </p>
        ) : null}
      </Link>
    );
  });

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
                pairOptions={activeRows.map((r) => ({ id: r.id, label: `${r.code} · ${r.name}` }))}
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
                  pair: t("cohorts.field.pair"),
                  pairHelp: t("cohorts.field.pairHelp"),
                  pairNone: t("cohorts.field.pairNone"),
                  errors: {
                    forbidden: t("common.noAccess"),
                    invalid: t("cohorts.error.invalid"),
                    duplicateCode: t("cohorts.error.duplicateCode"),
                    pairUnavailable: t("cohorts.error.pairUnavailable"),
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

      {activeRows.length === 0 && archivedRows.length === 0 ? (
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

          {/* Group filter (2026-10-14 request). Only offered once the study has
              groups; before that there is nothing to tell apart. */}
          {arms.length > 0 ? (
            <nav aria-label={t("cohorts.filter.aria")} className="flex flex-wrap items-center gap-2">
              {filterTags.map((tag) => {
                const current = tag.value === filter;
                return (
                  <Link
                    key={tag.value ?? "all"}
                    href={hrefWith({ grupo: tag.value })}
                    scroll={false}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors",
                      current
                        ? "bg-foreground text-background ring-foreground"
                        : "bg-card text-foreground ring-foreground/15 hover:bg-muted",
                    )}
                  >
                    {tag.position !== null ? (
                      <span aria-hidden className={cn("size-2 rounded-full", armToneClass(tag.position), "ring-1 ring-inset ring-current")} />
                    ) : null}
                    {tag.label}
                    <span data-numeric className={current ? "opacity-70" : "text-muted-foreground"}>
                      {tag.count}
                    </span>
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <CohortWorkspace
            open={open}
            layoutKey={`${selectedId ?? "grid"}|${filter ?? "all"}`}
            detailKey={selectedId}
            list={
              <div className="flex flex-col gap-3">
                {open ? (
                  <Link
                    href={hrefWith({ cohorte: null })}
                    scroll={false}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <LayoutGrid className="size-3.5" aria-hidden />
                    {t("cohorts.backToGrid")}
                  </Link>
                ) : null}

                {rows.length === 0 ? (
                  <p className="rounded-2xl bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                    {t("cohorts.filter.empty")}
                  </p>
                ) : (
                  // `min-w-0` matters on mobile: a grid item's default min-width is
                  // its content's, so an unbroken name would overflow the page
                  // (2026-09-19 report). Grid of cards by default; one column
                  // once a cohort is open and the list sits on the left.
                  <div
                    className={
                      open
                        ? "grid min-w-0 gap-2"
                        : "grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]"
                    }
                  >
                    {cards}
                  </div>
                )}

                {/* Archived cohorts (2026-09-28 request) — hidden from the main
                    grid and its glance counts, but not gone. */}
                {canManage && archivedRows.length > 0 ? (
                  <details className="rounded-2xl bg-muted/40 p-3">
                    <summary className="cursor-pointer text-xs font-medium tracking-wide text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
                      {t("cohorts.archivedSection", { count: archivedRows.length })}
                    </summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {archivedRows.map((row) => (
                        <Link
                          key={row.id}
                          href={hrefWith({ cohorte: row.id })}
                          scroll={false}
                          aria-current={row.id === selectedId ? "true" : undefined}
                          className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                        >
                          <span className="truncate">
                            <span data-numeric className="text-muted-foreground">
                              {row.code}
                            </span>{" "}
                            {row.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            }
            detail={
              selectedId ? (
                <div className="space-y-3">
                  {/* On a phone the list is hidden while a cohort is open. */}
                  <Link
                    href={hrefWith({ cohorte: null })}
                    scroll={false}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                  >
                    <LayoutGrid className="size-3.5" aria-hidden />
                    {t("cohorts.backToGrid")}
                  </Link>
                  <CohortPanel ctx={ctx} cohortId={selectedId} />
                </div>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}

/** The `?grupo=` value for cohorts that name no arm. Not a valid arm code (lowercase). */
const NO_ARM = "sin-grupo";

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
