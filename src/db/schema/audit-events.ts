import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditActorTypeEnum } from "./enums";
import { studies } from "./studies";

/**
 * Append-only audit log. UPDATE and DELETE are blocked by a trigger in
 * the migration. Write only through src/audit/record.ts inside the same
 * transaction as the change being recorded.
 *
 * before/after snapshots may contain contact PII; access is gated by the
 * `audit.read` permission and retention is an open governance item.
 */
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  studyId: uuid("study_id").references(() => studies.id),
  actorType: auditActorTypeEnum("actor_type").notNull(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: jsonb("before_json").$type<Record<string, unknown> | null>(),
  afterJson: jsonb("after_json").$type<Record<string, unknown> | null>(),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
