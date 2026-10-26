import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { ViewToggle } from "@/components/team/view-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  TASK_PRIORITIES,
  isOverdue,
  type TaskPriority,
  type TaskStatus,
} from "@/domain/automation";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listTasks } from "@/services/automation";
import { listCohortOptions } from "@/services/communications";
import { listParticipants } from "@/services/participant-ops";
import { listAssignableStaff } from "@/services/staff";
import { getTrelloBoardUrl } from "@/services/trello";
import { AssignTaskForm, CloseTaskForm, CreateTaskForm } from "./task-forms";
import { TasksKanban } from "./tasks-kanban";
import { TrelloBoard } from "./trello-board";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("tasks") };
}

const FILTERS: readonly TaskStatus[] = ["OPEN", "DONE", "CANCELLED"];

/**
 * Tasks (Phase 8).
 *
 * The one screen in the team area that is a to-do list, and the reason it is
 * worth having rather than a shared document: a task created by a rule and a
 * task typed by a person sit in the same list, so the work the study generates
 * and the work the team invents are read in one place.
 *
 * PARTICIPANT CODES ONLY, as everywhere in the operational area. A task list on
 * a shared monitor that reads "call María about her headset" is a
 * re-identification surface; "P-000042" is not.
 *
 * The detail field is staff-authored free text and the boundary note above the
 * list says what does not belong in it (D-035). Nothing enforces that, and
 * pretending otherwise would be worse than saying so.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vista?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("tasks.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const params = await searchParams;
  // Kanban is the default view (2026-09-19 request) — the list is opt-in via
  // ?vista=list, the reverse of how it worked before.
  const isKanban = params.vista !== "list";
  const status = (FILTERS as readonly string[]).includes(params.estado ?? "")
    ? (params.estado as TaskStatus)
    : "OPEN";
  const canManage = ctx.permissions.has("tasks.manage");
  const base = `${TEAM_BASE_PATH}/tareas`;
  const viewHref = (v: "list" | "kanban") =>
    v === "list" ? `${base}?vista=list&estado=${status}` : base;

  const [rows, staff, cohorts, participantRows] = await Promise.all([
    // The kanban lays every status out as its own column, so it always fetches
    // all three rather than respecting the single-status list filter.
    isKanban
      ? listTasks(ctx.study.id, {})
      : listTasks(ctx.study.id, { status }),
    canManage ? listAssignableStaff(ctx.study.id) : [],
    canManage ? listCohortOptions(ctx.study.id) : [],
    // Codes only. `includeContact: false` is not a default here — it is the
    // decision, and the list would happily return names if it were flipped.
    canManage
      ? listParticipants(ctx.study.id, { includeContact: false, limit: 500 })
      : [],
  ]);
  // General project tasks, not this study's operational ones — see
  // TrelloBoard's doc comment. Null (rendered as "not connected") when
  // TRELLO_BOARD_URL isn't configured; reading it is synchronous, no request.
  const trelloBoardUrl = getTrelloBoardUrl();

  const now = new Date();
  const overdue = rows.filter((task) => isOverdue(task, now)).length;

  const labels = {
    submit: t("common.save"),
    submitting: t("common.loading"),
    errors: {
      forbidden: t("tasks.errors.forbidden"),
      invalid: t("tasks.errors.invalid"),
      notFound: t("tasks.errors.notFound"),
      failed: t("tasks.errors.failed"),
    },
  };

  const staffOptions = staff.map((s) => ({
    value: s.id,
    label: s.displayName,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("nav.tasks")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("tasks.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            current={isKanban ? "kanban" : "list"}
            hrefFor={viewHref}
            labels={{
              list: t("common.viewList"),
              kanban: t("common.viewKanban"),
            }}
          />
          {/* A modal rather than a standing card (2026-09-19 request) — the
              form doesn't need to occupy space on every visit, only when
              someone is actually adding a task. */}
          {canManage ? (
            <Dialog>
              <DialogTrigger render={<Button size="sm" className="gap-1.5 rounded-lg" />}>
                <Plus className="size-3.5" aria-hidden />
                {t("tasks.add")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("tasks.add")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">{t("tasks.boundary")}</p>
                <CreateTaskForm
                  labels={{
                    ...labels,
                    submit: t("tasks.add"),
                    title: t("tasks.title"),
                    detail: t("tasks.detail"),
                    detailHelp: t("tasks.detailHelp"),
                    priority: t("tasks.priority"),
                    dueAt: t("tasks.dueAt"),
                    assignedTo: t("tasks.assignedTo"),
                    unassigned: t("tasks.unassigned"),
                    aboutParticipant: t("tasks.aboutParticipant"),
                    aboutCohort: t("tasks.aboutCohort"),
                    none: t("common.none"),
                  }}
                  priorities={TASK_PRIORITIES.map((p) => ({
                    value: p,
                    label: t(`tasks.priorityLabel.${p}`),
                  }))}
                  staff={staffOptions}
                  participants={participantRows.map((p) => ({
                    value: p.id,
                    label: p.code,
                  }))}
                  cohorts={cohorts.map((c) => ({
                    value: c.id,
                    label: `${c.code} · ${c.name}`,
                  }))}
                />
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("tasks.trelloTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TrelloBoard
            boardUrl={trelloBoardUrl}
            notConnectedLabel={t("tasks.trelloNotConnected")}
            notConnectedHelp={t("tasks.trelloNotConnectedHelp")}
            openLabel={t("tasks.trelloOpen")}
          />
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <Tile
          label={t("tasks.open")}
          value={status === "OPEN" ? rows.length : null}
        />
        <Tile
          label={t("tasks.overdue")}
          value={status === "OPEN" ? overdue : null}
          tone="warning"
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("tasks.filter")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {FILTERS.map((value) => (
              <Link
                key={value}
                // Kanban is the default view and already lays every status out
                // as its own column, so picking a single-status filter here
                // implies switching to the list (`vista=list`) the filter
                // actually narrows.
                href={`${TEAM_BASE_PATH}/tareas?vista=list&estado=${value}`}
                className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <StatusBadge tone={value === status ? "info" : "neutral"}>
                  {t(`tasks.status.${value}`)}
                </StatusBadge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      {isKanban ? (
        <TasksKanban
          rows={rows}
          readOnly={!canManage}
          statusLabels={{
            OPEN: t("tasks.status.OPEN"),
            DONE: t("tasks.status.DONE"),
            CANCELLED: t("tasks.status.CANCELLED"),
          }}
          priorityLabels={
            Object.fromEntries(
              TASK_PRIORITIES.map((p) => [p, t(`tasks.priorityLabel.${p}`)]),
            ) as Record<TaskPriority, string>
          }
          errorLabels={{
            forbidden: t("tasks.errors.forbidden"),
            invalid: t("tasks.errors.invalid"),
            notFound: t("tasks.errors.notFound"),
            failed: t("tasks.errors.failed"),
          }}
          unassignedLabel={t("tasks.unassigned")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t(`tasks.status.${status}`)}</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tasks.noTasks")}
              </p>
            ) : (
              <ul className="divide-y">
                {rows.map((task) => (
                  <li
                    key={task.id}
                    className="space-y-2 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{task.titleEs}</p>
                        {task.detail ? (
                          <p className="max-w-2xl text-sm text-muted-foreground">
                            {task.detail}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge tone={priorityTone(task.priority)}>
                            {t(`tasks.priorityLabel.${task.priority}`)}
                          </StatusBadge>
                          <StatusBadge tone="neutral">
                            {t(`tasks.originLabel.${task.origin}`)}
                          </StatusBadge>
                          {task.participantCode ? (
                            <span data-numeric>{task.participantCode}</span>
                          ) : null}
                          {task.cohortCode ? (
                            <span data-numeric>{task.cohortCode}</span>
                          ) : null}
                          {task.dueAt ? (
                            <span data-numeric>
                              {t("tasks.dueAt")}:{" "}
                              {new Intl.DateTimeFormat("es-ES", {
                                dateStyle: "medium",
                                timeZone: ctx.study.timezone,
                              }).format(task.dueAt)}
                            </span>
                          ) : null}
                          {isOverdue(task, now) ? (
                            <StatusBadge tone="warning">
                              {t("tasks.overdue")}
                            </StatusBadge>
                          ) : null}
                          <span>
                            {task.assignedToName ?? t("tasks.unassigned")}
                          </span>
                        </div>
                      </div>

                      {canManage && task.status === "OPEN" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <CloseTaskForm
                            taskId={task.id}
                            status="DONE"
                            labels={{ ...labels, submit: t("tasks.markDone") }}
                          />
                          <CloseTaskForm
                            taskId={task.id}
                            status="CANCELLED"
                            labels={{ ...labels, submit: t("tasks.cancel") }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {canManage && task.status === "OPEN" ? (
                      <AssignTaskForm
                        taskId={task.id}
                        current={task.assignedTo}
                        staff={staffOptions}
                        labels={{
                          ...labels,
                          submit: t("tasks.assign"),
                          unassigned: t("tasks.unassigned"),
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: StatusTone;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        {/* An em dash rather than a fabricated zero when the filter cannot answer. */}
        <p data-numeric className="text-3xl font-semibold">
          {value ?? "—"}
        </p>
        {tone && value ? <StatusBadge tone={tone}>{value}</StatusBadge> : null}
      </CardContent>
    </Card>
  );
}

function priorityTone(priority: TaskPriority): StatusTone {
  switch (priority) {
    case "HIGH":
      return "warning";
    case "LOW":
      return "neutral";
    default:
      return "info";
  }
}
