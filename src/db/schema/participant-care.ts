import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { responsibilityRoleEnum, visitStatusEnum } from "./enums";
import { participants } from "./participants";
import { studies } from "./studies";
import { users } from "./users";

/**
 * Who is responsible for a given participant (Phase 4d).
 *
 * Cohort-level staffing is `cohort_staff` and is NOT duplicated here. This
 * answers the narrower question: for this person, who runs the initial visit,
 * and who takes or sets up the headset when that is someone else.
 *
 * Historical: revoked, never deleted, so "who was responsible in March" stays
 * answerable.
 *
 * Unlike `cohort_staff`, an assignment here grants NO extra visibility (D-022
 * flagged that consequence for cohorts precisely because it is unusual). This is
 * a work assignment. Widening what somebody can see goes through
 * `src/domain/permissions.ts`, where it can be reviewed.
 */
export const participantResponsibilities = pgTable(
  "participant_responsibilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    role: responsibilityRoleEnum("role").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    revokedBy: uuid("revoked_by").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    // Partial unique index in SQL: one active holder per (participant, role).
    // Two people simultaneously responsible for the headset is how a headset
    // ends up with nobody carrying it.
    index("participant_responsibilities_active_idx").on(t.participantId, t.role),
    index("participant_responsibilities_user_idx").on(t.userId),
  ],
);

export type ParticipantResponsibility = typeof participantResponsibilities.$inferSelect;
export type NewParticipantResponsibility = typeof participantResponsibilities.$inferInsert;

/**
 * The initial visit: the in-person appointment where the physical consent is
 * signed and the equipment is handed over (Phase 4d).
 *
 * Distinct from `screenings` (earlier, and about eligibility) and from
 * `cohort_sessions` (later, and per cohort rather than per person). It carries
 * the only two free-text fields in the participant record — a location and
 * operational notes — both capped, both explicitly not for clinical content, and
 * neither ever copied into an audit snapshot.
 *
 * Historical like screenings: a visit that happened is not edited into a
 * different outcome, a repeat is a new row, and at most one may be open at a
 * time.
 */
export const initialVisits = pgTable(
  "initial_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: visitStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Where. Operational text, capped at 200 characters. */
    location: text("location"),
    /** Logistics, not clinical notes. Capped at 500 characters. */
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("initial_visits_study_idx").on(t.studyId, t.status, t.scheduledAt),
    index("initial_visits_participant_idx").on(t.participantId, t.createdAt),
    // Partial unique index in SQL (`where status = 'SCHEDULED'`), declared here
    // as a plain index — a full unique on (participant, status) would also
    // forbid a second COMPLETED visit, which is not the rule.
    index("initial_visits_one_open").on(t.participantId, t.status),
  ],
);

export type InitialVisit = typeof initialVisits.$inferSelect;
export type NewInitialVisit = typeof initialVisits.$inferInsert;
