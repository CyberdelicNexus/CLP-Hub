import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import {
  consentTypeEnum,
  eligibilityReasonCategoryEnum,
  eligibilityStatusEnum,
  intakeTargetEnum,
  qualtricsFieldClassEnum,
} from "./enums";
import { studies } from "./studies";

/**
 * Why a determination came out as it did, as configuration (Phase 4a).
 *
 * The trial's wording is a row; the CONSORT category it reports under is a fixed
 * enum in `src/domain/eligibility-reason.ts` (non-negotiable 6). Nothing here
 * expresses an eligibility criterion: a reason states *that* one was not met and
 * never which, so no Category C fact enters this table
 * (docs/research-data-boundaries.md).
 *
 * Reasons are never deleted — an exclusion already recorded against a reason
 * must stay readable — they are deactivated.
 */
export const eligibilityReasons = pgTable(
  "eligibility_reasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    code: text("code").notNull(),
    category: eligibilityReasonCategoryEnum("category").notNull(),
    /** Spanish is mandatory; every staff-facing vocabulary exists in ES (D-009). */
    labelEs: text("label_es").notNull(),
    labelEn: text("label_en"),
    /**
     * Determinations this reason may be attached to. A Postgres array of
     * eligibility_status; a check constraint forbids 'ELIGIBLE' and 'PENDING',
     * because a reason recorded for an inclusion would be a clinical
     * justification and a reason for "not looked at yet" is a contradiction.
     */
    appliesTo: eligibilityStatusEnum("applies_to").array().notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("eligibility_reasons_code_unique").on(t.studyId, t.code),
    index("eligibility_reasons_study_idx").on(t.studyId, t.position),
  ],
);

export type EligibilityReasonRow = typeof eligibilityReasons.$inferSelect;
export type NewEligibilityReason = typeof eligibilityReasons.$inferInsert;

/**
 * Configuration for a future READ-ONLY Qualtrics integration (Phase 4a).
 *
 * NO TRANSFER IS IMPLEMENTED. There is no HTTP client, no credential, no
 * webhook and no scheduled pull anywhere in this repository. This table exists
 * so that which fields *would* move is an explicit, auditable, per-field
 * decision made before any code reads them — and so that the refusal to move
 * identifiable or research data is a database constraint rather than a promise.
 *
 * `source_class` is checked in SQL against IDENTIFIABLE and RESEARCH: a mapping
 * for a name, an email or a screening answer cannot be stored at all. The study
 * runs in DISABLED or TEST_ANONYMIZED mode (`studies.qualtrics_mode`); there is
 * deliberately no live mode to switch to.
 */
export const qualtricsFieldMappings = pgTable(
  "qualtrics_field_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    /** The Qualtrics question or embedded-data key, e.g. "QID12". */
    sourceField: text("source_field").notNull(),
    /** What the field holds. IDENTIFIABLE and RESEARCH are refused in SQL. */
    sourceClass: qualtricsFieldClassEnum("source_class").notNull(),
    /** Where it would land. A closed list, so no arbitrary column is reachable. */
    target: intakeTargetEnum("target").notNull(),
    /** Per-field opt-in. A mapping is inert until a person turns it on. */
    enabled: boolean("enabled").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("qualtrics_field_mappings_target_unique").on(t.studyId, t.target),
    index("qualtrics_field_mappings_study_idx").on(t.studyId),
  ],
);

export type QualtricsFieldMappingRow = typeof qualtricsFieldMappings.$inferSelect;
export type NewQualtricsFieldMapping = typeof qualtricsFieldMappings.$inferInsert;

/**
 * Authorizations a physical consent may grant (Phase 4b, D-032).
 *
 * Configuration, for the same reason `eligibility_reasons` is: "entrevista" and
 * "documental" are one trial's plan, and writing them as boolean columns would
 * put that plan in every study's schema (non-negotiable 6). A consent row
 * references these by `code` in its `granted_scopes` array.
 *
 * Scopes are deactivated, never deleted: a consent already granted against one
 * must stay readable, and a record of what someone agreed to is not editable
 * history.
 */
export const consentScopes = pgTable(
  "consent_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    code: text("code").notNull(),
    labelEs: text("label_es").notNull(),
    labelEn: text("label_en"),
    /**
     * Which consent may grant it. Constrained to PHYSICAL in SQL: only an
     * in-person signature carries these.
     */
    consentType: consentTypeEnum("consent_type").notNull().default("PHYSICAL"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("consent_scopes_code_unique").on(t.studyId, t.code),
    index("consent_scopes_study_idx").on(t.studyId, t.position),
  ],
);

export type ConsentScopeRow = typeof consentScopes.$inferSelect;
export type NewConsentScope = typeof consentScopes.$inferInsert;
