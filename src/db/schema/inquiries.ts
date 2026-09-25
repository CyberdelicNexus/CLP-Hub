import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { studies } from "./studies";
import { users } from "./users";

/**
 * A question from the public contact form, answered by staff in the Hub (D-088).
 *
 * `name`, `email` and `message` are present only while `status` is NEW; answering
 * or closing the inquiry sets them to NULL in the same transaction (check
 * constraints in migration 0023 make the other combination impossible). The
 * reply text is never stored. See src/domain/inquiry.ts.
 */
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    status: text("status").notNull().default("NEW"),
    locale: text("locale").notNull().default("es"),
    name: text("name"),
    email: text("email"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    handledBy: uuid("handled_by").references(() => users.id),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [index("inquiries_study_status_idx").on(t.studyId, t.status, t.createdAt)],
);

export type Inquiry = typeof inquiries.$inferSelect;
