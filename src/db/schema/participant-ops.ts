import { index, pgTable, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { consentStatusEnum, eligibilityStatusEnum, screeningStatusEnum } from "./enums";
import { participants } from "./participants";
import { studies } from "./studies";
import { users } from "./users";

/**
 * A screening appointment and its recorded outcome.
 *
 * CATEGORY C BOUNDARY: there is deliberately no free-text column on this table.
 * Screening answers, instrument scores and clinical notes belong in the
 * institution's approved system; `externalRecordId` is an opaque pointer to it.
 * `result` is a determination recorded by staff — nothing in this codebase
 * computes or infers it (docs/research-data-boundaries.md).
 */
export const screenings = pgTable(
  "screenings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: screeningStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Null until a result exists. Never 'PENDING' — that is expressed by null. */
    result: eligibilityStatusEnum("result"),
    externalRecordId: text("external_record_id"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("screenings_study_idx").on(t.studyId, t.status, t.scheduledAt),
    index("screenings_participant_idx").on(t.participantId, t.createdAt),
  ],
);

export type Screening = typeof screenings.$inferSelect;
export type NewScreening = typeof screenings.$inferInsert;

/**
 * Consent status, not the consent document.
 *
 * Historical: a decision is never edited into a different one. Re-consenting to
 * a newer form version creates a new row and marks the previous one SUPERSEDED
 * via `supersededBy`. A partial unique index (in SQL) allows only one PENDING or
 * CONSENTED row per participant at a time.
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: consentStatusEnum("status").notNull().default("PENDING"),
    /** Which form version, e.g. "PIS v2.1". A label, not a document. */
    versionLabel: text("version_label").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    externalRecordId: text("external_record_id"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    supersededBy: uuid("superseded_by").references((): AnyPgColumn => consents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consents_study_idx").on(t.studyId, t.status),
    index("consents_participant_idx").on(t.participantId, t.createdAt),
  ],
);

export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
