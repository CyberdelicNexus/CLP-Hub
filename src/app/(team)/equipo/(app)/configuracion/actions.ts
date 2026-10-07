"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthorizationError } from "@/auth/authorize";
import { getStudyContext } from "@/auth/study-context";
import {
  ACTION_KINDS,
  ALERT_KINDS,
  CONDITION_KEYS,
  DELIVERY_MODES,
  EVENT_TYPES,
  OFFSET_MINUTES_MAX,
  OFFSET_MINUTES_MIN,
  RULE_KEY_PATTERN,
  RULE_NAME_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_TITLE_MAX_LENGTH,
  isValidOffset,
  type RuleConditions,
} from "@/domain/automation";
import { LOCALES } from "@/domain/locale";
import { PUBLIC_BASE_PATH, TEAM_BASE_PATH } from "@/domain/navigation";
import {
  SESSION_MODALITIES,
  SESSION_TEMPLATE_CODE_PATTERN,
  SESSION_TEMPLATE_NAME_MAX_LENGTH,
} from "@/domain/session";
import { STAGE_CODE_PATTERN, STAGE_NAME_MAX_LENGTH } from "@/domain/program-stage";
import { STUDY_STATUSES } from "@/domain/study";
import { logger } from "@/lib/logger";
import { createRule, NotFoundError, RuleError, setRuleActive } from "@/services/automation";
import {
  createProgramStage,
  ConflictError as ProgramStageConflictError,
  NotFoundError as ProgramStageNotFoundError,
  setProgramStageActive,
  updateProgramStage,
} from "@/services/program-stages";
import {
  createSessionTemplate,
  ConflictError as SessionConflictError,
  NotFoundError as SessionNotFoundError,
  renameSessionTemplateCode,
  setSessionTemplateActive,
  updateSessionTemplate,
} from "@/services/sessions";
import {
  InvalidSettingError,
  SCREENING_URL_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  updateStudySettings,
} from "@/services/study-settings";

/**
 * Study configuration actions.
 *
 * All of them need `study.settings.manage`, which only ADMIN holds. A
 * facilitator who can use a message template should not be able to change when
 * it fires, and a study manager who runs the trial should not be able to
 * silently repoint the screening URL every applicant is sent to (D-031, D-044).
 */

export type SettingsState = {
  error:
    | "forbidden"
    | "invalid"
    | "notFound"
    | "title"
    | "timezone"
    | "screeningUrl"
    | "duplicateKey"
    | "unavailableDeliveryMode"
    | "invalidOffset"
    | "shape"
    | "duplicateCode"
    | "failed"
    | null;
  ok?: boolean;
};

const uuid = z.string().uuid();

function fail(err: unknown, event: string): SettingsState {
  if (err instanceof AuthorizationError) {
    logger.warn({ event: `${event}.forbidden` }, "action refused");
    return { error: "forbidden" };
  }
  if (err instanceof NotFoundError) return { error: "notFound" };
  if (err instanceof SessionNotFoundError) return { error: "notFound" };
  if (err instanceof ProgramStageNotFoundError) return { error: "notFound" };
  if (err instanceof SessionConflictError) return { error: "duplicateCode" };
  if (err instanceof ProgramStageConflictError) return { error: "duplicateCode" };
  if (err instanceof InvalidSettingError) return { error: err.field };
  if (err instanceof RuleError) return { error: err.problem };
  logger.error(
    { event: `${event}.failed`, err: err instanceof Error ? err.message : String(err) },
    "action failed",
  );
  return { error: "failed" };
}

function revalidate() {
  revalidatePath(`${TEAM_BASE_PATH}/configuracion`);
  // The study title, timezone and status are rendered in the shell and read by
  // the public pages, so a change here is not local to this screen.
  revalidatePath(TEAM_BASE_PATH, "layout");
  revalidatePath("/", "layout");
}

// --- Study settings ---------------------------------------------------------

const settingsSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  status: z.enum(STUDY_STATUSES),
  defaultLocale: z.enum(LOCALES),
  timezone: z.string().trim().min(1).max(64),
  recruitmentOpen: z.union([z.literal("on"), z.literal("")]).optional(),
  screeningUrl: z.string().trim().max(SCREENING_URL_MAX_LENGTH).optional(),
});

export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = settingsSchema.safeParse({
    title: formData.get("title"),
    status: formData.get("status"),
    defaultLocale: formData.get("defaultLocale"),
    timezone: formData.get("timezone"),
    recruitmentOpen: formData.get("recruitmentOpen") ?? "",
    screeningUrl: formData.get("screeningUrl") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await updateStudySettings({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      patch: {
        title: parsed.data.title,
        status: parsed.data.status,
        defaultLocale: parsed.data.defaultLocale,
        timezone: parsed.data.timezone,
        recruitmentOpen: parsed.data.recruitmentOpen === "on",
        // An empty box clears the URL, which is a real choice: recruitment open
        // with nowhere to send people is a state the team may be mid-way through.
        screeningUrl: parsed.data.screeningUrl ?? "",
      },
    });
  } catch (err) {
    return fail(err, "study.settings");
  }

  revalidate();
  return { error: null, ok: true };
}

// --- Automation rules -------------------------------------------------------

const ruleSchema = z
  .object({
    key: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .refine((v) => RULE_KEY_PATTERN.test(v)),
    nameEs: z.string().trim().min(1).max(RULE_NAME_MAX_LENGTH),
    eventType: z.enum(EVENT_TYPES),
    actionKind: z.enum(ACTION_KINDS),
    offsetMinutes: z.coerce
      .number()
      .int()
      .min(OFFSET_MINUTES_MIN)
      .max(OFFSET_MINUTES_MAX)
      .refine(isValidOffset),
    deliveryMode: z.enum(DELIVERY_MODES).default("MANUAL"),
    communicationTemplateId: z.union([uuid, z.literal("")]).optional(),
    taskTitleEs: z.string().trim().max(TASK_TITLE_MAX_LENGTH).optional(),
    taskPriority: z.enum(TASK_PRIORITIES).default("NORMAL"),
    alertKind: z.union([z.enum(ALERT_KINDS), z.literal("")]).optional(),
    conditions: z.array(z.enum(CONDITION_KEYS)).default([]),
  })
  // The same shape the database enforces, checked here so the form gets a
  // useful message rather than a constraint violation.
  .refine((v) => {
    if (v.actionKind === "MESSAGE") return Boolean(v.communicationTemplateId);
    if (v.actionKind === "TASK") return Boolean(v.taskTitleEs);
    return Boolean(v.alertKind);
  });

export async function createRuleAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = ruleSchema.safeParse({
    key: formData.get("key"),
    nameEs: formData.get("nameEs"),
    eventType: formData.get("eventType"),
    actionKind: formData.get("actionKind"),
    offsetMinutes: formData.get("offsetMinutes") ?? 0,
    deliveryMode: formData.get("deliveryMode") ?? undefined,
    communicationTemplateId: formData.get("communicationTemplateId") ?? undefined,
    taskTitleEs: formData.get("taskTitleEs") ?? undefined,
    taskPriority: formData.get("taskPriority") ?? undefined,
    alertKind: formData.get("alertKind") ?? undefined,
    // Checkboxes: every condition the form offers, each simply required or not.
    // There is no operator and no value to submit — that is the whole point of
    // the allow-list (D-043).
    conditions: formData.getAll("conditions"),
  });
  if (!parsed.success) return { error: "shape" };

  const conditions: RuleConditions = {};
  for (const key of parsed.data.conditions) conditions[key] = true;

  try {
    assertPermission(ctx, "study.settings.manage");
    await createRule({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      key: parsed.data.key,
      nameEs: parsed.data.nameEs,
      eventType: parsed.data.eventType,
      actionKind: parsed.data.actionKind,
      offsetMinutes: parsed.data.offsetMinutes,
      deliveryMode: parsed.data.deliveryMode,
      communicationTemplateId: parsed.data.communicationTemplateId || null,
      taskTitleEs: parsed.data.taskTitleEs || null,
      taskPriority: parsed.data.taskPriority,
      alertKind: parsed.data.alertKind || null,
      conditions,
    });
  } catch (err) {
    return fail(err, "rule.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const toggleSchema = z.object({
  ruleId: uuid,
  active: z.enum(["true", "false"]),
});

/**
 * Turn a rule on or off.
 *
 * Deactivating stops it materialising NEW actions; it does not cancel the ones
 * already scheduled. Those were planned while the rule was live, will be
 * re-checked when they come due, and skipping them silently would be a
 * different decision from "stop doing this from now on".
 */
export async function toggleRuleAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = toggleSchema.safeParse({
    ruleId: formData.get("ruleId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await setRuleActive({
      studyId: ctx.study.id,
      ruleId: parsed.data.ruleId,
      actorId: ctx.session.userId,
      active: parsed.data.active === "true",
    });
  } catch (err) {
    return fail(err, "rule.toggle");
  }

  revalidate();
  return { error: null, ok: true };
}

// --- Programme: session templates and stages (2026-09-28 request) -----------
//
// Session names, order, modality and timings are this trial's programme
// design, so they are configuration rows (D-026, D-067), never values in
// code (non-negotiable 6) — and until now the only way to create one was a
// seed script or a direct database change, which is why a study other than
// DEMO had no programme to schedule sessions against. This section is that
// missing admin surface. Gated the same as automation rules: `study.settings
// .manage`, ADMIN only — a facilitator who schedules a session should not be
// able to redefine what the whole study's sessions are (D-044's reasoning).

const stageSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => STAGE_CODE_PATTERN.test(v)),
  nameEs: z.string().trim().min(1).max(STAGE_NAME_MAX_LENGTH),
  nameEn: z.string().trim().max(STAGE_NAME_MAX_LENGTH).optional(),
  modality: z.enum(SESSION_MODALITIES),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function createProgramStageAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = stageSchema.safeParse({
    code: formData.get("code"),
    nameEs: formData.get("nameEs"),
    nameEn: formData.get("nameEn") ?? undefined,
    modality: formData.get("modality"),
    position: formData.get("position") ?? 0,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await createProgramStage({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      code: parsed.data.code,
      nameEs: parsed.data.nameEs,
      nameEn: parsed.data.nameEn || null,
      modality: parsed.data.modality,
      position: parsed.data.position,
    });
  } catch (err) {
    return fail(err, "program_stage.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const stageUpdateSchema = z.object({
  stageId: uuid,
  nameEs: z.string().trim().min(1).max(STAGE_NAME_MAX_LENGTH),
  nameEn: z.string().trim().max(STAGE_NAME_MAX_LENGTH).optional(),
  modality: z.enum(SESSION_MODALITIES),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function updateProgramStageAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = stageUpdateSchema.safeParse({
    stageId: formData.get("stageId"),
    nameEs: formData.get("nameEs"),
    nameEn: formData.get("nameEn") ?? undefined,
    modality: formData.get("modality"),
    position: formData.get("position") ?? 0,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await updateProgramStage({
      studyId: ctx.study.id,
      stageId: parsed.data.stageId,
      actorId: ctx.session.userId,
      nameEs: parsed.data.nameEs,
      nameEn: parsed.data.nameEn || null,
      modality: parsed.data.modality,
      position: parsed.data.position,
    });
  } catch (err) {
    return fail(err, "program_stage.update");
  }

  revalidate();
  return { error: null, ok: true };
}

const stageToggleSchema = z.object({ stageId: uuid, active: z.enum(["true", "false"]) });

export async function toggleProgramStageAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = stageToggleSchema.safeParse({
    stageId: formData.get("stageId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await setProgramStageActive({
      studyId: ctx.study.id,
      stageId: parsed.data.stageId,
      actorId: ctx.session.userId,
      active: parsed.data.active === "true",
    });
  } catch (err) {
    return fail(err, "program_stage.toggle");
  }

  revalidate();
  return { error: null, ok: true };
}

const templateSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => SESSION_TEMPLATE_CODE_PATTERN.test(v)),
  nameEs: z.string().trim().min(1).max(SESSION_TEMPLATE_NAME_MAX_LENGTH),
  nameEn: z.string().trim().max(SESSION_TEMPLATE_NAME_MAX_LENGTH).optional(),
  stageId: z.union([uuid, z.literal("")]).optional(),
  armId: z.union([uuid, z.literal("")]).optional(),
  modality: z.enum(SESSION_MODALITIES),
  durationMinutes: z.coerce.number().int().positive().optional(),
  dayOffset: z.coerce.number().int().optional(),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function createSessionTemplateAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = templateSchema.safeParse({
    code: formData.get("code"),
    nameEs: formData.get("nameEs"),
    nameEn: formData.get("nameEn") ?? undefined,
    stageId: formData.get("stageId") ?? undefined,
    armId: formData.get("armId") ?? undefined,
    modality: formData.get("modality"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    dayOffset: formData.get("dayOffset") || undefined,
    position: formData.get("position") ?? 0,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await createSessionTemplate({
      studyId: ctx.study.id,
      actorId: ctx.session.userId,
      code: parsed.data.code,
      nameEs: parsed.data.nameEs,
      nameEn: parsed.data.nameEn || null,
      stageId: parsed.data.stageId || null,
      armId: parsed.data.armId || null,
      modality: parsed.data.modality,
      durationMinutes: parsed.data.durationMinutes ?? null,
      dayOffset: parsed.data.dayOffset ?? null,
      position: parsed.data.position,
    });
  } catch (err) {
    return fail(err, "session_template.create");
  }

  revalidate();
  return { error: null, ok: true };
}

const templateUpdateSchema = templateSchema.omit({ code: true }).extend({ templateId: uuid });

export async function updateSessionTemplateAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = templateUpdateSchema.safeParse({
    templateId: formData.get("templateId"),
    nameEs: formData.get("nameEs"),
    nameEn: formData.get("nameEn") ?? undefined,
    stageId: formData.get("stageId") ?? undefined,
    armId: formData.get("armId") ?? undefined,
    modality: formData.get("modality"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    dayOffset: formData.get("dayOffset") || undefined,
    position: formData.get("position") ?? 0,
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await updateSessionTemplate({
      studyId: ctx.study.id,
      templateId: parsed.data.templateId,
      actorId: ctx.session.userId,
      nameEs: parsed.data.nameEs,
      nameEn: parsed.data.nameEn || null,
      stageId: parsed.data.stageId || null,
      armId: parsed.data.armId || null,
      modality: parsed.data.modality,
      durationMinutes: parsed.data.durationMinutes ?? null,
      dayOffset: parsed.data.dayOffset ?? null,
      position: parsed.data.position,
    });
  } catch (err) {
    return fail(err, "session_template.update");
  }

  revalidate();
  return { error: null, ok: true };
}

const templateCodeSchema = z.object({
  templateId: uuid,
  code: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => SESSION_TEMPLATE_CODE_PATTERN.test(v)),
});

/**
 * Rename a session template's `code` — the URL segment its public
 * preparation/integration pages use (2026-09-29 request: S0's code was
 * literally "preparacion", which collided with the fixed "preparacion"/
 * "integracion" part segment to produce `/estudio/sesiones/preparacion/
 * preparacion`). Separate from `updateSessionTemplateAction` because
 * `templateUpdateSchema` deliberately excludes `code` — same "renaming a
 * slug is its own act, not bundled into the general edit form" shape as
 * `renameContentKeyAction` (contenido/actions.ts).
 */
export async function renameSessionTemplateCodeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = templateCodeSchema.safeParse({
    templateId: formData.get("templateId"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await renameSessionTemplateCode({
      studyId: ctx.study.id,
      templateId: parsed.data.templateId,
      actorId: ctx.session.userId,
      code: parsed.data.code,
    });
  } catch (err) {
    return fail(err, "session_template.rename_code");
  }

  revalidate();
  // Public preparation/integration pages read this code directly.
  revalidatePath(`${PUBLIC_BASE_PATH}/estudio`, "layout");
  return { error: null, ok: true };
}

const templateToggleSchema = z.object({ templateId: uuid, active: z.enum(["true", "false"]) });

export async function toggleSessionTemplateAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await getStudyContext();
  if (!ctx) return { error: "forbidden" };

  const parsed = templateToggleSchema.safeParse({
    templateId: formData.get("templateId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    assertPermission(ctx, "study.settings.manage");
    await setSessionTemplateActive({
      studyId: ctx.study.id,
      templateId: parsed.data.templateId,
      actorId: ctx.session.userId,
      active: parsed.data.active === "true",
    });
  } catch (err) {
    return fail(err, "session_template.toggle");
  }

  revalidate();
  return { error: null, ok: true };
}
