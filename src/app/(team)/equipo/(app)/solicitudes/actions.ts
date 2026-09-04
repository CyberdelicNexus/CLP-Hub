"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { APPLICATION_STATUSES } from "@/domain/recruitment";
import { logger } from "@/lib/logger";
import { InvalidTransitionError, setApplicationStatus } from "@/services/recruitment";

export type StatusActionState = { error: "forbidden" | "invalid" | "failed" | null; ok?: boolean };

const schema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
});

/**
 * Move an application to another triage state.
 *
 * The study is taken from the server-resolved context, never from the form, so
 * a crafted request cannot act on another study. Permission is asserted here
 * and the service records the audit row inside its transaction.
 */
export async function changeApplicationStatus(
  _prev: StatusActionState,
  formData: FormData,
): Promise<StatusActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = schema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "applications.manage");
    await setApplicationStatus({
      studyId: ctx.study.id,
      applicationId: parsed.data.applicationId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      logger.warn(
        { event: "application.status_forbidden", studyId: ctx.study.id },
        "status change refused",
      );
      return { error: "forbidden" };
    }
    if (err instanceof InvalidTransitionError) return { error: "invalid" };
    logger.error(
      { event: "application.status_failed", err: err instanceof Error ? err.message : String(err) },
      "status change failed",
    );
    return { error: "failed" };
  }

  revalidatePath(`${TEAM_BASE_PATH}/solicitudes`);
  revalidatePath(`${TEAM_BASE_PATH}/solicitudes/${parsed.data.applicationId}`);
  return { error: null, ok: true };
}
