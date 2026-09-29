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
import { allocationMethodEnum, cohortNoteColorEnum, cohortStatusEnum } from "./enums";
import { participants } from "./participants";
import { programStages } from "./program-stages";
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
    /**
     * Whether this arm's participants also sign a consent in person at the
     * initial visit (D-032).
     *
     * CONFIGURATION, NOT A RULE IN CODE. The application never decides that a
     * control arm needs less than an experimental one — researchers set this per
     * arm, and the app only subtracts what is recorded from what is configured
     * so a gap is visible. It never blocks anything on it (non-negotiable 3).
     */
    requiresPhysicalConsent: boolean("requires_physical_consent").notNull().default(false),
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
    /**
     * The arm this cohort runs. Null means "takes anyone", which is how every
     * cohort created before Phase 4c behaves and stays the default.
     *
     * Once set, a participant allocated to a different arm cannot be assigned
     * here — that is data integrity, not a clinical rule: the recorded
     * allocation and the group actually attended would disagree, and every
     * attendance figure built on the cohort would be wrong.
     */
    armId: uuid("arm_id").references(() => studyArms.id),
    plannedStartDate: date("planned_start_date"),
    plannedEndDate: date("planned_end_date"),
    /**
     * Configured group size. "Between 6 and 8" is this trial's number, so it is
     * data, never a constant in code (non-negotiable 6). Both nullable: a cohort
     * with no bounds is unbounded, not implicitly 6-8.
     *
     * Neither bound refuses an assignment (D-023). They are checked once, when
     * someone marks the cohort ACTIVE, and even then a person can override with
     * a recorded reason (D-033).
     */
    minSize: integer("min_size"),
    maxSize: integer("max_size"),
    /**
     * Where the cohort sits in the programme timeline (Phase 4f). Null means
     * the programme has not started for this cohort yet — a real, honest
     * state for a cohort still in PLANNING or RECRUITING, not a missing
     * value. Moving it is always an explicit staff action (services/cohorts.ts,
     * `advanceProgramStage`), audited like every other cohort change; nothing
     * infers or advances it on its own.
     */
    currentStageId: uuid("current_stage_id").references(() => programStages.id),
    currentStageEnteredAt: timestamp("current_stage_entered_at", { withTimezone: true }),
    /**
     * When staff archived this cohort. Null means visible in the ordinary
     * workspace list — every cohort before this column existed, and most
     * after. A second, independent axis from `status`: archiving a demo or
     * mistaken cohort is reversible and says nothing about where it was in
     * its programme, so it is not a new terminal `CohortStatus` value
     * (migration 0024).
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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

/**
 * A sticky note on a cohort's workspace — a team reminder, not a research or
 * permission-relevant record (2026-09-19 request). Deliberately simple:
 * create and delete only, no status/priority/assignment like `tasks`.
 */
export const cohortNotes = pgTable(
  "cohort_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    color: cohortNoteColorEnum("color").notNull().default("LILAC"),
    body: text("body").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cohort_notes_cohort_idx").on(t.cohortId, t.createdAt)],
);

export type CohortNote = typeof cohortNotes.$inferSelect;
