import { pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import {
  eligibilityStatusEnum,
  enrollmentStatusEnum,
  recruitmentStatusEnum,
  uiLocaleEnum,
} from "./enums";
import { studies } from "./studies";

/**
 * A person in the intake funnel. Participants never authenticate (D-003).
 *
 * `code` is the pseudonymous handle (e.g. "P-000042") generated from the
 * participant_code_seq sequence. It is what operational history is keyed by, so
 * that contact data can later be erased without destroying the audit trail.
 * No Category C data belongs on this table.
 */
export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    code: text("code").notNull(),
    recruitmentStatus: recruitmentStatusEnum("recruitment_status").notNull().default("INTERESTED"),
    eligibilityStatus: eligibilityStatusEnum("eligibility_status").notNull().default("PENDING"),
    /** Null means "not yet in the enrollment pipeline" — not the same as CONSENT_PENDING. */
    enrollmentStatus: enrollmentStatusEnum("enrollment_status"),
    locale: uiLocaleEnum("locale").notNull().default("es"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("participants_code_unique").on(t.studyId, t.code),
    index("participants_study_idx").on(t.studyId, t.createdAt),
    index("participants_status_idx").on(t.studyId, t.recruitmentStatus),
    index("participants_eligibility_idx").on(t.studyId, t.eligibilityStatus),
    index("participants_enrollment_idx").on(t.studyId, t.enrollmentStatus),
  ],
);

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;

/**
 * Category A operational identity, deliberately in its own table so that reads
 * can be gated by the `participants.contact.read` permission and so an erasure
 * request can clear it independently of operational history.
 *
 * `studyId` is denormalised from participants so the database can enforce one
 * contact email per study, which is what makes duplicate linking (D-013) safe
 * under concurrent submissions.
 */
export const participantContacts = pgTable(
  "participant_contacts",
  {
    participantId: uuid("participant_id")
      .primaryKey()
      .references(() => participants.id, { onDelete: "cascade" }),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    fullName: text("full_name"),
    email: text("email"),
    /** Trimmed + lowercased; the duplicate-detection key. */
    emailNormalized: text("email_normalized"),
    phone: text("phone"),
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("participant_contacts_email_unique").on(t.studyId, t.emailNormalized)],
);

export type ParticipantContact = typeof participantContacts.$inferSelect;
export type NewParticipantContact = typeof participantContacts.$inferInsert;
