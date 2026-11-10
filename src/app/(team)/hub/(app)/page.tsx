import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarClock, ListChecks } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listTasks } from "@/services/automation";
import { countParticipantOps } from "@/services/participant-ops";
import { countApplicationsByStatus } from "@/services/recruitment";
import { listSessions } from "@/services/sessions";
import { countAllocationsByArm } from "@/services/cohorts";
import { armGlowColor } from "@/components/team/arm-badge";
import { StudyFlowSummary } from "@/components/team/study-flow-summary";
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
  { key: "completed", surface: "bg-surface-lilac text-surface-lilac-ink" },
] as const;

export default async function OverviewPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null; // layout already handled this case
  const t = await getTranslations("team.overview");
  const tStatus = await getTranslations("status.study");
  const tRoles = await getTranslations("roles");
  const firstName = ctx.session.displayName.split(/\s+/)[0];

  // Each tile is gated by the permission that owns its data, so a viewer sees a
  // number only where they are entitled to the underlying rows.
  const canReadApplications = ctx.permissions.has("applications.read");
  const canReadScreening = ctx.permissions.has("screening.read");
  const canReadParticipants = ctx.permissions.has("participants.read");
  const canReadTasks = ctx.permissions.has("tasks.read");
  const canReadCohorts = ctx.permissions.has("cohorts.read");
  const canReadAllocations = ctx.permissions.has("randomization.read");

  const [counts, ops, myTasks, sessions, armCounts] = await Promise.all([
    canReadApplications ? countApplicationsByStatus(ctx.study.id) : null,
    canReadParticipants ? countParticipantOps(ctx.study.id) : null,
    // Tagged to the signed-in user, not the study at large (2026-09-19
    // request: "information tagged to the user") — the same `listTasks`
    // the Tareas page uses, filtered to what THIS person is on the hook for.
    canReadTasks
      ? listTasks(ctx.study.id, { status: "OPEN", assignedTo: ctx.session.userId, limit: 5 })
      : [],
    // Sessions fold into the cohort workspace (D-068), so "can see sessions"
    // still tracks cohorts.read rather than a permission of its own.
    canReadCohorts ? listSessions(ctx.study.id, { scope: ctx.cohortScope, limit: 200 }) : [],
    // One count per configured study group (2026-11-09: "how many are in the
    // control group"). By arm, labelled with the arm's own name, so the code
    // never decides which group is the control one (rule 6).
    canReadAllocations ? countAllocationsByArm(ctx.study.id) : [],
  ]);

  const now = new Date();
  const upcomingSessions = sessions
    .filter((s) => s.status === "SCHEDULED" && s.scheduledStart >= now)
    .slice(0, 5);

  const totalApplications = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

  const tileValues: Record<string, number | null> = {
    applications: totalApplications,
    screeningPending: canReadScreening ? (ops?.screeningPending ?? null) : null,
    eligible: ops?.eligible ?? null,
    enrolled: ops?.enrolled ?? null,
    completed: ops?.completed ?? null,
  };

  return (
    <div className="space-y-8">
      {/* The four counts sit beside the title as compact chips (2026-11-09:
          four numbers did not need a full-width row of cards, and the space
          is better spent on the panels below). */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-gradient-brand text-sm font-semibold tracking-tight">
            {t("greeting", { name: firstName })}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {ctx.study.code}
            <StatusBadge tone={studyTone(ctx.study.status)}>{tStatus(ctx.study.status)}</StatusBadge>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{ctx.study.title}</h1>
        </div>

        {/* Every count on ONE line of equal-width chips (2026-11-10): titles
            wrap to two lines (space reserved, so the numbers align), and on a
            screen too narrow for all of them the row scrolls sideways rather
            than wrapping. The padding gives the hover shadow room inside the
            scroll box. */}
        <dl
          aria-label={t("title")}
          className="-mx-1 grid w-full auto-cols-[minmax(6.25rem,1fr)] grid-flow-col gap-2 overflow-x-auto px-1 pt-1 pb-3"
        >
          {STATS.map(({ key, surface }) => {
            const value = tileValues[key] ?? null;
            return (
              <div
                key={key}
                title={value === null ? t("noData") : undefined}
                className="card-accent flex min-w-0 flex-col justify-between gap-1 rounded-xl px-3 py-2 transition-shadow duration-200 hover:shadow-lift"
              >
                <dt className="line-clamp-2 min-h-[2.5em] text-[0.65rem] leading-[1.25] font-medium tracking-wide text-balance text-muted-foreground uppercase">
                  {t(`stats.${key}`)}
                </dt>
                <dd className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    data-numeric
                    className={value === null ? "text-xl font-semibold text-muted-foreground" : "text-xl font-semibold"}
                  >
                    {value ?? "—"}
                  </span>
                  {value === null ? (
                    <span className={`rounded-md px-1.5 py-0.5 text-[0.6rem] font-medium ${surface}`}>
                      {t("noData")}
                    </span>
                  ) : null}
                </dd>
              </div>
            );
          })}
          {armCounts.map((arm, i) => (
            <div
              key={arm.armId}
              className="flex min-w-0 flex-col justify-between gap-1 rounded-xl border border-border bg-card px-3 py-2 transition-shadow duration-200 hover:shadow-lift"
            >
              <dt className="flex min-h-[2.5em] items-start gap-1.5 text-[0.65rem] leading-[1.25] font-medium tracking-wide text-muted-foreground uppercase">
                <span className="mt-[0.35em] size-1.5 shrink-0 rounded-full" style={{ background: armGlowColor(i) }} aria-hidden />
                <span className="line-clamp-2 text-balance">{arm.nameEs}</span>
              </dt>
              <dd>
                <span data-numeric className="text-xl font-semibold">
                  {arm.n}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/*
        Personalised to the signed-in user (2026-09-19 request: "information
        tagged to the user"), as opposed to the study-wide AttentionPanel
        below — this is "what's on YOUR plate", not "what needs anyone's
        attention". Each half only renders for a viewer who holds the
        matching permission; neither claims to know about work it can't see.
      */}
      <section aria-label={t("today")} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
              {t("today")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canReadCohorts ? null : upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("todayEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingSessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`${TEAM_BASE_PATH}/cohortes?cohorte=${s.cohortId}`}
                      className="min-w-0 flex-1 truncate rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {s.name} · {s.cohortCode}
                    </Link>
                    <span data-numeric className="text-xs text-muted-foreground">
                      {formatDateTime(s.scheduledStart, ctx.study.timezone)}
                    </span>
                    {s.facilitatorName === ctx.session.displayName ? (
                      <StatusBadge tone="info">{t("facilitating")}</StatusBadge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" aria-hidden />
              {t("myTasksTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canReadTasks ? null : myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("myTasksEmpty")}</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {myTasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.titleEs}</span>
                      {task.dueAt ? (
                        <span data-numeric className="text-xs text-muted-foreground">
                          {formatDateTime(task.dueAt, ctx.study.timezone)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${TEAM_BASE_PATH}/tareas`}
                  className="mt-3 inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t("viewAll")}
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/*
        Everything that is actually waiting on a person, in one place and gated
        per section by the permission that owns the data. This is the one
        "requiere atención" panel — a smaller duplicate used to live above it.
      */}
      <div>
        <AttentionPanel ctx={ctx} />
      </div>

      {/* The study flow beyond the recruitment counts (2026-10-28: moved here
          from Evaluación; its stage counts are Solicitudes' KPI row now).
          Same gate Evaluación used. */}
      {canReadScreening ? <StudyFlowSummary studyId={ctx.study.id} withStages={false} /> : null}

      <footer className="text-xs text-muted-foreground">
        <p>{ctx.roles.map((r) => tRoles(r)).join(" · ")}</p>
      </footer>
    </div>
  );
}

function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(value);
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
