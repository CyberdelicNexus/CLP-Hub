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
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { STUDY_STATUSES } from "@/domain/study";
import { logger } from "@/lib/logger";
import { createRule, NotFoundError, RuleError, setRuleActive } from "@/services/automation";
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
