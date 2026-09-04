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
import { applicationSourceEnum, applicationStatusEnum, questionTypeEnum, uiLocaleEnum } from "./enums";
import { participants } from "./participants";
import { studies } from "./studies";

/**
 * Application form configuration, per study. Questions are rows, never code
 * (non-negotiable 6): a different trial configures different questions without
 * a deployment.
 *
 * BOUNDARY (D-014): questions must ask only operational things — contact,
 * availability, location, consent to be contacted. Health, symptom, diagnosis,
 * medication and psychometric questions would place Category C research data in
 * this app and are forbidden by docs/research-data-boundaries.md. This is a
 * documented convention rather than a database constraint.
 */
export const applicationQuestions = pgTable(
  "application_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    key: text("key").notNull(),
    position: integer("position").notNull().default(0),
    type: questionTypeEnum("type").notNull(),
    required: boolean("required").notNull().default(false),
    /** Option list for SELECT / MULTI_SELECT: [{ value, label_es, label_en }]. */
    options: jsonb("options").$type<QuestionOption[] | null>(),
    /** Spanish is mandatory; every participant touchpoint must exist in ES (D-009). */
    labelEs: text("label_es").notNull(),
    labelEn: text("label_en"),
    helpEs: text("help_es"),
    helpEn: text("help_en"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("application_questions_key_unique").on(t.studyId, t.key),
    index("application_questions_study_idx").on(t.studyId, t.position),
  ],
);

export interface QuestionOption {
  value: string;
  label_es: string;
  label_en?: string;
}

export type ApplicationQuestion = typeof applicationQuestions.$inferSelect;
export type NewApplicationQuestion = typeof applicationQuestions.$inferInsert;

/**
 * One submission. Status is operational triage set by staff — it is not an
 * eligibility decision, which belongs to Phase 2 screening.
 */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: applicationStatusEnum("status").notNull().default("SUBMITTED"),
    source: applicationSourceEnum("source").notNull().default("PUBLIC_FORM"),
    locale: uiLocaleEnum("locale").notNull().default("es"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("applications_study_idx").on(t.studyId, t.submittedAt),
    index("applications_status_idx").on(t.studyId, t.status, t.submittedAt),
    index("applications_participant_idx").on(t.participantId, t.submittedAt),
  ],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

/**
 * Answers. `value` is jsonb because MULTI_SELECT yields an array while every
 * other type yields a scalar. Answers may contain free text, so they inherit the
 * Category C boundary above and are treated as sensitive on screen.
 */
export const applicationAnswers = pgTable(
  "application_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => applicationQuestions.id),
    value: jsonb("value").$type<AnswerValue>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("application_answers_unique").on(t.applicationId, t.questionId),
    index("application_answers_application_idx").on(t.applicationId),
  ],
);

export type AnswerValue = string | string[] | boolean;

export type ApplicationAnswer = typeof applicationAnswers.$inferSelect;
export type NewApplicationAnswer = typeof applicationAnswers.$inferInsert;
