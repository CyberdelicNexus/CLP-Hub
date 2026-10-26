"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_STAGES,
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_KEY_PATTERN,
  TEMPLATE_NAME_MAX_LENGTH,
} from "@/domain/communication";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { completeMessageAction } from "@/services/automation";
import {
  ConflictError,
  createTemplate,
  NotFoundError,
  recordSend,
  relinkTemplateSession,
  TemplateError,
  updateTemplate,
} from "@/services/communications";

/**
 * Communication staff actions (Phase 7).
 *
 * NONE OF THESE SEND ANYTHING. `markSentAction` records that a person copied a
 * message and sent it themselves (D-004). There is no outbound call in this
 * file, in the service it calls, or anywhere in this repository.
 *
 * Authoring a template needs `communications.manage`; recording a send needs
 * only `communications.read`, because the facilitator who pasted the message is
 * exactly the person who should be able to say so.
 */

export type CommsState = {
  error:
    | "forbidden"
    | "invalid"
    | "notFound"
    | "duplicateKey"
    | "unknownVariable"
    | "tooLong"
    | "empty"
    | "participantVariableInChannel"
    | "audienceMismatch"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): CommsState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof ConflictError) return { error: err.reason };
  if (err instanceof TemplateError) return { error: err.problem };
  logger.error(
    // Never the template body, never a rendered message (D-004 forbids storing
    // conversations; logging one would be worse than storing it).
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(participantId?: string) {
  revalidatePath(`${TEAM_BASE_PATH}/comunicaciones`);
  // The overview carries the prepared-queue count, so it goes stale the moment
  // somebody clears an item.
  revalidatePath(TEAM_BASE_PATH);
  if (participantId) revalidatePath(`${TEAM_BASE_PATH}/participantes/${participantId}`);
}

// --- Templates --------------------------------------------------------------

const templateSchema = z.object({
  key: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => TEMPLATE_KEY_PATTERN.test(v)),
  stage: z.enum(COMMUNICATION_STAGES),
  channel: z.enum(COMMUNICATION_CHANNELS),
  audience: z.enum(COMMUNICATION_AUDIENCES).default("PARTICIPANT"),
  sessionTemplateId: z.union([uuid, z.literal("")]).optional(),
  nameEs: z.string().trim().min(1).max(TEMPLATE_NAME_MAX_LENGTH),
  bodyEs: z.string().trim().min(1).max(TEMPLATE_BODY_MAX_LENGTH),
  bodyEn: z.string().trim().max(TEMPLATE_BODY_MAX_LENGTH).optional(),
});

export async function createTemplateAction(
  _prev: CommsState,
  formData: FormData,
): Promise<CommsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = templateSchema.safeParse({
    key: formData.get("key"),
    stage: formData.get("stage"),
    channel: formData.get("channel"),
    audience: formData.get("audience") ?? undefined,
    sessionTemplateId: formData.get("sessionTemplateId") ?? undefined,
    nameEs: formData.get("nameEs"),
    bodyEs: formData.get("bodyEs"),
    bodyEn: formData.get("bodyEn") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "communications.manage");
    await createTemplate({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      key: parsed.data.key,
      stage: parsed.data.stage,
      channel: parsed.data.channel,
      audience: parsed.data.audience,
      sessionTemplateId: parsed.data.sessionTemplateId || null,
      nameEs: parsed.data.nameEs,
      bodyEs: parsed.data.bodyEs,
      bodyEn: parsed.data.bodyEn,
    });
  } catch (err) {
    return fail(err, "template.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const updateSchema = z.object({
  templateId: uuid,
  nameEs: z.string().trim().min(1).max(TEMPLATE_NAME_MAX_LENGTH),
  bodyEs: z.string().trim().min(1).max(TEMPLATE_BODY_MAX_LENGTH),
  bodyEn: z.string().trim().max(TEMPLATE_BODY_MAX_LENGTH).optional(),
  // The session a message belongs to can change; who it is addressed to cannot.
  // Re-scoping a template staff already use would silently change what is legal
  // in it (D-041).
  sessionTemplateId: z.union([uuid, z.literal("")]).optional(),
  active: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function updateTemplateAction(
  _prev: CommsState,
  formData: FormData,
): Promise<CommsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = updateSchema.safeParse({
    templateId: formData.get("templateId"),
    nameEs: formData.get("nameEs"),
    bodyEs: formData.get("bodyEs"),
    bodyEn: formData.get("bodyEn") ?? undefined,
    sessionTemplateId: formData.get("sessionTemplateId") ?? undefined,
    active: formData.get("active") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "communications.manage");
    await updateTemplate({
      studyId: ctx.study.id,
      templateId: parsed.data.templateId,
      actorId: ctx.session.userId,
      nameEs: parsed.data.nameEs,
      bodyEs: parsed.data.bodyEs,
      bodyEn: parsed.data.bodyEn,
      sessionTemplateId: parsed.data.sessionTemplateId || null,
      active: parsed.data.active === "on",
    });
  } catch (err) {
    return fail(err, "template.update");
  }

  revalidate();
  return { error: null, ok: true };
}

const relinkSchema = z.object({ templateId: uuid, sessionTemplateId: uuid });

/** Assign an existing template to a session, from the cohort workspace's
 * session view (2026-09-19 request) rather than only from this page. */
export async function relinkTemplateSessionAction(
  _prev: CommsState,
  formData: FormData,
): Promise<CommsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = relinkSchema.safeParse({
    templateId: formData.get("templateId"),
    sessionTemplateId: formData.get("sessionTemplateId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "communications.manage");
    await relinkTemplateSession({
      studyId: ctx.study.id,
      templateId: parsed.data.templateId,
      actorId: ctx.session.userId,
      sessionTemplateId: parsed.data.sessionTemplateId,
    });
  } catch (err) {
    return fail(err, "template.relink");
  }

  revalidate();
  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  return { error: null, ok: true };
}

// --- Recording a send -------------------------------------------------------

const sendSchema = z
  .object({
    participantId: z.union([uuid, z.literal("")]).optional(),
    cohortId: z.union([uuid, z.literal("")]).optional(),
    templateId: uuid,
    status: z.enum(["SENT", "SKIPPED"]).default("SENT"),
    skipReason: z.string().trim().max(280).optional(),
    /** Present when the composer was opened from the prepared queue. */
    actionId: z.union([uuid, z.literal("")]).optional(),
  })
  // Exactly one subject, refused here as well as in SQL so the form gets a
  // useful error rather than a constraint violation.
  .refine((v) => Boolean(v.participantId) !== Boolean(v.cohortId));

/**
 * Mark a message as sent — AFTER a person copied it and sent it themselves.
 *
 * The rendered text is never submitted with this form. It exists only in the
 * browser, was shown for the preview, and goes away with the page. What is
 * stored is the template, its version, and the fact (D-039).
 */
export async function markSentAction(_prev: CommsState, formData: FormData): Promise<CommsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = sendSchema.safeParse({
    participantId: formData.get("participantId") ?? undefined,
    cohortId: formData.get("cohortId") ?? undefined,
    templateId: formData.get("templateId"),
    status: formData.get("status") ?? undefined,
    skipReason: formData.get("skipReason") ?? undefined,
    actionId: formData.get("actionId") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const target = parsed.data.participantId
    ? ({ kind: "PARTICIPANT", participantId: parsed.data.participantId } as const)
    : ({ kind: "COHORT_CHANNEL", cohortId: parsed.data.cohortId as string } as const);

  try {
    // Read, not manage: the facilitator who pasted the message is the person who
    // should be able to say they did.
    assertPermission(ctx, "communications.read");
    const communicationId = await recordSend({
      studyId: ctx.study.id,
      target,
      templateId: parsed.data.templateId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
      skipReason: parsed.data.skipReason,
    });

    // Close the queue item this send answers. Only on a real send: a SKIPPED
    // record says the person decided not to send it, and the prepared action
    // should stay visible rather than disappear as if it had gone out.
    if (parsed.data.actionId && parsed.data.status === "SENT") {
      await completeMessageAction({
        studyId: ctx.study.id,
        actionId: parsed.data.actionId,
        actorId: ctx.session.userId,
        communicationId,
      });
    }
  } catch (err) {
    return fail(err, "communication.record");
  }

  revalidate(parsed.data.participantId || undefined);
  return { error: null, ok: true };
}
