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
import {
  communicationAudienceEnum,
  communicationChannelEnum,
  communicationStageEnum,
  communicationStatusEnum,
} from "./enums";
import { cohorts } from "./cohorts";
import { participants } from "./participants";
import { sessionTemplates } from "./sessions";
import { studies } from "./studies";
import { users } from "./users";

/**
 * Reusable message templates, organised by the stage they belong to (Phase 7).
 *
 * Spanish is mandatory; English is optional and for staff preview only (D-009).
 * The body may contain only the placeholders in `TEMPLATE_VARIABLES` — a closed
 * list, checked on save, because a template that could interpolate an arbitrary
 * field would eventually put a screening result in a WhatsApp group.
 *
 * `version` increments on every edit. It exists so a `communications` row can
 * say which wording was actually used, without this table becoming versioned
 * the way `content_versions` is — a message is not a published page.
 */
export const communicationTemplates = pgTable(
  "communication_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    key: text("key").notNull(),
    stage: communicationStageEnum("stage").notNull(),
    /**
     * The session this message belongs to, when it belongs to one.
     *
     * A real foreign key rather than a text label, for the reason D-029 gives
     * about content: renaming a session must not orphan the messages about it.
     * Null means the message is not about a particular session — a waiting-list
     * note, a closing message.
     */
    sessionTemplateId: uuid("session_template_id").references(() => sessionTemplates.id),
    /**
     * Who the copied text is addressed to. A COHORT_CHANNEL template may not
     * contain a variable that names one person (D-041) — checked on save.
     */
    audience: communicationAudienceEnum("audience").notNull().default("PARTICIPANT"),
    channel: communicationChannelEnum("channel").notNull().default("WHATSAPP"),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en"),
    bodyEs: text("body_es").notNull(),
    bodyEn: text("body_en"),
    version: integer("version").notNull().default(1),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("communication_templates_key_unique").on(t.studyId, t.key),
    index("communication_templates_stage_idx").on(t.studyId, t.stage, t.position),
    index("communication_templates_session_idx").on(t.sessionTemplateId),
  ],
);

export type CommunicationTemplate = typeof communicationTemplates.$inferSelect;
export type NewCommunicationTemplate = typeof communicationTemplates.$inferInsert;

/**
 * The record that a message was sent, or deliberately skipped.
 *
 * READ THIS BEFORE ADDING A COLUMN. The rendered message is **not** stored, and
 * that is the point (D-039):
 *
 * - `template_body` holds the template AS IT STOOD, placeholders intact. It
 *   answers "what did we send on the 4th" without copying the person's name,
 *   date and location into a second table.
 * - There is no inbound path and no reply column. This application never holds
 *   a WhatsApp conversation.
 * - There is no DELIVERED or FAILED status. Nothing here observes delivery, and
 *   a status this application cannot verify would be a claim, not a record.
 * - A message pasted into a cohort channel is ONE row against the cohort, not
 *   one per member (D-041). Expanding it would assert that each person was
 *   written to individually, which is not what happened.
 *
 * Append-only by convention: a send is a historical fact, so rows are inserted
 * and never edited.
 */
export const communications = pgTable(
  "communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    /**
     * Set for a message to one person; null for a message pasted into a group.
     * Exactly one of `participantId` and `cohortId` is set, enforced in SQL.
     */
    participantId: uuid("participant_id").references(() => participants.id),
    /** Set for a message pasted into a cohort's channel. */
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    audience: communicationAudienceEnum("audience").notNull().default("PARTICIPANT"),
    templateId: uuid("template_id").references(() => communicationTemplates.id),
    /** The template's version at the moment it was used. */
    templateVersion: integer("template_version"),
    /** The template text WITH placeholders. Never the rendered message. */
    templateBody: text("template_body"),
    stage: communicationStageEnum("stage").notNull(),
    channel: communicationChannelEnum("channel").notNull(),
    status: communicationStatusEnum("status").notNull().default("SENT"),
    /** Why it was skipped. Operational, capped, no participant detail. */
    skipReason: text("skip_reason"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    sentBy: uuid("sent_by").references(() => users.id),
  },
  (t) => [
    index("communications_participant_idx").on(t.participantId, t.sentAt),
    index("communications_cohort_idx").on(t.cohortId, t.sentAt),
    index("communications_study_idx").on(t.studyId, t.stage, t.sentAt),
  ],
);

export type Communication = typeof communications.$inferSelect;
export type NewCommunication = typeof communications.$inferInsert;
