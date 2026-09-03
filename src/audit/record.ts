import type { DbExecutor } from "@/db/client";
import { auditEvents, type NewAuditEvent } from "@/db/schema";

/**
 * Audit primitive. Every research-relevant or permission-relevant change
 * must call `recordAuditEvent` inside the SAME transaction as the change,
 * so a failed write never leaves a dangling audit row and vice versa.
 *
 * The table is append-only at the database level (trigger). Nothing in
 * application code may update or delete audit rows.
 */

export type AuditActor =
  | { type: "STAFF"; id: string }
  | { type: "SYSTEM" }
  | { type: "PARTICIPANT"; id: string };

/** `<entity>.<verb>` in snake_case, e.g. "user.locale_changed". Mirrors the DB check. */
export type AuditAction = `${string}.${string}`;
const ACTION_PATTERN = /^[a-z_]+\.[a-z_]+$/;

export interface AuditEventInput {
  studyId?: string | null;
  actor: AuditActor;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/** Pure builder, unit-tested without a database. */
export function buildAuditRow(input: AuditEventInput): NewAuditEvent {
  if (!ACTION_PATTERN.test(input.action)) {
    throw new Error(`Invalid audit action "${input.action}": expected <entity>.<verb> in snake_case`);
  }
  if (!input.entityType || !input.entityId) {
    throw new Error("Audit event requires entityType and entityId");
  }
  return {
    studyId: input.studyId ?? null,
    actorType: input.actor.type,
    actorId: input.actor.type === "SYSTEM" ? null : input.actor.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.before ?? null,
    afterJson: input.after ?? null,
    metadata: input.metadata ?? null,
  };
}

export async function recordAuditEvent(executor: DbExecutor, input: AuditEventInput): Promise<void> {
  await executor.insert(auditEvents).values(buildAuditRow(input));
}
