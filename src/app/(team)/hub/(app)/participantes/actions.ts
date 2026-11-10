"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import { SCOPE_CODE_PATTERN } from "@/domain/consent";
import { isValidReasonNote } from "@/domain/eligibility-reason";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { EXTERNAL_RECORD_ID_MAX_LENGTH } from "@/domain/screening";
import { logger } from "@/lib/logger";
import { parseStudyLocal } from "@/lib/study-time";
import {
  closeScreening,
  completeExclusionReason,
  completeScreening,
  DuplicateContactEmailError,
  InvalidTransitionError,
  NotFoundError,
  ReasonError,
  ScopeError,
  recordConsentDecision,
  recordEligibilityMove,
  scheduleScreening,
  setEnrollmentStatus,
  setParticipantContactEmail,
  setParticipantContactName,
  setParticipantContactPhone,
  setPhysicalConsent,
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
    | "duplicateEmail"
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
  if (err instanceof DuplicateContactEmailError) return { error: "duplicateEmail" };
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
  // Solicitudes cards carry the screening too (2026-10-28).
  revalidatePath(`${TEAM_BASE_PATH}/solicitudes`);
  revalidatePath(TEAM_BASE_PATH);
  if (participantId) revalidatePath(`${TEAM_BASE_PATH}/participantes/${participantId}`);
}

// --- Screening --------------------------------------------------------------

const scheduleSchema = z.object({
  participantId: uuid,
  // datetime-local gives "YYYY-MM-DDTHH:mm" with no zone; read in the STUDY's
  // timezone (parseStudyLocal, D-136), not the server's (UTC on Vercel).
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

  const when = parseStudyLocal(parsed.data.scheduledAt, ctx.study.timezone);
  if (!when) return { error: "invalid" };

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

const reasonSchema = z.object({
  participantId: uuid,
  screeningId: uuid,
  reasonId: uuid,
  reasonNote: z
    .string()
    .trim()
    .refine(isValidReasonNote)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Add the missing reason to a completed exclusion (D-150). */
export async function completeExclusionReasonAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = reasonSchema.safeParse({
    participantId: formData.get("participantId"),
    screeningId: formData.get("screeningId"),
    reasonId: formData.get("reasonId"),
    reasonNote: (formData.get("reasonNote") as string | null) || undefined,
  });
  if (!parsed.success) return { error: validationError(parsed.error.issues) };

  try {
    assertPermission(ctx, "screening.manage");
    await completeExclusionReason({
      studyId: ctx.study.id,
      screeningId: parsed.data.screeningId,
      actorId: ctx.session.userId,
      reasonId: parsed.data.reasonId,
      reasonNote: parsed.data.reasonNote,
    });
  } catch (err) {
    return fail(err, "screening.reason_complete");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const moveSchema = z.object({
  participantId: uuid,
  result: z.enum(["ELIGIBLE", "INELIGIBLE", "REVIEW_REQUIRED", "WAITLIST"]),
  reasonId: uuid.nullable(),
  reasonNote: z.string().nullable(),
});

/**
 * The participantes board's drop, called directly rather than bound to a
 * `<form>`. The board asks for the reason INELIGIBLE and REVIEW_REQUIRED need
 * before it calls this (`participants-kanban.tsx`), and the service still
 * refuses a drop without one.
 */
export async function moveParticipantEligibility(
  participantId: string,
  result: string,
  reason: { reasonId: string; reasonNote: string | null } | null,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getStudyContext();
  if (!ctx) return { ok: false, error: "forbidden" };

  const parsed = moveSchema.safeParse({
    participantId,
    result,
    reasonId: reason?.reasonId ?? null,
    reasonNote: reason?.reasonNote ?? null,
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    assertPermission(ctx, "screening.manage");
    await recordEligibilityMove({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      result: parsed.data.result,
      reasonId: parsed.data.reasonId,
      reasonNote: parsed.data.reasonNote,
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

const physicalConsentSchema = z.object({
  participantId: uuid,
  signed: z.enum(["on", "off"]),
  /**
   * Configured scope codes. Shape-checked here; membership is verified by the
   * service inside the transaction, against the scopes active at that moment.
   */
  grantedScopes: z.array(z.string().regex(SCOPE_CODE_PATTERN)).max(20).default([]),
});

/** The physical consent's tick, from the participant or from their visit card. */
export async function setPhysicalConsentAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = physicalConsentSchema.safeParse({
    participantId: formData.get("participantId"),
    signed: formData.get("signed"),
    grantedScopes: formData.getAll("grantedScopes"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "consent.manage");
    await setPhysicalConsent({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      signed: parsed.data.signed === "on",
      grantedScopes: parsed.data.grantedScopes,
    });
  } catch (err) {
    return fail(err, "consent.physical");
  }

  revalidate(parsed.data.participantId);
  revalidatePath(`${TEAM_BASE_PATH}/cohortes`);
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

const contactEmailSchema = z.object({
  participantId: uuid,
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "invalid email"),
});

/**
 * Set (or clear) a participant's email from the staff UI (2026-09-20:
 * "I need to be able to edit the person name, email and phone... we do
 * need to know who is the participant... in case we need to reach out
 * directly"). Gated on `participants.manage` — ADMIN and STUDY_MANAGER
 * only, the same two roles that can already edit anything else about a
 * participant. `participants.contact.read` (also held by LOGISTICS, for
 * shipping) still only shows this field; it does not gain the ability to
 * change it.
 */
export async function setContactEmailAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = contactEmailSchema.safeParse({
    participantId: formData.get("participantId"),
    email: formData.get("email") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await setParticipantContactEmail({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      email: parsed.data.email,
    });
  } catch (err) {
    return fail(err, "participant.contact_email");
  }

  revalidate(parsed.data.participantId);
  return { error: null, ok: true };
}

const contactPhoneSchema = z.object({
  participantId: uuid,
  phone: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
});

/** Set (or clear) a participant's phone — see `setContactEmailAction`'s doc
 * comment for the request and permission scope this answers. */
export async function setContactPhoneAction(_prev: OpState, formData: FormData): Promise<OpState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = contactPhoneSchema.safeParse({
    participantId: formData.get("participantId"),
    phone: formData.get("phone") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "participants.manage");
    await setParticipantContactPhone({
      studyId: ctx.study.id,
      participantId: parsed.data.participantId,
      actorId: ctx.session.userId,
      phone: parsed.data.phone,
    });
  } catch (err) {
    return fail(err, "participant.contact_phone");
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
