import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { cohorts, studyArms } from "./cohorts";
import { attendanceStatusEnum, sessionModalityEnum, sessionStatusEnum } from "./enums";
import { participants } from "./participants";
import { studies } from "./studies";
import { users } from "./users";

/**
 * The programme definition for a study. Session names are configuration rows so
 * no trial specific ends up in code.
 *
 * `armId` is nullable: null means the template applies to every arm. Leaving it
 * optional avoids asserting a trial design that this application has no business
 * encoding.
 */
export const sessionTemplates = pgTable(
  "session_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    armId: uuid("arm_id").references(() => studyArms.id),
    code: text("code").notNull(),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en"),
    position: integer("position").notNull().default(0),
    modality: sessionModalityEnum("modality").notNull().default("IN_PERSON"),
    durationMinutes: integer("duration_minutes"),
    /** Days after the cohort start date. */
    dayOffset: integer("day_offset"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("session_templates_code_unique").on(t.studyId, t.code),
    index("session_templates_study_idx").on(t.studyId, t.position),
  ],
);

export type SessionTemplate = typeof sessionTemplates.$inferSelect;

/**
 * A scheduled instance for one cohort. `templateId` is nullable so an ad-hoc
 * session can exist without inventing a template for it.
 *
 * No notes column: what happened to a participant during a session is clinical
 * and belongs in the approved system.
 */
export const cohortSessions = pgTable(
  "cohort_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    templateId: uuid("template_id").references(() => sessionTemplates.id),
    name: text("name").notNull(),
    modality: sessionModalityEnum("modality").notNull().default("IN_PERSON"),
    status: sessionStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes"),
    /** Room, address or meeting link. Operational only. */
    location: text("location"),
    facilitatorId: uuid("facilitator_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cohort_sessions_cohort_idx").on(t.cohortId, t.scheduledStart),
    index("cohort_sessions_study_idx").on(t.studyId, t.status, t.scheduledStart),
  ],
);

export type CohortSession = typeof cohortSessions.$inferSelect;

/**
 * One row per participant per session, created as EXPECTED when the session is
 * scheduled so the register is complete before it happens.
 *
 * TECHNICAL_FAILURE is a distinct status from ABSENT and must stay that way —
 * see src/domain/session.ts.
 */
export const sessionAttendance = pgTable(
  "session_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => cohortSessions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: attendanceStatusEnum("status").notNull().default("EXPECTED"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("session_attendance_unique").on(t.sessionId, t.participantId),
    index("session_attendance_session_idx").on(t.sessionId),
    index("session_attendance_participant_idx").on(t.participantId),
  ],
);

export type SessionAttendance = typeof sessionAttendance.$inferSelect;
