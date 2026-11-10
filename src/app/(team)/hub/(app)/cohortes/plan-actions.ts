"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { parseStudyLocal } from "@/lib/study-time";
import { PlanLockedError, setPlannedMessage } from "@/services/cohort-plan";
import { NotFoundError } from "@/services/sessions";
import { setParticipantVisit, setVisitQuestionnaire, VisitNotAllowedError } from "@/services/visits";

/**
 * A cohort's individual visits and its message plan (2026-10-28, D-136).
 * Same shape as every other action here: study from the server-side context,
 * the action's own permission, then a service that writes with its audit row.
 */

export type PlanState = {
  error:
    | "forbidden"
    | "invalid"
    | "notFound"
    | "notIndividual"
    | "notMember"
    | "notBooked"
    | "notConfigured"
    | "hasRecord"
    | "locked"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): PlanState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof VisitNotAllowedError) return { error: err.reason };
  if (err instanceof PlanLockedError) return { error: "locked" };
  logger.error({ event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) }, "action failed");
  return { error: "failed" };
}

/** An empty value clears the date; anything else must be a valid wall-clock time. */
function readWhen(value: FormDataEntryValue | null, timeZone: string): Date | null | "bad" {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return parseStudyLocal(raw, timeZone) ?? "bad";
}

async function saveVisit(
  formData: FormData,
  permission: "sessions.manage" | "logistics.manage",
): Promise<PlanState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const ids = z
    .object({ cohortId: uuid, participantId: uuid, templateId: uuid })
    .safeParse({
      cohortId: formData.get("cohortId"),
      participantId: formData.get("participantId"),
      templateId: formData.get("templateId"),
    });
  const when = readWhen(formData.get("scheduledAt"), ctx.study.timezone);
  if (!ids.success || when === "bad") return { error: "invalid" };

  try {
    assertPermission(ctx, permission);
    await setParticipantVisit({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      scheduledAt: when,
      handoffOnly: permission === "logistics.manage",
      ...ids.data,
    });
  } catch (err) {
    return fail(err, "visit.set");
  }

  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  revalidatePath(`${TEAM_BASE_PATH}/logistica-vr`);
  revalidatePath(`${TEAM_BASE_PATH}/calendario`);
  return { error: null, ok: true };
}

export async function setParticipantVisitAction(_prev: PlanState, formData: FormData): Promise<PlanState> {
  return saveVisit(formData, "sessions.manage");
}

/** The same booking from VR logistics, limited to delivery and pickup visits (D-143). */
export async function setHandoffVisitAction(_prev: PlanState, formData: FormData): Promise<PlanState> {
  return saveVisit(formData, "logistics.manage");
}

export async function setVisitQuestionnaireAction(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = z
    .object({ participantId: uuid, templateId: uuid, captured: z.enum(["on", "off"]) })
    .safeParse({
      participantId: formData.get("participantId"),
      templateId: formData.get("templateId"),
      captured: formData.get("captured"),
    });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "sessions.manage");
    await setVisitQuestionnaire({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      participantId: parsed.data.participantId,
      templateId: parsed.data.templateId,
      captured: parsed.data.captured === "on",
    });
  } catch (err) {
    return fail(err, "visit.questionnaire");
  }

  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  return { error: null, ok: true };
}

export async function setPlannedMessageAction(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const ids = z
    .object({ cohortId: uuid, templateId: uuid })
    .safeParse({ cohortId: formData.get("cohortId"), templateId: formData.get("templateId") });
  // "remove" clears it explicitly; an empty date on an add is a mistake.
  const removing = formData.get("intent") === "remove";
  const when = removing ? null : readWhen(formData.get("sendAt"), ctx.study.timezone);
  if (!ids.success || when === "bad" || (!removing && when === null)) return { error: "invalid" };

  try {
    assertPermission(ctx, "communications.manage");
    await setPlannedMessage({ studyId: ctx.study.id, actorId: ctx.session.userId, sendAt: when, ...ids.data });
  } catch (err) {
    return fail(err, "cohort_plan.set");
  }

  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  return { error: null, ok: true };
}
