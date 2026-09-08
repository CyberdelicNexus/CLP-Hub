import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { allocationMethodEnum, cohortStatusEnum } from "./enums";
import { participants } from "./participants";
import { studies } from "./studies";
import { users } from "./users";

/**
 * Study arms. Pure configuration so no trial specific reaches the code.
 *
 * Deliberately carries no allocation ratio: this system does not allocate
 * anyone, and a ratio column would imply that it does.
 */
export const studyArms = pgTable(
  "study_arms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    code: text("code").notNull(),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("study_arms_code_unique").on(t.studyId, t.code),
    index("study_arms_study_idx").on(t.studyId, t.position),
  ],
);

export type StudyArm = typeof studyArms.$inferSelect;

/** A group of participants going through the programme together. */
export const cohorts = pgTable(
  "cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: cohortStatusEnum("status").notNull().default("PLANNING"),
    plannedStartDate: date("planned_start_date"),
    plannedEndDate: date("planned_end_date"),
    capacity: integer("capacity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("cohorts_code_unique").on(t.studyId, t.code),
    index("cohorts_study_idx").on(t.studyId, t.status),
  ],
);

export type Cohort = typeof cohorts.$inferSelect;

/**
 * Which staff run which cohort. Historical (revoked, never deleted), and also
 * the narrowing behind cohort-scoped visibility: a caller without
 * `cohorts.read.all` sees only the cohorts they appear in here.
 */
export const cohortStaff = pgTable(
  "cohort_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    revokedBy: uuid("revoked_by").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("cohort_staff_user_idx").on(t.userId)],
);

export type CohortStaff = typeof cohortStaff.$inferSelect;

/** Historical cohort membership; leaving sets removedAt rather than deleting. */
export const participantCohortAssignments = pgTable(
  "participant_cohort_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    removedBy: uuid("removed_by").references(() => users.id),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [index("pca_cohort_idx").on(t.cohortId)],
);

export type ParticipantCohortAssignment = typeof participantCohortAssignments.$inferSelect;

/**
 * The recorded outcome of an allocation made by an approved mechanism outside
 * this system. Nothing here chooses an arm — see src/domain/randomization.ts.
 * One row per participant; a second is a data-integrity error.
 */
export const randomizations = pgTable(
  "randomizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    armId: uuid("arm_id")
      .notNull()
      .references(() => studyArms.id),
    method: allocationMethodEnum("method").notNull().default("MANUAL_ENTRY"),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull(),
    externalRecordId: text("external_record_id"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("randomizations_one_per_participant").on(t.participantId),
    index("randomizations_study_idx").on(t.studyId, t.allocatedAt),
  ],
);

export type Randomization = typeof randomizations.$inferSelect;
