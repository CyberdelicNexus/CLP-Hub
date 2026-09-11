import { boolean, date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { integrationModeEnum, studyStatusEnum, uiLocaleEnum } from "./enums";

/**
 * Root of all study scoping. Nothing trial-specific lives here:
 * arms, sessions, rules and content are configured per study in later phases.
 */
export const studies = pgTable("studies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  status: studyStatusEnum("status").notNull().default("DRAFT"),
  defaultLocale: uiLocaleEnum("default_locale").notNull().default("es"),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  recruitmentOpen: boolean("recruitment_open").notNull().default(false),
  /**
   * Where the public recruitment page sends people. Initial screening and the
   * digital consent that must precede it happen in Qualtrics (D-031), so this is
   * an external https URL, configured per study — never a path in this app and
   * never hardcoded (non-negotiable 6).
   */
  screeningUrl: text("screening_url"),
  /**
   * Qualtrics integration mode. DISABLED or TEST_ANONYMIZED only; there is no
   * live mode, because no transfer is implemented and none is authorized.
   */
  qualtricsMode: integrationModeEnum("qualtrics_mode").notNull().default("DISABLED"),
  recruitmentStart: date("recruitment_start"),
  recruitmentEnd: date("recruitment_end"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Study = typeof studies.$inferSelect;
