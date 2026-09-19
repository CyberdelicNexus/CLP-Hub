"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import {
  CONSENT_TYPES,
  CONSENT_VERSION_MAX_LENGTH,
  SCOPE_CODE_PATTERN,
} from "@/domain/consent";
import { isValidReasonNote } from "@/domain/eligibility-reason";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import { logger } from "@/lib/logger";
import {
  closeScreening,
  completeScreening,
  InvalidTransitionError,
  NotFoundError,
  ReasonError,
  ScopeError,
  recordConsentDecision,
  scheduleScreening,
  setEnrollmentStatus,
  setParticipantContactName,
  startConsent,
} from "@/services/participant-ops";

/**
 * Phase 2 staff actions.
 *
 * Every one of these resolves the study from the server-side context rather than
 * the form, asserts its own permission, and delegates to a service that writes
 * the change and its audit row in one transaction.
 *
 * None of them accept screening content: the only free-ish text permitted is an
 * external record identifier, length-capped, pointing at the approved system.
 */

export type OpState = {
  error:
    | "forbidden"
    | "invalid"
    | "badReference"
    | "notFound"
    | "failed"
    // Reason problems are their own errors because the fix is different: the
    // staff member has to choose a reason, not a different outcome (D-030).
    | "reasonRequired"
    | "reasonNotAllowed"
    | "reasonNotApplicable"
    | "noteTooLong"
    | "scopesNotAllowed"
    | "unknownScope"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

// An identifier, not prose. Rejects anything with whitespace runs or newlines so
// it cannot quietly become a notes field.
const externalRecordId = z
  .string()
  .trim()
  .max(EXTERNAL_RECORD_ID_MAX_LENGTH)
  .regex(/^[\w.:/-]*$/, "identifier only")
  .optional()
  .transform((v) => (v ? v : null));

/**
 * Distinguishes a rejected external reference from other validation failures, so
 * staff who typed a note into that field are told what is actually wrong rather
 * than getting a generic "not allowed".
 */
function validationError(issues: readonly { path: PropertyKey[] }[]): "badReference" | "invalid" {
  return issues.some((i) => i.path.includes("externalRecordId")) ? "badReference" : "invalid";
}

function fail(err: unknown, event: string): OpState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof InvalidTransitionError) return { error: "invalid" };
  // Surfaced verbatim so the form can say which of the four reason problems it
  // was; none of them carry participant data.
  if (err instanceof ReasonError) return { error: err.problem };
  if (err instanceof ScopeError) return { error: err.problem };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate(participantId?: string) {
  revalidatePath(`${TEAM_BASE_PATH}/participantes`);
  revalidatePath(`${TEAM_BASE_PATH}/evaluacion`);
  revalidatePath(TEAM_BASE_PATH);
  if (participantId) revalidatePath(`${TEAM_BASE_PATH}/participantes/${participantId}`);
}

// --- Screening --------------------------------------------------------------

const scheduleSchema = z.object({
  participantId: uuid,
  // datetime-local gives "YYYY-MM-DDTHH:mm" with no zone; interpreted as the
  // server's zone and stored as UTC, which is what the schema expects.
  scheduledAt: z.string().min(1),
});

export async function scheduleScreeningAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = scheduleSchema.safeParse({
    participantId: formData.get("participantId"),
    scheduledAt: formData.get("scheduledAt"),
  });
  if (!parsed.success) return { error: "invalid" };

  const when = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(when.getTime())) return { error: "invalid" };

  try {
    assertPermission(ctx, "screening.manage");
    await scheduleScreening({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      scheduledAt: when,
    });
  } catch (err) {
    return fail(err, "screening.schedule");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const completeSchema = z.object({
  participantId: uuid,
  screeningId: uuid,
  // PENDING is deliberately absent: "not determined" is an incomplete screening.
  result: z.enum(["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED", "WAITLIST"]),
  externalRecordId,
  reasonId: uuid.optional(),
  /**
   * One line of operational context. Newlines are rejected here as well as in
   * SQL so it cannot become a notes field; the length cap matches the domain.
   */
  reasonNote: z
    .string()
    .trim()
    // Length and the single-line rule both come from the domain, so the form,
    // the service and the SQL constraint cannot drift apart.
    .refine(isValidReasonNote)
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function completeScreeningAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = completeSchema.safeParse({
    participantId: formData.get("participantId"),
    screeningId: formData.get("screeningId"),
    result: formData.get("result"),
    externalRecordId: formData.get("externalRecordId") ?? undefined,
    reasonId: (formData.get("reasonId") as string | null) || undefined,
    reasonNote: (formData.get("reasonNote") as string | null) || undefined,
  });
  if (!parsed.success) return { error: validationError(parsed.error.issues) };

  try {
    assertPermission(ctx, "screening.manage");
    await completeScreening({
      studyId: ctx.study.id,
      screeningId: parsed.data.screeningId,
      actorId: ctx.session.userId,
      result: parsed.data.result,
      externalRecordId: parsed.data.externalRecordId,
      reasonId: parsed.data.reasonId ?? null,
      reasonNote: parsed.data.reasonNote,
    });
  } catch (err) {
    return fail(err, "screening.complete");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const moveSchema = z.object({
  participantId: uuid,
  screeningId: uuid,
  result: z.enum(["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED", "WAITLIST"]),
});

/**
 * Same write as `completeScreeningAction`, called directly for the
 * participantes kanban's drag-and-drop rather than bound to a `<form>`. The
 * board only offers ELIGIBLE/WAITLIST as drop targets (see
 * `participants-kanban.tsx`'s `isValidTarget`) because INELIGIBLE and
 * REVIEW_REQUIRED require a reason a drag gesture cannot supply — but this
 * still goes through the same `completeScreening` call, so that requirement
 * is enforced here too, not just hinted at client-side.
 */
export async function moveParticipantEligibility(
  participantId: string,
  screeningId: string,
  result: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getStudyContext();
  if (!ctx) return { ok: false, error: "forbidden" };

  const parsed = moveSchema.safeParse({ participantId, screeningId, result });
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    assertPermission(ctx, "screening.manage");
    await completeScreening({
      studyId: ctx.study.id,
      screeningId: parsed.data.screeningId,
      actorId: ctx.session.userId,
      result: parsed.data.result,
    });
  } catch (err) {
    const state = fail(err, "screening.kanban_move");
    return { ok: false, error: state.error ?? "failed" };
  }

  revalidate(parsed.data.participantId);
  return { ok: true };
}

const closeSchema = z.object({
  participantId: uuid,
  screeningId: uuid,
  status: z.enum(["NO_SHOW", "CANCELLED"]),
});

export async function closeScreeningAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = closeSchema.safeParse({
    participantId: formData.get("participantId"),
    screeningId: formData.get("screeningId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "screening.manage");
    await closeScreening({
      studyId: ctx.study.id,
      screeningId: parsed.data.screeningId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "screening.close");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

// --- Consent ----------------------------------------------------------------

const startConsentSchema = z.object({
  participantId: uuid,
  versionLabel: z.string().trim().min(1).max(CONSENT_VERSION_MAX_LENGTH),
  consentType: z.enum(CONSENT_TYPES).default("DIGITAL"),
  /**
   * Configured scope codes. Shape-checked here; membership is verified by the
   * service inside the transaction, against the scopes active at that moment.
   */
  grantedScopes: z.array(z.string().regex(SCOPE_CODE_PATTERN)).max(20).default([]),
});

export async function startConsentAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = startConsentSchema.safeParse({
    participantId: formData.get("participantId"),
    versionLabel: formData.get("versionLabel"),
    consentType: formData.get("consentType") ?? undefined,
    grantedScopes: formData.getAll("grantedScopes"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "consent.manage");
    await startConsent({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      versionLabel: parsed.data.versionLabel,
      consentType: parsed.data.consentType,
      grantedScopes: parsed.data.grantedScopes,
    });
  } catch (err) {
    return fail(err, "consent.start");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const decisionSchema = z.object({
  participantId: uuid,
  consentId: uuid,
  status: z.enum(["CONSENTED", "DECLINED", "WITHDRAWN"]),
  externalRecordId,
});

export async function recordConsentAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = decisionSchema.safeParse({
    participantId: formData.get("participantId"),
    consentId: formData.get("consentId"),
    status: formData.get("status"),
    externalRecordId: formData.get("externalRecordId") ?? undefined,
  });
  if (!parsed.success) return { error: validationError(parsed.error.issues) };

  try {
    assertPermission(ctx, "consent.manage");
    await recordConsentDecision({
      studyId: ctx.study.id,
      consentId: parsed.data.consentId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
      externalRecordId: parsed.data.externalRecordId,
    });
  } catch (err) {
    return fail(err, "consent.decision");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

// --- Contact ------------------------------------------------------------

const contactNameSchema = z.object({
  participantId: uuid,
  fullName: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
});

/**
 * Set (or clear) a participant's name from the staff UI (2026-09-19: "bring
 * back the ability to add names to the participants for the demo"). Gated
 * on `participants.manage` like every other write here, not a new
 * permission — this is the same contact data the application intake form
 * already writes, just entered by hand instead of imported.
 */
export async function setContactNameAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = contactNameSchema.safeParse({
    participantId: formData.get("participantId"),
    fullName: formData.get("fullName") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await setParticipantContactName({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      fullName: parsed.data.fullName,
    });
  } catch (err) {
    return fail(err, "participant.contact_name");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

// --- Enrollment -------------------------------------------------------------

const enrollmentSchema = z.object({
  participantId: uuid,
  status: z.enum(["WITHDRAWN", "COMPLETED"]),
});

export async function setEnrollmentAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = enrollmentSchema.safeParse({
    participantId: formData.get("participantId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await setEnrollmentStatus({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      status: parsed.data.status,
    });
  } catch (err) {
    return fail(err, "participant.enrollment");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}
