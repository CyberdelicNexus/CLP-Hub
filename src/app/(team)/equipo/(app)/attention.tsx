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
 * What needs a person today (Phase 4e), as a board of columns rather than a
 * stacked list — this is the single "Requiere atención" panel; a smaller
 * duplicate that used to sit above it on the overview page is gone.
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
 * NOTE ON NAMES (temporary, D-065): the logistics column shows a participant's
 * name next to their code when the viewer holds `participants.contact.read`.
 * This reverses D-040's blanket "codes only, even for an entitled viewer" rule
 * for this demo build — that rule existed because this is the screen most
 * likely to be left open on a shared monitor. The reversal is explicit and not
 * a final decision.
 */
export async function AttentionPanel({ ctx }: { ctx: StudyContext }) {
  const t = await getTranslations("attention");
  const showNames = ctx.permissions.has("participants.contact.read");

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

  const columns: KanbanColumn[] = [];

  if (openAlerts > 0) {
    columns.push({
      key: "alerts",
      title: t("columnAlerts"),
      tone: "warning",
      cards: [
        {
          key: "alerts",
          href: `${TEAM_BASE_PATH}/alertas?estado=OPEN`,
          primary: t("openAlerts", { count: openAlerts }),
        },
      ],
    });
  }

  if (prepared.length > 0) {
    columns.push({
      key: "prepared",
      title: t("columnPreparedMessages"),
      cards: [
        {
          key: "prepared",
          href: `${TEAM_BASE_PATH}/comunicaciones`,
          primary: t("preparedMessages", { count: prepared.length }),
        },
      ],
    });
  }

  if (openTasks > 0) {
    columns.push({
      key: "tasks",
      title: t("columnTasks"),
      cards: [
        {
          key: "tasks",
          href: `${TEAM_BASE_PATH}/tareas?estado=OPEN`,
          primary: t("openTasks", { count: openTasks }),
        },
      ],
    });
  }

  if (ops && ops.reviewRequired > 0) {
    columns.push({
      key: "review",
      title: t("columnReviewRequired"),
      tone: "warning",
      cards: [
        {
          key: "review",
          href: `${TEAM_BASE_PATH}/participantes?elegibilidad=REVIEW_REQUIRED`,
          primary: t("reviewRequired", { count: ops.reviewRequired }),
        },
      ],
    });
  }

  if (ops && ops.waitingForAllocation > 0) {
    columns.push({
      key: "waiting",
      title: t("columnWaitingForAllocation"),
      cards: [
        {
          key: "waiting",
          href: `${TEAM_BASE_PATH}/participantes?elegibilidad=ELIGIBLE`,
          primary: t("waitingForAllocation", { count: ops.waitingForAllocation }),
        },
      ],
    });
  }

  if (cohortsWorthSeeing.length > 0) {
    columns.push({
      key: "cohorts",
      title: t("cohorts"),
      cards: cohortsWorthSeeing.map((c) => ({
        key: c.id,
        href: `${TEAM_BASE_PATH}/cohortes/${c.id}`,
        primary: c.code,
        secondary: (
          <CohortOccupancy
            size={c.size}
            labels={{
              under: t("cohortUnder", { needed: c.size.needed }),
              over: t("cohortOver"),
              remaining: t("cohortRemaining", { remaining: c.size.remaining ?? 0 }),
            }}
          />
        ),
      })),
    });
  }

  if (logisticsWorthSeeing.length > 0) {
    columns.push({
      key: "logistics",
      title: t("logistics"),
      cards: logisticsWorthSeeing.slice(0, 8).map((a) => ({
        key: a.assignment.id,
        href: `${TEAM_BASE_PATH}/logistica-vr`,
        primary: a.deviceCode,
        secondary: showNames && a.participantName ? `${a.participantName} (${a.participantCode})` : a.participantCode,
        badge: t(`logisticsStep.${a.step}`),
      })),
      overflow: logisticsWorthSeeing.length > 8 ? t("andMore", { count: logisticsWorthSeeing.length - 8 }) : null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
            {columns.map((col) => (
              <Column key={col.key} column={col} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanCard {
  key: string;
  href: string;
  primary: string;
  secondary?: React.ReactNode;
  badge?: string;
}

interface KanbanColumn {
  key: string;
  title: string;
  tone?: "warning";
  cards: KanbanCard[];
  overflow?: string | null;
}

function Column({ column }: { column: KanbanColumn }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-3">
      <h3 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {column.tone === "warning" ? (
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--status-warning-fg)]" aria-hidden />
        ) : null}
        <span className="truncate">{column.title}</span>
        <span className="bg-gradient-brand ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold text-[oklch(0.2_0.02_265)]">
          {column.cards.length}
        </span>
      </h3>
      <ul className="flex flex-col gap-1.5">
        {column.cards.map((card) => (
          <li key={card.key}>
            <Link
              href={card.href}
              className="group flex flex-col gap-1 rounded-xl bg-card p-2.5 shadow-soft transition-shadow duration-200 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{card.primary}</span>
                <ArrowRight
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
              {card.secondary ? (
                <span className="truncate text-xs text-muted-foreground">{card.secondary}</span>
              ) : null}
              {card.badge ? <StatusBadge tone="warning">{card.badge}</StatusBadge> : null}
            </Link>
          </li>
        ))}
      </ul>
      {column.overflow ? <p className="text-xs text-muted-foreground">{column.overflow}</p> : null}
    </section>
  );
}
