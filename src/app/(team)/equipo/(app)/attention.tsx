import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CohortOccupancy } from "@/components/team/cohort-occupancy";
import { StatusBadge } from "@/components/status-badge";
import type { StudyContext } from "@/auth/study-context";
import { needsAttention } from "@/domain/logistics";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import {
  countOpenTasks,
  countUnresolvedAlerts,
  listPreparedActions,
} from "@/services/automation";
import { listCohorts } from "@/services/cohorts";
import { listOpenAssignments } from "@/services/logistics";
import { countParticipantOps } from "@/services/participant-ops";

/**
 * What needs a person today (Phase 4e).
 *
 * Three rules this panel follows, and the reason for each:
 *
 * 1. **Every row is a link to the place the work is done.** A dashboard that
 *    tells you something is wrong without taking you there gets read once.
 * 2. **Every section is gated by the permission that owns its data**, so a
 *    facilitator does not see a logistics queue they cannot act on, and a
 *    researcher does not see one at all.
 * 3. **Nothing is shown that is merely in progress.** A cohort still filling up
 *    and a device that left yesterday are not problems. Only a determination
 *    parked for review, a cohort at the edge of its configured size, and a
 *    device whose step is genuinely waiting on a person appear here — otherwise
 *    the panel becomes wallpaper.
 *
 * It shows counts and codes. No participant name appears, even for a viewer who
 * could read one: this is the screen most likely to be open on a shared monitor.
 */
export async function AttentionPanel({ ctx }: { ctx: StudyContext }) {
  const t = await getTranslations("attention");

  const canReadParticipants = ctx.permissions.has("participants.read");
  const canReadCohorts = ctx.permissions.has("cohorts.read");
  const canReadLogistics = ctx.permissions.has("logistics.read");
  const canReadTasks = ctx.permissions.has("tasks.read");
  const canReadAlerts = ctx.permissions.has("alerts.read");
  const canReadComms = ctx.permissions.has("communications.read");

  const [ops, cohorts, assignments, openTasks, openAlerts, prepared] = await Promise.all([
    canReadParticipants ? countParticipantOps(ctx.study.id) : null,
    canReadCohorts ? listCohorts(ctx.study.id, { scope: ctx.cohortScope }) : [],
    canReadLogistics ? listOpenAssignments(ctx.study.id) : [],
    canReadTasks ? countOpenTasks(ctx.study.id) : 0,
    canReadAlerts ? countUnresolvedAlerts(ctx.study.id) : 0,
    // The queue of messages the processor prepared and a person still has to
    // send. It belongs here rather than only on Comunicaciones: a prepared
    // reminder nobody opens is the failure mode this whole phase has to avoid.
    canReadComms ? listPreparedActions(ctx.study.id, { limit: 50 }) : [],
  ]);

  // "Nearly complete" means inside its bounds and with places left, plus any
  // cohort already over. A cohort with no bounds configured is not judged.
  const cohortsWorthSeeing = cohorts.filter(
    (c) =>
      c.size.verdict === "OVER" ||
      (c.size.verdict === "WITHIN" && c.size.remaining !== null && c.size.remaining <= 2) ||
      (c.size.verdict === "UNDER" && c.size.needed <= 2),
  );

  const logisticsWorthSeeing = assignments.filter((a) => needsAttention(a.step));

  const nothingToShow =
    (!ops || (ops.reviewRequired === 0 && ops.waitingForAllocation === 0)) &&
    cohortsWorthSeeing.length === 0 &&
    logisticsWorthSeeing.length === 0 &&
    openTasks === 0 &&
    openAlerts === 0 &&
    prepared.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {nothingToShow ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}

        {/*
          Alerts first, because an alert is the only row here that says something
          may be wrong rather than merely outstanding.
        */}
        {openAlerts > 0 ? (
          <Row
            href={`${TEAM_BASE_PATH}/alertas?estado=OPEN`}
            label={t("openAlerts", { count: openAlerts })}
            tone="warning"
          />
        ) : null}

        {prepared.length > 0 ? (
          <Row
            href={`${TEAM_BASE_PATH}/comunicaciones`}
            label={t("preparedMessages", { count: prepared.length })}
          />
        ) : null}

        {openTasks > 0 ? (
          <Row
            href={`${TEAM_BASE_PATH}/tareas?estado=OPEN`}
            label={t("openTasks", { count: openTasks })}
          />
        ) : null}

        {ops && ops.reviewRequired > 0 ? (
          <Row
            href={`${TEAM_BASE_PATH}/participantes?elegibilidad=REVIEW_REQUIRED`}
            label={t("reviewRequired", { count: ops.reviewRequired })}
            tone="warning"
          />
        ) : null}

        {ops && ops.waitingForAllocation > 0 ? (
          <Row
            href={`${TEAM_BASE_PATH}/participantes?elegibilidad=ELIGIBLE`}
            label={t("waitingForAllocation", { count: ops.waitingForAllocation })}
          />
        ) : null}

        {cohortsWorthSeeing.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("cohorts")}
            </h3>
            <ul className="space-y-1">
              {cohortsWorthSeeing.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${TEAM_BASE_PATH}/cohortes/${c.id}`}
                    className="group flex flex-wrap items-center gap-2 rounded-lg text-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span data-numeric className="font-medium">
                      {c.code}
                    </span>
                    <CohortOccupancy
                      size={c.size}
                      labels={{
                        under: t("cohortUnder", { needed: c.size.needed }),
                        over: t("cohortOver"),
                        remaining: t("cohortRemaining", { remaining: c.size.remaining ?? 0 }),
                      }}
                    />
                    <ArrowRight
                      className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {logisticsWorthSeeing.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("logistics")}
            </h3>
            <ul className="space-y-1">
              {logisticsWorthSeeing.slice(0, 8).map((a) => (
                <li key={a.assignment.id}>
                  <Link
                    href={`${TEAM_BASE_PATH}/logistica-vr`}
                    className="group flex flex-wrap items-center gap-2 rounded-lg text-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span data-numeric className="font-medium">
                      {a.deviceCode}
                    </span>
                    <span data-numeric className="text-xs text-muted-foreground">
                      {a.participantCode}
                    </span>
                    <StatusBadge tone="warning">
                      {t(`logisticsStep.${a.step}`)}
                    </StatusBadge>
                    <ArrowRight
                      className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
            {logisticsWorthSeeing.length > 8 ? (
              <p className="text-xs text-muted-foreground">
                {t("andMore", { count: logisticsWorthSeeing.length - 8 })}
              </p>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone?: "warning";
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-lg text-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {tone === "warning" ? (
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--status-warning-fg)]" aria-hidden />
      ) : null}
      <span>{label}</span>
      <ArrowRight
        className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
