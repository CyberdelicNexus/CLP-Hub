import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  alertKindEnum,
  alertSeverityEnum,
  alertStatusEnum,
  automationActionKindEnum,
  automationDeliveryModeEnum,
  automationEventTypeEnum,
  automationSubjectKindEnum,
  scheduledActionStatusEnum,
  taskOriginEnum,
  taskPriorityEnum,
  taskStatusEnum,
} from "./enums";
import { cohorts } from "./cohorts";
import { cohortSessions } from "./sessions";
import { communicationTemplates, communications } from "./communications";
import { devices } from "./logistics";
import { participants } from "./participants";
import { studies } from "./studies";
import { users } from "./users";
import type { RuleConditions } from "@/domain/automation";

/**
 * Automation (Phase 8): events, rules, scheduled actions, tasks and alerts.
 *
 * NOTHING IN THIS FILE SENDS ANYTHING, and nothing in it could. There is no
 * recipient column, no address, no credential, no provider, no delivery receipt
 * and no retry counter. The furthest a scheduled action moves on its own is
 * READY — prepared, re-checked, and waiting for a person (D-004, D-039, D-043).
 * `tests/automation.test.ts` asserts the absence rather than trusting it.
 */

/**
 * Something operational happened, or was booked.
 *
 * The two timestamps are the whole design:
 *
 * - `occurredAt` — when the fact was recorded.
 * - `anchorAt` — the time a rule offsets FROM.
 *
 * For "immediately after the application" they are the same instant. For
 * "24 h before session 2" the anchor is that session's start, which is still in
 * the future when the event is written. One engine serves both shapes, and no
 * rule has to know which kind it is reading.
 *
 * This is NOT event sourcing. No table is rebuilt from these rows; they are a
 * log that rules hang off.
 */
export const studyEvents = pgTable(
  "study_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    eventType: automationEventTypeEnum("event_type").notNull(),
    subjectKind: automationSubjectKindEnum("subject_kind").notNull(),
    participantId: uuid("participant_id").references(() => participants.id),
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    sessionId: uuid("session_id").references(() => cohortSessions.id),
    deviceId: uuid("device_id").references(() => devices.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** What a rule's offset is measured from. Defaults to `occurredAt`. */
    anchorAt: timestamp("anchor_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Operational context only: codes, ids, a status name. Never a participant
     * name, never a contact detail, never anything from Category C.
     */
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("study_events_study_idx").on(t.studyId, t.eventType, t.occurredAt),
    index("study_events_participant_idx").on(t.participantId, t.occurredAt),
    index("study_events_session_idx").on(t.sessionId, t.occurredAt),
  ],
);

export type StudyEvent = typeof studyEvents.$inferSelect;
export type NewStudyEvent = typeof studyEvents.$inferInsert;

/**
 * A rule: when this happens, this long before or after it, do this.
 *
 * CONFIGURATION, NOT CODE. Every timing this trial uses is a row here
 * (CLAUDE.md rule 6). The processor knows how to read a rule; it knows nothing
 * about weeks-before-first-session or morning-of-session.
 *
 * `conditionsJson` is an object of named boolean predicates drawn from the
 * closed allow-list in `src/domain/automation.ts`. No operators, no values, no
 * field access — a rule that could read an arbitrary column would eventually
 * branch on a screening result.
 *
 * `deliveryMode` may not be AUTOMATIC. The enum keeps the value because
 * docs/automations.md designed for it; a check constraint refuses to store it,
 * because this application has no way to deliver anything.
 */
export const automationRules = pgTable(
  "automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    key: text("key").notNull(),
    nameEs: text("name_es").notNull(),
    eventType: automationEventTypeEnum("event_type").notNull(),
    actionKind: automationActionKindEnum("action_kind").notNull(),
    /** Minutes from the event's anchor. Negative is before it. */
    offsetMinutes: integer("offset_minutes").notNull().default(0),
    deliveryMode: automationDeliveryModeEnum("delivery_mode").notNull().default("MANUAL"),
    /** MESSAGE rules only. */
    communicationTemplateId: uuid("communication_template_id").references(
      () => communicationTemplates.id,
    ),
    /** TASK rules only. */
    taskTitleEs: text("task_title_es"),
    taskPriority: taskPriorityEnum("task_priority").notNull().default("NORMAL"),
    /** ALERT rules only. */
    alertKind: alertKindEnum("alert_kind"),
    conditionsJson: jsonb("conditions_json")
      .$type<RuleConditions>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("automation_rules_key_unique").on(t.studyId, t.key),
    index("automation_rules_event_idx").on(t.studyId, t.eventType, t.active),
  ],
);

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;

/**
 * One rule firing for one subject, at one moment.
 *
 * READ THIS BEFORE ADDING A STATUS. There is no SENT and no DELIVERED. The
 * processor moves an action to READY and stops: prepared, re-checked, waiting
 * for a person. DONE is a human saying they acted.
 *
 * `snapshotJson` is written at materialisation and is FOR TRACEABILITY ONLY.
 * The go/no-go is taken when the action comes due, against the state as it is
 * then. A reminder scheduled on Monday for someone who withdrew on Tuesday is
 * SKIPPED with the unmet condition recorded — never prepared — and the snapshot
 * is what lets someone later see what the world looked like when it was planned.
 *
 * `(ruleId, eventId)` is unique, which is what makes the processor safe to run
 * on an overlapping or retrying cron: materialising the same events twice
 * produces nothing new.
 */
export const scheduledActions = pgTable(
  "scheduled_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => automationRules.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => studyEvents.id),
    subjectKind: automationSubjectKindEnum("subject_kind").notNull(),
    participantId: uuid("participant_id").references(() => participants.id),
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    sessionId: uuid("session_id").references(() => cohortSessions.id),
    deviceId: uuid("device_id").references(() => devices.id),
    actionKind: automationActionKindEnum("action_kind").notNull(),
    deliveryMode: automationDeliveryModeEnum("delivery_mode").notNull().default("MANUAL"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: scheduledActionStatusEnum("status").notNull().default("PENDING"),
    /** The unmet conditions, or the processing failure. A vocabulary, not prose. */
    skipReason: text("skip_reason"),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown> | null>(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id),
    /** Set when a person records that they sent the prepared message. */
    communicationId: uuid("communication_id").references(() => communications.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("scheduled_actions_rule_event_unique").on(t.ruleId, t.eventId),
    index("scheduled_actions_due_idx").on(t.studyId, t.status, t.scheduledFor),
    index("scheduled_actions_participant_idx").on(t.participantId, t.scheduledFor),
    index("scheduled_actions_session_idx").on(t.sessionId, t.scheduledFor),
  ],
);

export type ScheduledAction = typeof scheduledActions.$inferSelect;
export type NewScheduledAction = typeof scheduledActions.$inferInsert;

/**
 * Human work, created by a person or by a TASK rule.
 *
 * `titleEs` and `detail` are staff-authored free text that lands on a shared
 * screen. The same warning the visit note carries applies (D-035): nothing stops
 * someone typing a clinical observation into a text box. The boundary is
 * documented and every change is audited, rather than pretended away.
 *
 * `dedupeKey` is set for rule-created tasks so that re-running the processor
 * updates one row instead of producing a list nobody can read.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    dedupeKey: text("dedupe_key"),
    titleEs: text("title_es").notNull(),
    detail: text("detail"),
    status: taskStatusEnum("status").notNull().default("OPEN"),
    priority: taskPriorityEnum("priority").notNull().default("NORMAL"),
    origin: taskOriginEnum("origin").notNull().default("MANUAL"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    assignedTo: uuid("assigned_to").references(() => users.id),
    participantId: uuid("participant_id").references(() => participants.id),
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    sessionId: uuid("session_id").references(() => cohortSessions.id),
    deviceId: uuid("device_id").references(() => devices.id),
    ruleId: uuid("rule_id").references(() => automationRules.id),
    scheduledActionId: uuid("scheduled_action_id").references(() => scheduledActions.id),
    createdBy: uuid("created_by").references(() => users.id),
    completedBy: uuid("completed_by").references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_open_idx").on(t.studyId, t.status, t.dueAt),
    index("tasks_assigned_idx").on(t.assignedTo, t.status),
    index("tasks_participant_idx").on(t.participantId),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

/**
 * Operational risk: something is missing, late, or inconsistent in the records.
 *
 * EVERY ALERT IS ABOUT THE DATA, NEVER ABOUT A PERSON. `detail` carries codes —
 * `P-000042`, `C-2026-A`, `VR-07` — exactly as the attention panel does, because
 * this is the screen most likely to be open on a shared monitor. An alert means
 * "someone should look", never "the system has concluded".
 *
 * `lastSeenAt` is bumped every time a sweep still finds the problem, so one row
 * answers both "since when" and "still true as of". A resolved alert does not
 * block a new one: the same headset overdue again next month is a new problem
 * and deserves its own `raisedAt`.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    kind: alertKindEnum("kind").notNull(),
    severity: alertSeverityEnum("severity").notNull().default("WARNING"),
    status: alertStatusEnum("status").notNull().default("OPEN"),
    /** `<kind>:<subjectKind>:<subjectId>`. Deliberately carries no date. */
    dedupeKey: text("dedupe_key").notNull(),
    subjectKind: automationSubjectKindEnum("subject_kind").notNull(),
    participantId: uuid("participant_id").references(() => participants.id),
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    sessionId: uuid("session_id").references(() => cohortSessions.id),
    deviceId: uuid("device_id").references(() => devices.id),
    detail: text("detail"),
    ruleId: uuid("rule_id").references(() => automationRules.id),
    scheduledActionId: uuid("scheduled_action_id").references(() => scheduledActions.id),
    raisedAt: timestamp("raised_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("alerts_open_idx").on(t.studyId, t.status, t.severity, t.raisedAt),
    index("alerts_participant_idx").on(t.participantId),
  ],
);

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
