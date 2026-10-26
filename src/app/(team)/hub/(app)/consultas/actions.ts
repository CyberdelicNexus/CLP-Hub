"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { validateReply } from "@/domain/inquiry";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { logger } from "@/lib/logger";
import { answerInquiry, closeInquiry, InquiryMailError, InquiryNotFoundError } from "@/services/inquiries";

/**
 * Inquiry actions (D-088). Both need `inquiries.manage`. Answering sends the
 * email FIRST and only then erases the inquiry's text; if the email fails
 * nothing changes and the inquiry stays pending. Nothing typed here is logged.
 */

export type InquiryActionState = {
  error:
    | "forbidden"
    | "invalid"
    | "required"
    | "tooLong"
    | "notFound"
    | "mailNotConfigured"
    | "mailRejected"
    | "mailFailed"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): InquiryActionState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof InquiryNotFoundError) return { error: "notFound" };
  if (err instanceof InquiryMailError) {
    // Three different things for the person pressing send: nothing is set up,
    // the provider refused (usually an unverified sending domain, or a recipient
    // not allowed while testing), or it could not be reached at all.
    return {
      error: err.reason === "not_configured" ? "mailNotConfigured" : err.reason === "rejected" ? "mailRejected" : "mailFailed",
    };
  }
  logger.error({ event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) }, "action failed");
  return { error: "failed" };
}

function revalidate() {
  revalidatePath(`${TEAM_BASE_PATH}/consultas`);
  revalidatePath(TEAM_BASE_PATH);
}

export async function answerInquiryAction(_prev: InquiryActionState, formData: FormData): Promise<InquiryActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const id = uuid.safeParse(formData.get("inquiryId"));
  const reply = formData.get("reply");
  if (!id.success || typeof reply !== "string") return { error: "invalid" };
  const problem = validateReply(reply);
  if (problem) return { error: problem };

  try {
    assertPermission(ctx, "inquiries.manage");
    await answerInquiry({ studyId: ctx.study.id, inquiryId: id.data, actorId: ctx.session.userId, reply });
  } catch (err) {
    return fail(err, "inquiry.answer");
  }
  revalidate();
  return { error: null, ok: true };
}

export async function closeInquiryAction(_prev: InquiryActionState, formData: FormData): Promise<InquiryActionState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const id = uuid.safeParse(formData.get("inquiryId"));
  if (!id.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "inquiries.manage");
    await closeInquiry({ studyId: ctx.study.id, inquiryId: id.data, actorId: ctx.session.userId });
  } catch (err) {
    return fail(err, "inquiry.close");
  }
  revalidate();
  return { error: null, ok: true };
}
