import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import {
  cohorts,
  communicationTemplates,
  communications,
  initialVisits,
  participantCohortAssignments,
  participantContacts,
  participantResponsibilities,
  participants,
  users,
  type Communication,
  type CommunicationTemplate,
} from "@/db/schema";
import {
  validateTemplateBody,
  type CommunicationChannel,
  type CommunicationStage,
  type TemplateProblem,
  type TemplateValues,
} from "@/domain/communication";

/**
 * Message templates and send records (Phase 7).
 *
 * THIS SERVICE SENDS NOTHING. There is no HTTP client here, no credential, no
 * queue. `recordSend` writes down that a human copied a message and sent it
 * (D-004). `tests/communication.test.ts` asserts the absence.
 *
 * It also never stores the rendered message. `suggestValues` gathers what a
 * template needs so the UI can render a preview in memory; that preview is
 * shown, copied, and forgotten. What persists is the template, its version, and
 * the fact of sending (D-039).
 */

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}

export class TemplateError extends Error {
  readonly problem: TemplateProblem;
  constructor(problem: TemplateProblem) {
    super(problem);
    this.name = "TemplateError";
    this.problem = problem;
  }
}

export class ConflictError extends Error {
  readonly reason: "duplicateKey";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listTemplates(
  studyId: string,
  options: { stage?: CommunicationStage; activeOnly?: boolean } = {},
): Promise<CommunicationTemplate[]> {
  const conditions = [eq(communicationTemplates.studyId, studyId)];
  if (options.stage) conditions.push(eq(communicationTemplates.stage, options.stage));
  if (options.activeOnly) conditions.push(eq(communicationTemplates.active, true));

  return getDb()
    .select()
    .from(communicationTemplates)
    .where(and(...conditions))
    .orderBy(asc(communicationTemplates.stage), asc(communicationTemplates.position), asc(communicationTemplates.key));
}

export async function getTemplate(
  studyId: string,
  templateId: string,
): Promise<CommunicationTemplate | null> {
  const [row] = await getDb()
    .select()
    .from(communicationTemplates)
    .where(and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.studyId, studyId)))
    .limit(1);
  return row ?? null;
}

/**
 * Gather the values a template can interpolate, for one participant.
 *
 * Only the closed list of allowed variables is ever looked up, and `nombre` is
 * fetched only when the caller may read contact data. Everything else is
 * operational: the cohort code, the booked visit, the named responsible.
 *
 * The result is handed to `renderTemplate` in memory and never written anywhere.
 */
export async function suggestValues(
  studyId: string,
  participantId: string,
  options: { includeContact: boolean; timezone: string },
): Promise<TemplateValues> {
  const db = getDb();

  const [participant] = await db
    .select({ id: participants.id, code: participants.code })
    .from(participants)
    .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
    .limit(1);
  if (!participant) throw new NotFoundError("participant", participantId);

  const [contactRow, cohortRow, visitRow, responsibleRow] = await Promise.all([
    options.includeContact
      ? db
          .select({ fullName: participantContacts.fullName })
          .from(participantContacts)
          .where(eq(participantContacts.participantId, participantId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ code: cohorts.code })
      .from(participantCohortAssignments)
      .innerJoin(cohorts, eq(cohorts.id, participantCohortAssignments.cohortId))
      .where(
        and(
          eq(participantCohortAssignments.participantId, participantId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1),
    db
      .select({ scheduledAt: initialVisits.scheduledAt, location: initialVisits.location })
      .from(initialVisits)
      .where(and(eq(initialVisits.participantId, participantId), eq(initialVisits.status, "SCHEDULED")))
      .limit(1),
    db
      .select({ displayName: users.displayName })
      .from(participantResponsibilities)
      .innerJoin(users, eq(users.id, participantResponsibilities.userId))
      .where(
        and(
          eq(participantResponsibilities.participantId, participantId),
          eq(participantResponsibilities.role, "INITIAL_SESSION"),
          isNull(participantResponsibilities.revokedAt),
        ),
      )
      .limit(1),
  ]);

  const values: TemplateValues = { codigo: participant.code };

  // Only the FIRST name. A template greeting does not need a surname, and a
  // surname in a WhatsApp group is markedly more identifying than a given name.
  const fullName = contactRow[0]?.fullName ?? null;
  if (fullName) values.nombre = fullName.trim().split(/\s+/)[0];

  if (cohortRow[0]?.code) values.cohorte = cohortRow[0].code;
  if (responsibleRow[0]?.displayName) values.responsable = responsibleRow[0].displayName;

  const visit = visitRow[0];
  if (visit?.scheduledAt) {
    values.fecha = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "full",
      timeZone: options.timezone,
    }).format(visit.scheduledAt);
    values.hora = new Intl.DateTimeFormat("es-ES", {
      timeStyle: "short",
      timeZone: options.timezone,
    }).format(visit.scheduledAt);
  }
  if (visit?.location) values.lugar = visit.location;

  return values;
}

/** What has been sent to a participant. Templates and dates, never message text. */
export async function listParticipantCommunications(
  participantId: string,
): Promise<(Communication & { templateName: string | null; sentByName: string | null })[]> {
  const rows = await getDb()
    .select({
      communication: communications,
      templateName: communicationTemplates.nameEs,
      sentByName: users.displayName,
    })
    .from(communications)
    .leftJoin(communicationTemplates, eq(communicationTemplates.id, communications.templateId))
    .leftJoin(users, eq(users.id, communications.sentBy))
    .where(eq(communications.participantId, participantId))
    .orderBy(desc(communications.sentAt));

  return rows.map((r) => ({
    ...r.communication,
    templateName: r.templateName,
    sentByName: r.sentByName,
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createTemplate(params: {
  studyId: string;
  actorId: string;
  key: string;
  stage: CommunicationStage;
  channel: CommunicationChannel;
  nameEs: string;
  bodyEs: string;
  bodyEn?: string | null;
}): Promise<string> {
  const { studyId, actorId } = params;
  const key = params.key.trim().toLowerCase();
  const bodyEs = params.bodyEs.trim();

  const problem = validateTemplateBody(bodyEs);
  if (problem) throw new TemplateError(problem);
  if (params.bodyEn) {
    const enProblem = validateTemplateBody(params.bodyEn.trim());
    if (enProblem) throw new TemplateError(enProblem);
  }

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: communicationTemplates.id })
      .from(communicationTemplates)
      .where(and(eq(communicationTemplates.studyId, studyId), eq(communicationTemplates.key, key)))
      .limit(1);
    if (existing) throw new ConflictError("duplicateKey");

    const [created] = await tx
      .insert(communicationTemplates)
      .values({
        studyId,
        key,
        stage: params.stage,
        channel: params.channel,
        nameEs: params.nameEs.trim(),
        bodyEs,
        bodyEn: params.bodyEn?.trim() || null,
      })
      .returning({ id: communicationTemplates.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "communication_template.created",
      entityType: "communication_template",
      entityId: created.id,
      // The key, stage and channel are configuration and safe to snapshot. The
      // body is staff-authored text; its length is recorded, not its content.
      after: { key, stage: params.stage, channel: params.channel, bodyLength: bodyEs.length },
    });

    return created.id;
  });
}

export async function updateTemplate(params: {
  studyId: string;
  templateId: string;
  actorId: string;
  nameEs: string;
  bodyEs: string;
  bodyEn?: string | null;
  active?: boolean;
}): Promise<void> {
  const { studyId, templateId, actorId } = params;
  const bodyEs = params.bodyEs.trim();

  const problem = validateTemplateBody(bodyEs);
  if (problem) throw new TemplateError(problem);

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: communicationTemplates.id,
        key: communicationTemplates.key,
        version: communicationTemplates.version,
      })
      .from(communicationTemplates)
      .where(
        and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.studyId, studyId)),
      )
      .limit(1);
    if (!current) throw new NotFoundError("template", templateId);

    await tx
      .update(communicationTemplates)
      .set({
        nameEs: params.nameEs.trim(),
        bodyEs,
        bodyEn: params.bodyEn?.trim() || null,
        active: params.active ?? true,
        // Bumped so a communications row can say which wording was used, without
        // this table growing a version history of its own.
        version: current.version + 1,
      })
      .where(eq(communicationTemplates.id, templateId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "communication_template.updated",
      entityType: "communication_template",
      entityId: templateId,
      before: { version: current.version },
      after: { version: current.version + 1, key: current.key, bodyLength: bodyEs.length },
    });
  });
}

/**
 * Record that a human sent a message, or deliberately did not.
 *
 * THIS IS A RECORD, NOT A SEND. By the time it is called the message has already
 * been copied and pasted by a person. It stores the template body with its
 * placeholders intact — never the rendered text, which contains the
 * participant's name, date and location (D-039).
 */
export async function recordSend(params: {
  studyId: string;
  participantId: string;
  templateId: string;
  actorId: string;
  status?: "SENT" | "SKIPPED";
  skipReason?: string | null;
}): Promise<string> {
  const { studyId, participantId, templateId, actorId } = params;
  const status = params.status ?? "SENT";
  const skipReason = status === "SKIPPED" ? params.skipReason?.trim().slice(0, 280) || null : null;

  return getDb().transaction(async (tx) => {
    const [participant] = await tx
      .select({ id: participants.id, code: participants.code })
      .from(participants)
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!participant) throw new NotFoundError("participant", participantId);

    const [template] = await tx
      .select({
        id: communicationTemplates.id,
        key: communicationTemplates.key,
        stage: communicationTemplates.stage,
        channel: communicationTemplates.channel,
        bodyEs: communicationTemplates.bodyEs,
        version: communicationTemplates.version,
      })
      .from(communicationTemplates)
      .where(
        and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.studyId, studyId)),
      )
      .limit(1);
    if (!template) throw new NotFoundError("template", templateId);

    const [created] = await tx
      .insert(communications)
      .values({
        studyId,
        participantId,
        templateId,
        templateVersion: template.version,
        templateBody: template.bodyEs,
        stage: template.stage,
        channel: template.channel,
        status,
        skipReason,
        sentBy: actorId,
      })
      .returning({ id: communications.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "communication.recorded",
      entityType: "communication",
      entityId: created.id,
      after: {
        participantCode: participant.code,
        templateKey: template.key,
        templateVersion: template.version,
        stage: template.stage,
        channel: template.channel,
        status,
      },
    });

    return created.id;
  });
}
