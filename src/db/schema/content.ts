import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { cohortSessions, sessionTemplates } from "./sessions";
import { contentStatusEnum, contentTypeEnum, uiLocaleEnum } from "./enums";
import { studies } from "./studies";
import { users } from "./users";
import type { ContentBody } from "@/domain/content";

/**
 * The identity of a piece of study content. `key` doubles as the public URL slug
 * for standalone pages; session material links to the programme by foreign key
 * rather than by matching strings, so renaming a session cannot orphan its
 * preparation page.
 */
export const contents = pgTable(
  "contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    type: contentTypeEnum("type").notNull(),
    key: text("key").notNull(),
    sessionTemplateId: uuid("session_template_id").references(() => sessionTemplates.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("contents_key_unique").on(t.studyId, t.key),
    index("contents_study_idx").on(t.studyId, t.type),
  ],
);

export type Content = typeof contents.$inferSelect;

/**
 * An explicit version per locale. Publishing inserts a new row and archives the
 * previous published one — a published row is never mutated.
 *
 * `body` is an array of typed blocks, validated by Zod on save and again on
 * render. It is not HTML and never becomes HTML.
 */
export const contentVersions = pgTable(
  "content_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    locale: uiLocaleEnum("locale").notNull().default("es"),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    /** An optional banner image for the public page (2026-09-19 request).
     * A version-level field, not a block: it sits above the title, not in
     * the body flow, and only one may exist per version. */
    coverImageUrl: text("cover_image_url"),
    /** Vertical crop focus as a 0-100 percentage (`object-position`'s Y
     * axis) — "keep the image always centred [horizontally], but add an
     * option to reposition in the Y axis" (2026-09-19 follow-up). 50 is
     * centred top-to-bottom, the same default `object-position: center`
     * already gave every cover image before this field existed. */
    coverImagePosition: integer("cover_image_position").notNull().default(50),
    body: jsonb("body").$type<ContentBody>().notNull().default([]),
    status: contentStatusEnum("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("content_versions_number_unique").on(t.contentId, t.locale, t.versionNumber),
    index("content_versions_content_idx").on(t.contentId, t.locale, t.versionNumber),
  ],
);

export type ContentVersion = typeof contentVersions.$inferSelect;

/**
 * Which published version a cohort session was pinned to, so "which version did
 * Cohort 04 receive?" is answerable. Superseding inserts a new row rather than
 * editing the old one.
 */
export const contentAssignments = pgTable(
  "content_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    cohortSessionId: uuid("cohort_session_id")
      .notNull()
      .references(() => cohortSessions.id, { onDelete: "cascade" }),
    contentVersionId: uuid("content_version_id")
      .notNull()
      .references(() => contentVersions.id),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow(),
    pinnedBy: uuid("pinned_by").references(() => users.id),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("content_assignments_session_idx").on(t.cohortSessionId)],
);

export type ContentAssignment = typeof contentAssignments.$inferSelect;
