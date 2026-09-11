import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  auditEvents,
  consents,
  initialVisits,
  participantCohortAssignments,
  participantResponsibilities,
  randomizations,
  screenings,
  users,
} from "@/db/schema";

/**
 * Reading the audit log (Phase 4d).
 *
 * The log has been written since Phase 0; until now nothing could read it back
 * in the product, which made "consultar el historial de cambios" impossible
 * without database access. This service is that read, and nothing else — the
 * table is append-only at the database level and no code here writes to it.
 *
 * ACCESS: every caller must hold `audit.read`. That is asserted in the page, not
 * here, following the codebase's convention that services take an already
 * authorized context. What this service does guarantee is study scoping: every
 * query is filtered by `study_id`.
 *
 * WHAT IS RETURNED, AND WHAT IS NOT
 * ---------------------------------
 * `before_json` / `after_json` can contain contact fields on rows written by
 * earlier phases (docs/research-data-boundaries.md, open item 4). This service
 * therefore returns a REDACTED view by default: the action, when, who, and a
 * short list of the changed field NAMES — never their values. Values are
 * available through `includeSnapshots`, which the caller passes only after
 * checking the permission, so widening the exposure is a deliberate act at the
 * call site rather than the default shape of the data.
 */

/** Field names never shown, even in a redacted field list. */
const SENSITIVE_FIELDS = new Set([
  "fullName",
  "email",
  "emailNormalized",
  "phone",
  "externalRef",
  "reasonNote",
  "notes",
  "location",
  "overrideReason",
  "sizeOverrideReason",
]);

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorName: string | null;
  createdAt: Date;
  /** Names of fields that changed. Values omitted unless snapshots were asked for. */
  changedFields: string[];
  /** Present only when `includeSnapshots` was set. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Every audited change that touches one participant.
 *
 * Audit rows are keyed by the entity they changed, not by the participant, so
 * "this participant's history" means the participant row plus every screening,
 * consent, randomization, cohort assignment, responsibility and visit that
 * belongs to them. Those ids are gathered first and matched in one query.
 */
export async function listParticipantAudit(
  studyId: string,
  participantId: string,
  options: { includeSnapshots?: boolean; limit?: number } = {},
): Promise<AuditEntry[]> {
  const db = getDb();
  const { includeSnapshots = false, limit = 100 } = options;

  const [screeningIds, consentIds, randomizationIds, assignmentIds, responsibilityIds, visitIds] =
    await Promise.all([
      db.select({ id: screenings.id }).from(screenings).where(eq(screenings.participantId, participantId)),
      db.select({ id: consents.id }).from(consents).where(eq(consents.participantId, participantId)),
      db
        .select({ id: randomizations.id })
        .from(randomizations)
        .where(eq(randomizations.participantId, participantId)),
      db
        .select({ id: participantCohortAssignments.id })
        .from(participantCohortAssignments)
        .where(eq(participantCohortAssignments.participantId, participantId)),
      db
        .select({ id: participantResponsibilities.id })
        .from(participantResponsibilities)
        .where(eq(participantResponsibilities.participantId, participantId)),
      db
        .select({ id: initialVisits.id })
        .from(initialVisits)
        .where(eq(initialVisits.participantId, participantId)),
    ]);

  const relatedIds = [
    participantId,
    ...screeningIds.map((r) => r.id),
    ...consentIds.map((r) => r.id),
    ...randomizationIds.map((r) => r.id),
    ...assignmentIds.map((r) => r.id),
    ...responsibilityIds.map((r) => r.id),
    ...visitIds.map((r) => r.id),
  ];

  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      actorType: auditEvents.actorType,
      actorName: users.displayName,
      createdAt: auditEvents.createdAt,
      beforeJson: auditEvents.beforeJson,
      afterJson: auditEvents.afterJson,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(and(eq(auditEvents.studyId, studyId), inArray(auditEvents.entityId, relatedIds)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return rows.map((r) => toEntry(r, includeSnapshots));
}

/** Recent audited changes across the whole study. */
export async function listStudyAudit(
  studyId: string,
  options: { includeSnapshots?: boolean; limit?: number; actions?: readonly string[] } = {},
): Promise<AuditEntry[]> {
  const { includeSnapshots = false, limit = 100, actions } = options;

  const rows = await getDb()
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      actorType: auditEvents.actorType,
      actorName: users.displayName,
      createdAt: auditEvents.createdAt,
      beforeJson: auditEvents.beforeJson,
      afterJson: auditEvents.afterJson,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(
      actions && actions.length > 0
        ? and(eq(auditEvents.studyId, studyId), inArray(auditEvents.action, [...actions]))
        : eq(auditEvents.studyId, studyId),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return rows.map((r) => toEntry(r, includeSnapshots));
}

interface RawRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorName: string | null;
  createdAt: Date;
  beforeJson: unknown;
  afterJson: unknown;
  metadata: unknown;
}

function toEntry(r: RawRow, includeSnapshots: boolean): AuditEntry {
  const before = asRecord(r.beforeJson);
  const after = asRecord(r.afterJson);

  return {
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorType: r.actorType,
    actorName: r.actorName,
    createdAt: r.createdAt,
    changedFields: changedFields(before, after),
    before: includeSnapshots ? before : null,
    after: includeSnapshots ? after : null,
    metadata: asRecord(r.metadata),
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Which fields a row changed, by NAME.
 *
 * Names, not values, and sensitive names are dropped entirely rather than shown
 * as "email: ●●●" — a redaction marker still tells the reader that an email was
 * touched, which for a small study can be informative in itself.
 */
function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((k) => !SENSITIVE_FIELDS.has(k)).sort();
}

/** Count of audited changes in a study, for the settings page. */
export async function countAuditEvents(studyId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(or(eq(auditEvents.studyId, studyId), sql`${auditEvents.studyId} is null`));
  return Number(row?.n ?? 0);
}
