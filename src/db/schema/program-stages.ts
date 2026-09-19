import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sessionModalityEnum } from "./enums";
import { studies } from "./studies";

/**
 * The programme's stages for a study — Phase 4f (2026-09-18 request). Names,
 * order and modality are configuration rows, exactly like `sessionTemplates`:
 * a stage called "Cuerpos de luz" is data belonging to a study, never a value
 * in code (non-negotiable 6). In its own file (not sessions.ts) because
 * `cohorts` references it and `sessions.ts` already imports from `cohorts.ts`
 * — this avoids a circular import between the two.
 */
export const programStages = pgTable(
  "program_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    code: text("code").notNull(),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en"),
    position: integer("position").notNull().default(0),
    modality: sessionModalityEnum("modality").notNull().default("IN_PERSON"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("program_stages_code_unique").on(t.studyId, t.code),
    index("program_stages_study_idx").on(t.studyId, t.position),
  ],
);

export type ProgramStage = typeof programStages.$inferSelect;
