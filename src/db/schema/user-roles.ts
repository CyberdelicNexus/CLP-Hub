import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { staffRoleEnum } from "./enums";
import { studies } from "./studies";
import { users } from "./users";

/**
 * Study-scoped role grants. Rows are never deleted: revoking sets
 * `revoked_at`, preserving a full membership history. A partial unique
 * index (in SQL) prevents duplicate *active* grants.
 */
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  studyId: uuid("study_id").notNull().references(() => studies.id),
  role: staffRoleEnum("role").notNull(),
  grantedBy: uuid("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedBy: uuid("revoked_by").references(() => users.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type UserRole = typeof userRoles.$inferSelect;
