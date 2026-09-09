import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb, type DbExecutor } from "@/db/client";
import {
  cohortSessions,
  contentAssignments,
  contentVersions,
  contents,
  sessionTemplates,
  users,
  type Content,
  type ContentVersion,
} from "@/db/schema";
import {
  bodySchema,
  canTransitionContent,
  isEditable,
  isPublicContentType,
  isSessionContentType,
  parseBody,
  type ContentBody,
  type ContentStatus,
  type ContentType,
} from "@/domain/content";
import type { Locale } from "@/domain/locale";

/**
 * Study content (Phase 5).
 *
 * The publishing rules from docs/content-model.md, enforced here and by the
 * database rather than by convention:
 *   - Publishing NEVER mutates a published row. It archives the current live
 *     version and marks the new one published, in one transaction.
 *   - Only one PUBLISHED version exists per (content, locale) — a partial unique
 *     index guarantees it even under concurrent publishes.
 *   - Editing a published version is impossible; you create a new draft instead.
 */

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move content version from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}
export class ConflictError extends Error {
  readonly reason: "duplicateKey" | "notEditable" | "invalidBody" | "noSession";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ContentListRow {
  id: string;
  type: ContentType;
  key: string;
  sessionCode: string | null;
  sessionName: string | null;
  /** The live Spanish version, when there is one. */
  publishedTitle: string | null;
  publishedVersion: number | null;
  /** A draft or in-review version waiting for attention. */
  workingStatus: ContentStatus | null;
  workingVersion: number | null;
}

export async function listContents(studyId: string, locale: Locale): Promise<ContentListRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: contents.id,
      type: contents.type,
      key: contents.key,
      sessionCode: sessionTemplates.code,
      sessionName: sessionTemplates.nameEs,
    })
    .from(contents)
    .leftJoin(sessionTemplates, eq(sessionTemplates.id, contents.sessionTemplateId))
    .where(eq(contents.studyId, studyId))
    .orderBy(asc(contents.type), asc(contents.key));

  if (rows.length === 0) return [];

  const versions = await db
    .select({
      contentId: contentVersions.contentId,
      status: contentVersions.status,
      versionNumber: contentVersions.versionNumber,
      title: contentVersions.title,
    })
    .from(contentVersions)
    .where(
      and(
        inArray(
          contentVersions.contentId,
          rows.map((r) => r.id),
        ),
        eq(contentVersions.locale, locale),
        inArray(contentVersions.status, ["PUBLISHED", "DRAFT", "REVIEW"]),
      ),
    )
    .orderBy(desc(contentVersions.versionNumber));

  return rows.map((row) => {
    const mine = versions.filter((v) => v.contentId === row.id);
    const published = mine.find((v) => v.status === "PUBLISHED");
    const working = mine.find((v) => v.status === "DRAFT" || v.status === "REVIEW");
    return {
      ...row,
      publishedTitle: published?.title ?? null,
      publishedVersion: published?.versionNumber ?? null,
      workingStatus: (working?.status as ContentStatus | undefined) ?? null,
      workingVersion: working?.versionNumber ?? null,
    };
  });
}

export interface ContentDetail {
  content: Content & { sessionCode: string | null };
  versions: (ContentVersion & { createdByName: string | null })[];
}

export async function getContentDetail(
  studyId: string,
  contentId: string,
  locale: Locale,
): Promise<ContentDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({ content: contents, sessionCode: sessionTemplates.code })
    .from(contents)
    .leftJoin(sessionTemplates, eq(sessionTemplates.id, contents.sessionTemplateId))
    .where(and(eq(contents.id, contentId), eq(contents.studyId, studyId)))
    .limit(1);
  if (!row) return null;

  const versions = await db
    .select({ version: contentVersions, createdByName: users.displayName })
    .from(contentVersions)
    .leftJoin(users, eq(users.id, contentVersions.createdBy))
    .where(and(eq(contentVersions.contentId, contentId), eq(contentVersions.locale, locale)))
    .orderBy(desc(contentVersions.versionNumber));

  return {
    content: { ...row.content, sessionCode: row.sessionCode },
    versions: versions.map((v) => ({ ...v.version, createdByName: v.createdByName })),
  };
}

export async function getVersion(
  studyId: string,
  versionId: string,
): Promise<{ version: ContentVersion; content: Content; sessionCode: string | null } | null> {
  const [row] = await getDb()
    .select({ version: contentVersions, content: contents, sessionCode: sessionTemplates.code })
    .from(contentVersions)
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .leftJoin(sessionTemplates, eq(sessionTemplates.id, contents.sessionTemplateId))
    .where(and(eq(contentVersions.id, versionId), eq(contents.studyId, studyId)))
    .limit(1);
  return row ?? null;
}

/**
 * The live page for a public slug. Used by the public site, which is why it
 * filters on PUBLISHED and on web-publishable types: a message template must
 * never be reachable as a web page.
 */
export async function getPublishedByKey(params: {
  key: string;
  locale: Locale;
}): Promise<{ title: string; body: ContentBody; updatedAt: Date; key: string } | null> {
  const [row] = await getDb()
    .select({
      title: contentVersions.title,
      body: contentVersions.body,
      updatedAt: contentVersions.publishedAt,
      key: contents.key,
      type: contents.type,
    })
    .from(contentVersions)
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .where(
      and(
        eq(contents.key, params.key),
        eq(contentVersions.locale, params.locale),
        eq(contentVersions.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  if (!row || !isPublicContentType(row.type) || isSessionContentType(row.type)) return null;
  const { blocks } = parseBody(row.body);
  return { title: row.title, body: blocks, updatedAt: row.updatedAt ?? new Date(), key: row.key };
}

/** The live preparation or integration page for a session, by session code. */
export async function getPublishedForSession(params: {
  sessionCode: string;
  type: Extract<ContentType, "SESSION_PREPARATION" | "SESSION_INTEGRATION">;
  locale: Locale;
}): Promise<{ title: string; body: ContentBody; sessionName: string; updatedAt: Date } | null> {
  const [row] = await getDb()
    .select({
      title: contentVersions.title,
      body: contentVersions.body,
      updatedAt: contentVersions.publishedAt,
      sessionName: sessionTemplates.nameEs,
    })
    .from(contentVersions)
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, contents.sessionTemplateId))
    .where(
      and(
        eq(sessionTemplates.code, params.sessionCode),
        eq(contents.type, params.type),
        eq(contentVersions.locale, params.locale),
        eq(contentVersions.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  if (!row) return null;
  const { blocks } = parseBody(row.body);
  return {
    title: row.title,
    body: blocks,
    sessionName: row.sessionName,
    updatedAt: row.updatedAt ?? new Date(),
  };
}

/** Every public page that currently exists, for the study index. */
export async function listPublishedPages(
  locale: Locale,
): Promise<{ path: string; title: string }[]> {
  const rows = await getDb()
    .select({
      type: contents.type,
      key: contents.key,
      title: contentVersions.title,
      sessionCode: sessionTemplates.code,
      position: sessionTemplates.position,
    })
    .from(contentVersions)
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .leftJoin(sessionTemplates, eq(sessionTemplates.id, contents.sessionTemplateId))
    .where(and(eq(contentVersions.locale, locale), eq(contentVersions.status, "PUBLISHED")))
    .orderBy(asc(sessionTemplates.position), asc(contents.key));

  return rows
    .filter((r) => isPublicContentType(r.type))
    .map((r) => ({
      path: isSessionContentType(r.type)
        ? `/estudio/sesiones/${r.sessionCode}/${r.type === "SESSION_PREPARATION" ? "preparacion" : "integracion"}`
        : `/estudio/${r.key}`,
      title: r.title,
    }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createContent(params: {
  studyId: string;
  actorId: string;
  type: ContentType;
  key: string;
  sessionTemplateId?: string | null;
  title: string;
  locale: Locale;
}): Promise<string> {
  const { studyId, actorId, type, locale } = params;
  const key = params.key.trim().toLowerCase();

  if (isSessionContentType(type) && !params.sessionTemplateId) {
    throw new ConflictError("noSession");
  }

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.studyId, studyId), eq(contents.key, key)))
      .limit(1);
    if (existing) throw new ConflictError("duplicateKey");

    const [content] = await tx
      .insert(contents)
      .values({
        studyId,
        type,
        key,
        sessionTemplateId: isSessionContentType(type) ? params.sessionTemplateId! : null,
      })
      .returning({ id: contents.id });

    const [version] = await tx
      .insert(contentVersions)
      .values({
        contentId: content.id,
        locale,
        versionNumber: 1,
        title: params.title.trim(),
        body: [],
        status: "DRAFT",
        createdBy: actorId,
      })
      .returning({ id: contentVersions.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "content.created",
      entityType: "content",
      entityId: content.id,
      after: { type, key, locale, firstVersionId: version.id },
    });

    return content.id;
  });
}

/** Save a draft body. Refuses on a published or archived version. */
export async function saveVersion(params: {
  studyId: string;
  versionId: string;
  actorId: string;
  title: string;
  body: unknown;
}): Promise<void> {
  const { studyId, versionId, actorId } = params;

  const parsed = bodySchema.safeParse(params.body);
  if (!parsed.success) throw new ConflictError("invalidBody");

  await getDb().transaction(async (tx) => {
    const current = await loadVersion(tx, studyId, versionId);
    if (!isEditable(current.status)) throw new ConflictError("notEditable");

    await tx
      .update(contentVersions)
      .set({ title: params.title.trim(), body: parsed.data })
      .where(eq(contentVersions.id, versionId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "content_version.saved",
      entityType: "content_version",
      entityId: versionId,
      // The body itself is not snapshotted: it is long, and the version row is
      // the record. Block count is enough to see that something changed.
      before: { title: current.title, blocks: asBlockCount(current.body) },
      after: { title: params.title.trim(), blocks: parsed.data.length },
    });
  });
}

export async function setVersionStatus(params: {
  studyId: string;
  versionId: string;
  actorId: string;
  status: Extract<ContentStatus, "DRAFT" | "REVIEW">;
}): Promise<void> {
  const { studyId, versionId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const current = await loadVersion(tx, studyId, versionId);
    if (!canTransitionContent(current.status, status)) {
      throw new InvalidTransitionError(current.status, status);
    }

    await tx.update(contentVersions).set({ status }).where(eq(contentVersions.id, versionId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "content_version.status_changed",
      entityType: "content_version",
      entityId: versionId,
      before: { status: current.status },
      after: { status },
    });
  });
}

/**
 * Publish a version.
 *
 * Archives whatever was live for this (content, locale) and marks this version
 * published, in one transaction. The previously published row is not edited in
 * any way other than its status and it keeps its `published_at`, so the record
 * of what was live and when stays intact.
 */
export async function publishVersion(params: {
  studyId: string;
  versionId: string;
  actorId: string;
}): Promise<void> {
  const { studyId, versionId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const current = await loadVersion(tx, studyId, versionId);
    if (!canTransitionContent(current.status, "PUBLISHED")) {
      throw new InvalidTransitionError(current.status, "PUBLISHED");
    }

    const [live] = await tx
      .select({ id: contentVersions.id, versionNumber: contentVersions.versionNumber })
      .from(contentVersions)
      .where(
        and(
          eq(contentVersions.contentId, current.contentId),
          eq(contentVersions.locale, current.locale),
          eq(contentVersions.status, "PUBLISHED"),
        ),
      )
      .limit(1);

    if (live) {
      await tx
        .update(contentVersions)
        .set({ status: "ARCHIVED" })
        .where(eq(contentVersions.id, live.id));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "content_version.archived",
        entityType: "content_version",
        entityId: live.id,
        before: { status: "PUBLISHED" },
        after: { status: "ARCHIVED", replacedBy: versionId },
      });
    }

    await tx
      .update(contentVersions)
      .set({ status: "PUBLISHED", publishedAt: new Date(), approvedBy: actorId })
      .where(eq(contentVersions.id, versionId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "content_version.published",
      entityType: "content_version",
      entityId: versionId,
      before: { status: current.status },
      after: {
        status: "PUBLISHED",
        versionNumber: current.versionNumber,
        replacedVersion: live?.versionNumber ?? null,
      },
    });
  });
}

/**
 * Start a new draft from the current published version, so editing live content
 * is always "make the next version" rather than "change what people can see".
 */
export async function createDraftFrom(params: {
  studyId: string;
  versionId: string;
  actorId: string;
}): Promise<string> {
  const { studyId, versionId, actorId } = params;

  return getDb().transaction(async (tx) => {
    const source = await loadVersion(tx, studyId, versionId);

    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${contentVersions.versionNumber}), 0)` })
      .from(contentVersions)
      .where(
        and(
          eq(contentVersions.contentId, source.contentId),
          eq(contentVersions.locale, source.locale),
        ),
      );

    const [created] = await tx
      .insert(contentVersions)
      .values({
        contentId: source.contentId,
        locale: source.locale,
        versionNumber: Number(max) + 1,
        title: source.title,
        body: source.body,
        status: "DRAFT",
        createdBy: actorId,
      })
      .returning({ id: contentVersions.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "content_version.drafted",
      entityType: "content_version",
      entityId: created.id,
      after: { versionNumber: Number(max) + 1, copiedFrom: versionId },
    });

    return created.id;
  });
}

// ---------------------------------------------------------------------------
// Version pinning
// ---------------------------------------------------------------------------

/**
 * Pin the currently published content for a session, at scheduling time (D-027).
 *
 * Called from the session service inside its transaction. Pins only what is
 * published right now; if nothing is published yet, nothing is pinned and the
 * session simply has no assignment, which is honest rather than inventing one.
 */
export async function pinSessionContent(
  tx: DbExecutor,
  params: { studyId: string; cohortSessionId: string; templateId: string | null; actorId: string },
): Promise<number> {
  if (!params.templateId) return 0;

  const live = await tx
    .select({ id: contentVersions.id, type: contents.type })
    .from(contentVersions)
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .where(
      and(
        eq(contents.sessionTemplateId, params.templateId),
        eq(contentVersions.status, "PUBLISHED"),
      ),
    );

  if (live.length === 0) return 0;

  await tx
    .insert(contentAssignments)
    .values(
      live.map((v) => ({
        studyId: params.studyId,
        cohortSessionId: params.cohortSessionId,
        contentVersionId: v.id,
        pinnedBy: params.actorId,
      })),
    )
    .onConflictDoNothing();

  await recordAuditEvent(tx, {
    studyId: params.studyId,
    actor: { type: "STAFF", id: params.actorId },
    action: "content_assignment.pinned",
    entityType: "cohort_session",
    entityId: params.cohortSessionId,
    after: { pinned: live.length, versionIds: live.map((v) => v.id) },
  });

  return live.length;
}

/** What a session was pinned to, for the session page. */
export async function listSessionContent(
  cohortSessionId: string,
): Promise<{ title: string; versionNumber: number; type: ContentType; key: string; pinnedAt: Date }[]> {
  const rows = await getDb()
    .select({
      title: contentVersions.title,
      versionNumber: contentVersions.versionNumber,
      type: contents.type,
      key: contents.key,
      pinnedAt: contentAssignments.pinnedAt,
    })
    .from(contentAssignments)
    .innerJoin(contentVersions, eq(contentVersions.id, contentAssignments.contentVersionId))
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .where(
      and(
        eq(contentAssignments.cohortSessionId, cohortSessionId),
        isNull(contentAssignments.supersededAt),
      ),
    )
    .orderBy(asc(contents.type));
  return rows;
}

/** Sessions in a study whose pinned content is no longer the published one. */
export async function countStaleAssignments(studyId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: contentAssignments.id })
    .from(contentAssignments)
    .innerJoin(contentVersions, eq(contentVersions.id, contentAssignments.contentVersionId))
    .innerJoin(cohortSessions, eq(cohortSessions.id, contentAssignments.cohortSessionId))
    .where(
      and(
        eq(contentAssignments.studyId, studyId),
        isNull(contentAssignments.supersededAt),
        eq(cohortSessions.status, "SCHEDULED"),
        // Pinned to something that is no longer live.
        sql`${contentVersions.status} <> 'PUBLISHED'`,
      ),
    );
  return rows.length;
}

// ---------------------------------------------------------------------------

async function loadVersion(tx: DbExecutor, studyId: string, versionId: string) {
  const [row] = await tx
    .select({
      id: contentVersions.id,
      contentId: contentVersions.contentId,
      locale: contentVersions.locale,
      versionNumber: contentVersions.versionNumber,
      title: contentVersions.title,
      body: contentVersions.body,
      status: contentVersions.status,
    })
    .from(contentVersions)
    .innerJoin(contents, eq(contents.id, contentVersions.contentId))
    .where(and(eq(contentVersions.id, versionId), eq(contents.studyId, studyId)))
    .limit(1);
  if (!row) throw new NotFoundError("content version", versionId);
  return row;
}

function asBlockCount(body: unknown): number {
  return Array.isArray(body) ? body.length : 0;
}
