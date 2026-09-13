"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import {
  TASK_DETAIL_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_TITLE_MAX_LENGTH,
} from "@/domain/automation";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { assignTask, closeTask, createTask, NotFoundError } from "@/services/automation";

/**
 * Task actions (Phase 8).
 *
 * `tasks.manage` covers creating, closing and assigning. It is deliberately
 * held by every role that does operational work — a facilitator who finishes
 * the thing the task describes is the person who should be able to close it —
 * and withheld from RESEARCHER, whose work is not an operational queue.
 */

export type TaskState = {
  error: "forbidden" | "invalid" | "notFound" | "failed" | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): TaskState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  logger.error(
    // Never the title and never the detail: both are staff-authored free text
    // about operational work, and the log is read under different rules.
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate() {
  revalidatePath(`${TEAM_BASE_PATH}/tareas`);
  revalidatePath(TEAM_BASE_PATH);
}

const createSchema = z.object({
  titleEs: z.string().trim().min(1).max(TASK_TITLE_MAX_LENGTH),
  detail: z.string().trim().max(TASK_DETAIL_MAX_LENGTH).optional(),
  priority: z.enum(TASK_PRIORITIES).default("NORMAL"),
  // A date, not a datetime: a task is due on a day, and asking for a time
  // invites a precision the work does not have.
  dueAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  assignedTo: z.union([uuid, z.literal("")]).optional(),
  participantId: z.union([uuid, z.literal("")]).optional(),
  cohortId: z.union([uuid, z.literal("")]).optional(),
});

export async function createTaskAction(_prev: TaskState, formData: FormData): Promise<TaskState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = createSchema.safeParse({
    titleEs: formData.get("titleEs"),
    detail: formData.get("detail") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    dueAt: formData.get("dueAt") ?? undefined,
    assignedTo: formData.get("assignedTo") ?? undefined,
    participantId: formData.get("participantId") ?? undefined,
    cohortId: formData.get("cohortId") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "tasks.manage");
    await createTask({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      titleEs: parsed.data.titleEs,
      detail: parsed.data.detail,
      priority: parsed.data.priority,
      // End of the day in the study's own timezone would need a library; the
      // date alone is what the team types and what the list sorts on.
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
      assignedTo: parsed.data.assignedTo || null,
      participantId: parsed.data.participantId || null,
      cohortId: parsed.data.cohortId || null,
    });
  } catch (err) {
    return fail(err, "task.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const closeSchema = z.object({
  taskId: uuid,
  status: z.enum(["DONE", "CANCELLED"]),
});

export async function closeTaskAction(_prev: TaskState, formData: FormData): Promise<TaskState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = closeSchema.safeParse({
    taskId: formData.get("taskId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "tasks.manage");
    await closeTask({
      studyId: ctx.study.id,
      taskId: parsed.data.taskId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "task.close");
  }

  revalidate();
  return { error: null, ok: true };
}

const assignSchema = z.object({
  taskId: uuid,
  assignedTo: z.union([uuid, z.literal("")]),
});

export async function assignTaskAction(_prev: TaskState, formData: FormData): Promise<TaskState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = assignSchema.safeParse({
    taskId: formData.get("taskId"),
    assignedTo: formData.get("assignedTo") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "tasks.manage");
    await assignTask({
      studyId: ctx.study.id,
      taskId: parsed.data.taskId,
      actorId: ctx.session.userId,
      assignedTo: parsed.data.assignedTo || null,
    });
  } catch (err) {
    return fail(err, "task.assign");
  }

  revalidate();
  return { error: null, ok: true };
}
