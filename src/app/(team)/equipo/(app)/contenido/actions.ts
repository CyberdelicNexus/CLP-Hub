"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import {
  CONTENT_KEY_PATTERN,
  CONTENT_TITLE_MAX_LENGTH,
  AUTHORABLE_CONTENT_TYPES,
  bodySchema,
} from "@/domain/content";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import {
  ConflictError,
  createContent,
  createDraftFrom,
  InvalidTransitionError,
  NotFoundError,
  publishVersion,
  saveVersion,
  setVersionStatus,
} from "@/services/content";

/**
 * Content authoring actions (Phase 5).
 *
 * Publishing is gated on `content.publish`, which is deliberately separate from
 * `content.manage`: drafting and approving are different acts, and the matrix
 * already grants them separately.
 */

export type ContentActionState = {
  error:
    | "forbidden"
    | "invalid"
    | "invalidBody"
    | "notEditable"
    | "duplicateKey"
    | "noSession"
    | "notFound"
    | "failed"
    | null;
  /** Human-readable body validation detail, shown next to the editor. */
  detail?: string;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): ContentActionState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  if (err instanceof ConflictError) return { error: err.reason };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(contentId?: string) {
  revalidatePath(`${TEAM_BASE_PATH}/contenido`);
  if (contentId) revalidatePath(`${TEAM_BASE_PATH}/contenido/${contentId}`);
  // Public pages are rendered per request, but revalidate the study index too.
  revalidatePath("/estudio", "layout");
}

const createSchema = z
  .object({
    // Only the types a person may still create. The retired message-template
    // types are refused here as well as hidden in the form (D-039).
    type: z.enum(AUTHORABLE_CONTENT_TYPES),
    key: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .refine((v) => CONTENT_KEY_PATTERN.test(v)),
    title: z.string().trim().min(1).max(CONTENT_TITLE_MAX_LENGTH),
    sessionTemplateId: z.string().optional(),
  })
  .refine(
    (v) =>
      !["SESSION_PREPARATION", "SESSION_INTEGRATION"].includes(v.type) || Boolean(v.sessionTemplateId),
    { path: ["sessionTemplateId"] },
  );

export async function createContentAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = createSchema.safeParse({
    type: formData.get("type"),
    key: formData.get("key"),
    title: formData.get("title"),
    sessionTemplateId: formData.get("sessionTemplateId") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "content.manage");
    await createContent({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      type: parsed.data.type,
      key: parsed.data.key,
      sessionTemplateId: parsed.data.sessionTemplateId || null,
      title: parsed.data.title,
      locale: "es", // Spanish is authoritative for study content (D-009).
    });
  } catch (err) {
    return fail(err, "content.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const saveSchema = z.object({
  contentId: uuid,
  versionId: uuid,
  title: z.string().trim().min(1).max(CONTENT_TITLE_MAX_LENGTH),
  body: z.string(),
});

export async function saveVersionAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = saveSchema.safeParse({
    contentId: formData.get("contentId"),
    versionId: formData.get("versionId"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "invalid" };

  // Parse and validate here so the author gets a precise message rather than a
  // generic failure from deeper down.
  let body: unknown;
  try {
    body = JSON.parse(parsed.data.body || "[]");
  } catch {
    return { error: "invalidBody", detail: "JSON" };
  }
  const checked = bodySchema.safeParse(body);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    return {
      error: "invalidBody",
      detail: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : undefined,
    };
  }

  try {
    assertPermission(ctx, "content.manage");
    await saveVersion({
      studyId: ctx.study.id,
      versionId: parsed.data.versionId,
      actorId: ctx.session.userId,
      title: parsed.data.title,
      body: checked.data,
    });
  } catch (err) {
    return fail(err, "content.save");
  }

  revalidate(parsed.data.contentId);
  return { error: null, ok: true };
}

const statusSchema = z.object({
  contentId: uuid,
  versionId: uuid,
  status: z.enum(["DRAFT", "REVIEW"]),
});

export async function setStatusAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = statusSchema.safeParse({
    contentId: formData.get("contentId"),
    versionId: formData.get("versionId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "content.manage");
    await setVersionStatus({
      studyId: ctx.study.id,
      versionId: parsed.data.versionId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "content.status");
  }

  revalidate(parsed.data.contentId);
  return { error: null, ok: true };
}

const idsSchema = z.object({ contentId: uuid, versionId: uuid });

export async function publishVersionAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = idsSchema.safeParse({
    contentId: formData.get("contentId"),
    versionId: formData.get("versionId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    // Publishing is its own permission: drafting and approving are different acts.
    assertPermission(ctx, "content.publish");
    await publishVersion({
      studyId: ctx.study.id,
      versionId: parsed.data.versionId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "content.publish");
  }

  revalidate(parsed.data.contentId);
  return { error: null, ok: true };
}

export async function createDraftAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = idsSchema.safeParse({
    contentId: formData.get("contentId"),
    versionId: formData.get("versionId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "content.manage");
    await createDraftFrom({
      studyId: ctx.study.id,
      versionId: parsed.data.versionId,
      actorId: ctx.session.userId,
    });
  } catch (err) {
    return fail(err, "content.draft");
  }

  revalidate(parsed.data.contentId);
  return { error: null, ok: true };
}
