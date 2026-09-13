/**
 * Automation: events, rules, scheduled actions, tasks and alerts (Phase 8).
 *
 * The model is STATE + EVENT + RULE → ACTION (docs/automations.md). Nothing in
 * this module encodes a trial-specific timing, template or threshold: a rule is
 * a configuration row, and the code here only knows how to read one.
 *
 * THREE THINGS THIS MODULE DOES NOT DO, AND WILL NOT.
 *
 * 1. **It does not deliver anything.** An action that comes due is PREPARED and
 *    handed to a person; the system never sends. That is D-004 and D-039, and
 *    Phase 8 does not weaken it — a processor that could send a message to a
 *    participant in a psychological trial would eventually send one by accident.
 *    `DELIVERY_MODES` keeps AUTOMATIC in the vocabulary because the design asked
 *    for it, and `isDeliveryModeAvailable` refuses it, in one place, with the
 *    reason attached.
 *
 * 2. **It does not judge a participant.** Rule conditions are a CLOSED LIST of
 *    operational predicates (`CONDITION_KEYS`) — is this person still active, is
 *    this session still scheduled, is this device still out. There is no
 *    expression language, no field access and nothing clinical to test, for the
 *    same reason `TEMPLATE_VARIABLES` is closed: a rule that could read an
 *    arbitrary column would eventually branch on a screening result.
 *
 * 3. **It does not decide anything at schedule time.** The go/no-go is taken
 *    when the action is due, against the state as it is THEN. A reminder
 *    scheduled on Monday for someone who withdrew on Tuesday is skipped with a
 *    reason, never prepared. The stored snapshot is for traceability and is
 *    never consulted for the decision.
 */

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * The operational facts a rule can hang off.
 *
 * Every one of these is something the team DID or something that was BOOKED —
 * never a determination about a person. `ELIGIBILITY_DETERMINED` records that a
 * determination was made, not what it was; a rule can act on the fact that
 * screening finished without ever seeing the result.
 *
 * Additions belong here first, with a migration, so the set a study can build
 * rules on is auditable in one place.
 */
export const EVENT_TYPES = [
  "APPLICATION_SUBMITTED",
  "SCREENING_SCHEDULED",
  "SCREENING_COMPLETED",
  "ELIGIBILITY_DETERMINED",
  "CONSENT_RECORDED",
  "ALLOCATION_RECORDED",
  "COHORT_ASSIGNED",
  "COHORT_STATUS_CHANGED",
  "VISIT_SCHEDULED",
  "SESSION_SCHEDULED",
  "SESSION_RESCHEDULED",
  "SESSION_CANCELLED",
  "SESSION_HELD",
  "DEVICE_ASSIGNED",
  "DEVICE_DELIVERED",
  "DEVICE_RETURN_REQUESTED",
  "DEVICE_RETURNED",
  "PARTICIPANT_WITHDRAWN",
  "PARTICIPANT_COMPLETED",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);
}

/**
 * Events whose arrival INVALIDATES work already scheduled against their subject.
 *
 * Rescheduling a session does not edit the reminders that were already planned
 * for it; it cancels them and lets the new event create new ones (the rule
 * docs/automations.md states). Editing in place would quietly rewrite a row
 * whose audit trail says it was scheduled for a different time.
 */
export const INVALIDATING_EVENTS: readonly EventType[] = [
  "SESSION_RESCHEDULED",
  "SESSION_CANCELLED",
  "PARTICIPANT_WITHDRAWN",
];

export function invalidatesPriorSchedule(event: EventType): boolean {
  return INVALIDATING_EVENTS.includes(event);
}

// ---------------------------------------------------------------------------
// What an event is attached to
// ---------------------------------------------------------------------------

/**
 * The subject an event, action, task or alert is about.
 *
 * STUDY is a real subject, not a null case: a sweep that finds three exclusions
 * recorded without a reason is about the study, not about any of the three
 * people — and naming one of them would be worse than naming none.
 */
export const SUBJECT_KINDS = ["PARTICIPANT", "COHORT", "SESSION", "DEVICE", "STUDY"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export function isSubjectKind(v: unknown): v is SubjectKind {
  return typeof v === "string" && (SUBJECT_KINDS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** What a rule produces when it fires. */
export const ACTION_KINDS = ["MESSAGE", "TASK", "ALERT"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export function isActionKind(v: unknown): v is ActionKind {
  return typeof v === "string" && (ACTION_KINDS as readonly string[]).includes(v);
}

/**
 * How a prepared message reaches a person.
 *
 * READ `isDeliveryModeAvailable` BEFORE ADDING A SENDER. All three modes exist
 * in the vocabulary because docs/automations.md designed for all three, but only
 * two of them describe something this application can actually do.
 */
export const DELIVERY_MODES = ["MANUAL", "APPROVAL_REQUIRED", "AUTOMATIC"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export function isDeliveryMode(v: unknown): v is DeliveryMode {
  return typeof v === "string" && (DELIVERY_MODES as readonly string[]).includes(v);
}

/**
 * Whether nothing in this repository can send a message on its own.
 *
 * Stated as a constant, like `STORES_RENDERED_MESSAGE`, so the claim is one
 * grep away and a test can pin it. AUTOMATIC delivery would need an outbound
 * client, a credential and an endpoint; none exist, and `tests/automation.test.ts`
 * asserts their absence across the whole feature rather than trusting it.
 */
export const CAN_DELIVER_WITHOUT_A_PERSON = false;

/**
 * AUTOMATIC is refused at save time rather than at execution time.
 *
 * A rule saved as AUTOMATIC and then quietly downgraded to MANUAL when it fires
 * would tell the team their reminders were going out. Refusing the rule means
 * the misunderstanding surfaces while someone is still looking at the form.
 *
 * Whether logistics email may ever be AUTOMATIC is a founder decision, recorded
 * as an open question in docs/decisions.md, not one this code should make.
 */
export function isDeliveryModeAvailable(mode: DeliveryMode): boolean {
  if (mode === "AUTOMATIC") return CAN_DELIVER_WITHOUT_A_PERSON;
  return true;
}

/**
 * Offsets are minutes from the event's anchor. Negative is before it.
 *
 * Bounded at a year either way — not to be clever, but because a typo of
 * `-14400` for `-1440` would otherwise schedule a reminder ten days early and
 * nobody would notice until it appeared in the queue.
 */
export const OFFSET_MINUTES_MIN = -527_040; // ~366 days before
export const OFFSET_MINUTES_MAX = 527_040; // ~366 days after

export function isValidOffset(minutes: number): boolean {
  return (
    Number.isInteger(minutes) && minutes >= OFFSET_MINUTES_MIN && minutes <= OFFSET_MINUTES_MAX
  );
}

/**
 * When an action fires: the event's anchor, shifted by the rule's offset.
 *
 * The ANCHOR, not the moment the event was recorded. "24 h before session" is
 * relative to when the session starts; "immediately after the application" is
 * relative to when it arrived. An event carries both, and a rule never has to
 * know which kind it is reading.
 */
export function scheduledFor(anchorAt: Date, offsetMinutes: number): Date {
  return new Date(anchorAt.getTime() + offsetMinutes * 60_000);
}

export const RULE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,47}$/;
export const RULE_NAME_MAX_LENGTH = 120;

/**
 * An offset in the largest unit that says it exactly.
 *
 * Rules are stored and edited in minutes, because that is the only unit that
 * expresses every timing the previous study used without rounding. Reading them
 * back in minutes is another matter: "2880 min antes" is a sum somebody has to
 * do in their head on the screen where they are deciding whether the rule is
 * right.
 *
 * Exactness is the rule — 90 minutes stays 90 minutes rather than becoming
 * "1.5 h", because a rounded number on a configuration screen is a number
 * somebody will later quote as the setting.
 */
export type OffsetUnit = "minutes" | "hours" | "days";

export interface OffsetDescription {
  direction: "same" | "before" | "after";
  unit: OffsetUnit;
  /** Always positive; `direction` carries the sign. */
  value: number;
}

export function describeOffset(minutes: number): OffsetDescription {
  if (minutes === 0) return { direction: "same", unit: "minutes", value: 0 };

  const direction = minutes < 0 ? "before" : "after";
  const magnitude = Math.abs(minutes);

  if (magnitude % 1440 === 0) return { direction, unit: "days", value: magnitude / 1440 };
  if (magnitude % 60 === 0) return { direction, unit: "hours", value: magnitude / 60 };
  return { direction, unit: "minutes", value: magnitude };
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/**
 * The complete list of things a rule may test.
 *
 * A CLOSED LIST, and that is the whole safety model — the same argument
 * `TEMPLATE_VARIABLES` makes. Every key below is operational: whether a person
 * is still in the study, whether a booking still stands, whether a headset is
 * still out. None of them can read an eligibility result, a consent scope, an
 * arm, a screening note or anything else from Category C.
 *
 * There is deliberately no operator, no value and no expression: a condition is
 * a named predicate that is either required or not. `{"participantActive": true}`
 * is the entire vocabulary. Anything richer would eventually be used to write a
 * clinical rule, which this application must never hold (CLAUDE.md rule 3).
 */
export const CONDITION_KEYS = [
  /** Not withdrawn and not completed. The condition nearly every rule wants. */
  "participantActive",
  /** Currently enrolled, randomized or assigned to a cohort. */
  "participantEnrolled",
  /** At least one consent recorded and not withdrawn. Existence only — never a scope. */
  "consentActive",
  /** Still assigned to a cohort that has not finished. */
  "cohortActive",
  /** The session this action is about is still SCHEDULED. */
  "sessionScheduled",
  /** Attendance for that session has not been recorded yet. */
  "attendanceNotRecorded",
  /** The participant has a device assignment that is still open. */
  "deviceOut",
  /** The participant's setup has not been reported READY. */
  "vrNotReady",
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

export function isConditionKey(v: unknown): v is ConditionKey {
  return typeof v === "string" && (CONDITION_KEYS as readonly string[]).includes(v);
}

/** A rule's conditions: named predicates, each required to be true. */
export type RuleConditions = Partial<Record<ConditionKey, boolean>>;

/**
 * Parse a `conditions_json` column into something safe to evaluate.
 *
 * Unknown keys are DROPPED, not rejected, and that is deliberate: a row written
 * by an older version of the app, or by hand, must not be able to make the
 * processor throw on every run. What it must not do is silently take effect, so
 * anything not in the allow-list is discarded and the caller is told.
 */
export function parseConditions(raw: unknown): { conditions: RuleConditions; dropped: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { conditions: {}, dropped: [] };
  }
  const conditions: RuleConditions = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isConditionKey(key) && typeof value === "boolean") {
      conditions[key] = value;
    } else {
      dropped.push(key);
    }
  }
  return { conditions, dropped };
}

/**
 * The operational facts an action is re-checked against when it comes due.
 *
 * Note what is absent: no eligibility status, no consent scope, no arm, no
 * screening result, no contact detail. Every field is a yes/no about whether
 * work still makes sense. If a future condition needs more than this shape can
 * express, that is the signal to ask a researcher, not to widen the type.
 */
export interface ConditionFacts {
  participantActive: boolean;
  participantEnrolled: boolean;
  consentActive: boolean;
  cohortActive: boolean;
  sessionScheduled: boolean;
  attendanceNotRecorded: boolean;
  deviceOut: boolean;
  vrNotReady: boolean;
}

/**
 * Why an action was not prepared. Stored on the row and shown to staff, so it
 * is a vocabulary rather than free text — "SKIPPED: participantActive" can be
 * counted; "skipped because the person left" cannot.
 */
export type ConditionFailure = ConditionKey;

/**
 * Evaluate a rule's conditions against the facts as they are NOW.
 *
 * Returns every unmet condition rather than the first, because a row that says
 * "the person withdrew AND the session was cancelled" is more use to whoever
 * reads the log than one that stops at the first.
 */
export function unmetConditions(
  conditions: RuleConditions,
  facts: ConditionFacts,
): ConditionFailure[] {
  const unmet: ConditionFailure[] = [];
  for (const key of CONDITION_KEYS) {
    const required = conditions[key];
    if (required === undefined) continue;
    if (facts[key] !== required) unmet.push(key);
  }
  return unmet;
}

// ---------------------------------------------------------------------------
// Scheduled actions
// ---------------------------------------------------------------------------

/**
 * The life of one scheduled action.
 *
 * READ THE ABSENCE: there is no SENT and no DELIVERED. The furthest this
 * application can move an action on its own is READY — prepared, re-checked,
 * and waiting for a person. DONE is a human saying they acted (D-004).
 */
export const SCHEDULED_ACTION_STATUSES = [
  /** Scheduled, not yet due. */
  "PENDING",
  /** Due, re-checked, and waiting for a person. The system goes no further. */
  "READY",
  /** A person acted: pasted the message and marked it, or closed the task. */
  "DONE",
  /** Due, re-checked, and no longer appropriate. Carries the unmet condition. */
  "SKIPPED",
  /** The anchor moved or the rule was retired before it came due. */
  "CANCELLED",
  /** Processing itself failed. Raises an alert; never silently dropped. */
  "FAILED",
] as const;
export type ScheduledActionStatus = (typeof SCHEDULED_ACTION_STATUSES)[number];

export function isScheduledActionStatus(v: unknown): v is ScheduledActionStatus {
  return typeof v === "string" && (SCHEDULED_ACTION_STATUSES as readonly string[]).includes(v);
}

/** Statuses the processor may still move. Everything else is finished. */
export const OPEN_ACTION_STATUSES: readonly ScheduledActionStatus[] = ["PENDING", "READY"];

export function isOpenAction(status: ScheduledActionStatus): boolean {
  return OPEN_ACTION_STATUSES.includes(status);
}

/**
 * The verdict the processor reaches for one due action.
 *
 * `prepare` is as far as it goes. There is no `deliver`, and adding one would
 * have to pass `tests/automation.test.ts`, which asserts that no HTTP client,
 * credential or endpoint exists anywhere in this feature.
 */
export type ProcessVerdict =
  | { decision: "prepare" }
  | { decision: "skip"; unmet: ConditionFailure[] }
  | { decision: "refuse"; reason: "unavailableDeliveryMode" };

/**
 * Decide what to do with an action that has come due.
 *
 * Pure, and unit-tested without a database, so the rule that matters most —
 * the state is read NOW, not when the action was scheduled — is provable.
 */
export function decide(params: {
  conditions: RuleConditions;
  facts: ConditionFacts;
  deliveryMode: DeliveryMode;
}): ProcessVerdict {
  if (!isDeliveryModeAvailable(params.deliveryMode)) {
    return { decision: "refuse", reason: "unavailableDeliveryMode" };
  }
  const unmet = unmetConditions(params.conditions, params.facts);
  if (unmet.length > 0) return { decision: "skip", unmet };
  return { decision: "prepare" };
}

/**
 * Actions due at `now`, oldest first.
 *
 * There is no grace window and no "too old to bother". A reminder that should
 * have been prepared on Friday and was not, because the processor was down, is
 * still prepared on Monday — with its original `scheduled_for` visible, so the
 * person deciding whether to send it can see it is late. Dropping it silently
 * would hide an outage.
 */
export function isDue(scheduledForAt: Date, now: Date): boolean {
  return scheduledForAt.getTime() <= now.getTime();
}

export const SKIP_REASON_MAX_LENGTH = 280;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isTaskStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (TASK_STATUSES as readonly string[]).includes(v);
}

/**
 * Three levels, not five. A scale with more rungs than the team can distinguish
 * gets used as a mood ring, and then sorting by it means nothing.
 */
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function isTaskPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && (TASK_PRIORITIES as readonly string[]).includes(v);
}

/** Who put the task there. A person can close any of them; only a person creates a MANUAL one. */
export const TASK_ORIGINS = ["MANUAL", "RULE"] as const;
export type TaskOrigin = (typeof TASK_ORIGINS)[number];

export function isTaskOrigin(v: unknown): v is TaskOrigin {
  return typeof v === "string" && (TASK_ORIGINS as readonly string[]).includes(v);
}

export const TASK_TITLE_MAX_LENGTH = 160;
export const TASK_DETAIL_MAX_LENGTH = 1000;

/**
 * A task's free-text fields are staff-authored and land on a shared screen.
 *
 * This is the same warning the visit note carries (D-035): nothing stops a
 * person typing a clinical observation into a text box, and nothing here should
 * pretend otherwise. The length cap is not a safeguard; the documented boundary
 * and the audit trail are.
 */
export const TASK_TEXT_IS_STAFF_AUTHORED = true;

export function isValidTaskTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= TASK_TITLE_MAX_LENGTH;
}

/** Overdue is strictly past, and only for tasks still open. */
export function isOverdue(task: { dueAt: Date | null; status: TaskStatus }, now: Date): boolean {
  if (task.status !== "OPEN" || !task.dueAt) return false;
  return task.dueAt.getTime() < now.getTime();
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/**
 * What the application is willing to raise an alert about.
 *
 * EVERY KIND HERE IS AN OPERATIONAL OR RECORD-KEEPING FACT — something is
 * missing, late, or inconsistent in the data the team keeps. None of them is a
 * judgement about a participant, and none can be, because the sweeps that raise
 * them (see `src/services/automation.ts`) only ever read the operational
 * columns.
 *
 * Several of these were open questions in docs/decisions.md — "should X raise an
 * alert?" — and D-043 answers them the same way: surface it, name it, and let a
 * person decide. An alert here means "someone should look", never "the system
 * has concluded".
 */
export const ALERT_KINDS = [
  /** An allocation exists for someone with no active consent recorded. */
  "ALLOCATION_WITHOUT_CONSENT",
  /** A cohort is ACTIVE with fewer members than its configured minimum. */
  "COHORT_UNDERSIZED",
  /** A cohort holds more members than its configured maximum. */
  "COHORT_OVER_CAPACITY",
  /** A headset is past its expected return date and still out. */
  "DEVICE_RETURN_OVERDUE",
  /** An INELIGIBLE determination was recorded with no reason attached. */
  "EXCLUSION_WITHOUT_REASON",
  /** A session is close and the participant's setup is not reported READY. */
  "VR_NOT_READY_BEFORE_SESSION",
  /** Processing a scheduled action threw. Never swallowed. */
  "SCHEDULED_ACTION_FAILED",
  /** A rule references a template or session that no longer exists or is retired. */
  "RULE_MISCONFIGURED",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export function isAlertKind(v: unknown): v is AlertKind {
  return typeof v === "string" && (ALERT_KINDS as readonly string[]).includes(v);
}

export const ALERT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export function isAlertSeverity(v: unknown): v is AlertSeverity {
  return typeof v === "string" && (ALERT_SEVERITIES as readonly string[]).includes(v);
}

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export function isAlertStatus(v: unknown): v is AlertStatus {
  return typeof v === "string" && (ALERT_STATUSES as readonly string[]).includes(v);
}

/**
 * The severity each kind is raised at.
 *
 * Fixed in code, not configurable, and that is the point: a team that can turn
 * "allocation without consent" down to INFO will, on the week it fires. If one
 * of these is genuinely at the wrong level for this trial, that is a
 * conversation and a commit, not a setting.
 */
export const ALERT_SEVERITY_BY_KIND: Record<AlertKind, AlertSeverity> = {
  ALLOCATION_WITHOUT_CONSENT: "CRITICAL",
  COHORT_UNDERSIZED: "WARNING",
  COHORT_OVER_CAPACITY: "WARNING",
  DEVICE_RETURN_OVERDUE: "WARNING",
  EXCLUSION_WITHOUT_REASON: "WARNING",
  VR_NOT_READY_BEFORE_SESSION: "WARNING",
  SCHEDULED_ACTION_FAILED: "CRITICAL",
  RULE_MISCONFIGURED: "INFO",
};

export function severityFor(kind: AlertKind): AlertSeverity {
  return ALERT_SEVERITY_BY_KIND[kind];
}

/**
 * The identity of an alert, so raising it twice does not produce two rows.
 *
 * A sweep runs on every processor tick. Without this, a headset three weeks
 * overdue would have twenty-one alerts and the list would be useless — the
 * screen that shows what needs attention is the one that must never need
 * scrolling past noise.
 *
 * Built from the kind and the subject only. NOT from the detail, and not from a
 * date: the same device still overdue tomorrow is the same problem, and an
 * alert whose key moved every day would defeat the deduplication it exists for.
 */
export function alertDedupeKey(kind: AlertKind, subject: { kind: SubjectKind; id: string }): string {
  return `${kind}:${subject.kind}:${subject.id}`;
}

/** Alert statuses that still count as needing a person. */
export const UNRESOLVED_ALERT_STATUSES: readonly AlertStatus[] = ["OPEN", "ACKNOWLEDGED"];

export function isUnresolved(status: AlertStatus): boolean {
  return UNRESOLVED_ALERT_STATUSES.includes(status);
}

/**
 * Alert detail is a short operational string built by a sweep, never a name.
 *
 * The alerts list is the screen most likely to be open on a shared monitor, so
 * it carries codes — `P-000042`, `C-2026-A`, `VR-07` — exactly as the attention
 * panel does. A sweep that needed a participant's name to explain itself would
 * be the wrong sweep.
 */
export const ALERT_DETAIL_MAX_LENGTH = 280;

export const ALERT_NAMES_NOBODY = true;
