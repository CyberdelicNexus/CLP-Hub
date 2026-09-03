import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uiLocaleEnum } from "./enums";

/**
 * Staff profile. `id` mirrors auth.users(id) in Supabase Auth.
 * Staff are deactivated, never deleted, so audit actor references survive.
 * Participants are NOT users: they never authenticate (see docs/architecture.md).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  preferredLocale: uiLocaleEnum("preferred_locale").notNull().default("es"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
