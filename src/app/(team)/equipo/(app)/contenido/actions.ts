"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { createSupabaseServerClient } from "@/auth/supabase/server";
import { getStudyContext } from "@/auth/study-context";
import {
  CONTENT_KEY_PATTERN,
  CONTENT_TITLE_MAX_LENGTH,
  AUTHORABLE_CONTENT_TYPES,
  bodySchema,
} from "@/domain/content";
import { isSafeHref } from "@/domain/markdown";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import {
  ConflictError,
  createContent,
  createDraftFrom,
  InvalidTransitionError,
  NotFoundError,
  publishVersion,
  relinkContentSession,
  renameContentKey,
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
  coverImageUrl: z
    .string()
    .trim()
    .max(600)
    .refine((v) => v === "" || isSafeHref(v))
    .optional()
    .transform((v) => (v ? v : null)),
  coverImagePosition: z.coerce.number().int().min(0).max(100).default(50),
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
    coverImageUrl: formData.get("coverImageUrl") ?? undefined,
    coverImagePosition: formData.get("coverImagePosition") ?? undefined,
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
      coverImageUrl: parsed.data.coverImageUrl,
      coverImagePosition: parsed.data.coverImagePosition,
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

const relinkSchema = z.object({ contentId: uuid, sessionTemplateId: uuid });

/**
 * Assign an existing piece of session content (preparation or integration)
 * to a session template — either from the content detail page's own
 * relation field, or from the cohort workspace's "pick from existing
 * content" toggle on a session's content slot (2026-09-19 request). Both
 * call this one action.
 */
export async function relinkSessionAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = relinkSchema.safeParse({
    contentId: formData.get("contentId"),
    sessionTemplateId: formData.get("sessionTemplateId"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "content.manage");
    await relinkContentSession({
      studyId: ctx.study.id,
      contentId: parsed.data.contentId,
      actorId: ctx.session.userId,
      sessionTemplateId: parsed.data.sessionTemplateId,
    });
  } catch (err) {
    return fail(err, "content.relink");
  }

  revalidate(parsed.data.contentId);
  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
  return { error: null, ok: true };
}

const renameKeySchema = z.object({
  contentId: uuid,
  key: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => CONTENT_KEY_PATTERN.test(v)),
});

/**
 * Rename a content item's slug (2026-09-29 request — there was previously no
 * way to change `key` after creation at all). Doesn't move a redirect: an
 * already-shared link built from the old key just 404s from here on, which
 * the form's own copy warns about before submitting.
 */
export async function renameContentKeyAction(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = renameKeySchema.safeParse({
    contentId: formData.get("contentId"),
    key: formData.get("key"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "content.manage");
    await renameContentKey({
      studyId: ctx.study.id,
      contentId: parsed.data.contentId,
      actorId: ctx.session.userId,
      key: parsed.data.key,
    });
  } catch (err) {
    return fail(err, "content.renameKey");
  }

  revalidate(parsed.data.contentId);
  return { error: null, ok: true };
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadImageResult = { url: string; error?: undefined } | { url?: undefined; error: string };

/**
 * Uploads a staff-picked image file to the `content-images` Supabase Storage
 * bucket (supabase/migrations/0025_content_images_bucket.sql) and returns its
 * public URL — called directly from a client component (not through
 * `useActionState`; there's no form/prev-state here, just "upload this one
 * file"), unlike every other action in this file. Validates type and size
 * server-side before ever calling Storage: client-side validation is a UX
 * nicety, not a boundary anything here relies on. Uses
 * `createSupabaseServerClient()` (cookie-authenticated as the calling staff
 * member, anon key only) rather than a service-role client — the bucket's
 * RLS policies are the actual gate, scoped by role and by study.
 */
export async function uploadContentImageAction(formData: FormData): Promise<UploadImageResult> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };
  try {
    assertPermission(ctx, "content.manage");
  } catch {
    return { error: "forbidden" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "invalid" };
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) return { error: "unsupportedType" };
  if (file.size > MAX_IMAGE_BYTES) return { error: "tooLarge" };

  const path = `${ctx.study.id}/${crypto.randomUUID()}.${ext}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("content-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    logger.error({ event: "content.image_upload.failed", err: error.message }, "image upload failed");
    return { error: "failed" };
  }

  const { data } = supabase.storage.from("content-images").getPublicUrl(path);
  return { url: data.publicUrl };
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
