import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import {
  cohortSessions,
  cohortStaff,
  cohorts,
  communicationTemplates,
  communications,
  initialVisits,
  participantCohortAssignments,
  participantContacts,
  participantResponsibilities,
  participants,
  sessionTemplates,
  users,
  type Communication,
  type CommunicationTemplate,
} from "@/db/schema";
import {
  validateTemplateBody,
  type CommunicationAudience,
  type CommunicationChannel,
  type CommunicationStage,
  type SendTarget,
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
  readonly reason: "duplicateKey" | "audienceMismatch";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TemplateRow extends CommunicationTemplate {
  /** Spanish name of the linked session, or null when the message is not about one. */
  sessionName: string | null;
  /** Programme order of that session, so the grouping reads in running order. */
  sessionPosition: number | null;
}

/**
 * Templates, with their session resolved.
 *
 * Ordered by stage, then by the session's position in the programme, then by the
 * template's own position — so a "recordatorio de sesión" group reads session 1,
 * session 2, session 3 rather than alphabetically.
 */
export async function listTemplates(
  studyId: string,
  options: {
    stage?: CommunicationStage;
    audience?: CommunicationAudience;
    activeOnly?: boolean;
  } = {},
): Promise<TemplateRow[]> {
  const conditions = [eq(communicationTemplates.studyId, studyId)];
  if (options.stage) conditions.push(eq(communicationTemplates.stage, options.stage));
  if (options.audience) conditions.push(eq(communicationTemplates.audience, options.audience));
  if (options.activeOnly) conditions.push(eq(communicationTemplates.active, true));

  const rows = await getDb()
    .select({
      template: communicationTemplates,
      sessionName: sessionTemplates.nameEs,
      sessionPosition: sessionTemplates.position,
    })
    .from(communicationTemplates)
    .leftJoin(sessionTemplates, eq(sessionTemplates.id, communicationTemplates.sessionTemplateId))
    .where(and(...conditions))
    .orderBy(
      asc(communicationTemplates.stage),
      asc(sessionTemplates.position),
      asc(communicationTemplates.position),
      asc(communicationTemplates.key),
    );

  return rows.map((r) => ({
    ...r.template,
    sessionName: r.sessionName,
    sessionPosition: r.sessionPosition,
  }));
}

/** Sessions a template can be attached to, in programme order. */
export async function listSessionOptions(
  studyId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await getDb()
    .select({ id: sessionTemplates.id, name: sessionTemplates.nameEs })
    .from(sessionTemplates)
    .where(and(eq(sessionTemplates.studyId, studyId), eq(sessionTemplates.active, true)))
    .orderBy(asc(sessionTemplates.position), asc(sessionTemplates.code));
  return rows;
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

/**
 * Gather the values a CHANNEL template can interpolate, for one cohort.
 *
 * Deliberately narrower than `suggestValues`: no `nombre`, no `codigo`. Those
 * are refused for channel templates at save time (D-041), so supplying them
 * here would be offering a value for something that cannot be used.
 *
 * `fecha`, `hora` and `lugar` come from the cohort's next scheduled session —
 * which is what a group reminder is almost always about — and `responsable`
 * from whoever staffs the cohort.
 */
export async function suggestCohortValues(
  studyId: string,
  cohortId: string,
  options: { timezone: string; sessionTemplateId?: string | null },
): Promise<TemplateValues> {
  const db = getDb();

  const [cohort] = await db
    .select({ id: cohorts.id, code: cohorts.code })
    .from(cohorts)
    .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
    .limit(1);
  if (!cohort) throw new NotFoundError("cohort", cohortId);

  // When the template names a session, that session's instance for this cohort
  // is the one the message is about. Otherwise the soonest one still scheduled.
  const sessionConditions = [
    eq(cohortSessions.cohortId, cohortId),
    eq(cohortSessions.status, "SCHEDULED"),
  ];
  if (options.sessionTemplateId) {
    sessionConditions.push(eq(cohortSessions.templateId, options.sessionTemplateId));
  }

  const [sessionRow, staffRow] = await Promise.all([
    db
      .select({ scheduledAt: cohortSessions.scheduledStart, location: cohortSessions.location })
      .from(cohortSessions)
      .where(and(...sessionConditions))
      .orderBy(asc(cohortSessions.scheduledStart))
      .limit(1),
    db
      .select({ displayName: users.displayName })
      .from(cohortStaff)
      .innerJoin(users, eq(users.id, cohortStaff.userId))
      .where(and(eq(cohortStaff.cohortId, cohortId), isNull(cohortStaff.revokedAt)))
      .orderBy(asc(users.displayName))
      .limit(1),
  ]);

  const values: TemplateValues = { cohorte: cohort.code };

  if (staffRow[0]?.displayName) values.responsable = staffRow[0].displayName;

  const session = sessionRow[0];
  if (session?.scheduledAt) {
    values.fecha = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "full",
      timeZone: options.timezone,
    }).format(session.scheduledAt);
    values.hora = new Intl.DateTimeFormat("es-ES", {
      timeStyle: "short",
      timeZone: options.timezone,
    }).format(session.scheduledAt);
  }
  if (session?.location) values.lugar = session.location;

  return values;
}

/** Cohorts a channel message can be addressed to, in scope for this caller. */
export async function listCohortOptions(
  studyId: string,
): Promise<{ id: string; code: string; name: string }[]> {
  return getDb()
    .select({ id: cohorts.id, code: cohorts.code, name: cohorts.name })
    .from(cohorts)
    .where(eq(cohorts.studyId, studyId))
    .orderBy(asc(cohorts.code));
}

/** What has been pasted into a cohort's channel. */
export async function listCohortCommunications(
  cohortId: string,
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
    .where(eq(communications.cohortId, cohortId))
    .orderBy(desc(communications.sentAt));

  return rows.map((r) => ({
    ...r.communication,
    templateName: r.templateName,
    sentByName: r.sentByName,
  }));
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
  audience?: CommunicationAudience;
  sessionTemplateId?: string | null;
  nameEs: string;
  bodyEs: string;
  bodyEn?: string | null;
}): Promise<string> {
  const { studyId, actorId } = params;
  const key = params.key.trim().toLowerCase();
  const bodyEs = params.bodyEs.trim();
  const audience: CommunicationAudience = params.audience ?? "PARTICIPANT";

  // Validated against the AUDIENCE, so a channel template naming one person is
  // refused rather than saved and pasted into a group (D-041).
  const problem = validateTemplateBody(bodyEs, audience);
  if (problem) throw new TemplateError(problem);
  if (params.bodyEn) {
    const enProblem = validateTemplateBody(params.bodyEn.trim(), audience);
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
        audience,
        sessionTemplateId: params.sessionTemplateId || null,
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
      after: {
        key,
        stage: params.stage,
        channel: params.channel,
        audience,
        sessionTemplateId: params.sessionTemplateId || null,
        bodyLength: bodyEs.length,
      },
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
  sessionTemplateId?: string | null;
  active?: boolean;
}): Promise<void> {
  const { studyId, templateId, actorId } = params;
  const bodyEs = params.bodyEs.trim();

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: communicationTemplates.id,
        key: communicationTemplates.key,
        version: communicationTemplates.version,
        audience: communicationTemplates.audience,
      })
      .from(communicationTemplates)
      .where(
        and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.studyId, studyId)),
      )
      .limit(1);
    if (!current) throw new NotFoundError("template", templateId);

    // Read the audience first: the same body can be legal for a personal message
    // and illegal for a channel one, so validation needs the stored value rather
    // than a default. The audience itself is not editable — changing it would
    // silently re-scope a template that staff already use.
    const problem = validateTemplateBody(bodyEs, current.audience);
    if (problem) throw new TemplateError(problem);

    await tx
      .update(communicationTemplates)
      .set({
        nameEs: params.nameEs.trim(),
        bodyEs,
        bodyEn: params.bodyEn?.trim() || null,
        sessionTemplateId: params.sessionTemplateId ?? null,
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
 * Move an existing template to a different session — the same "pick from
 * the list instead of only ever authoring new" pattern D-070 gave content
 * (`relinkContentSession`), applied to message templates from the cohort
 * workspace's session view (2026-09-19). Reads the template's own current
 * wording first so the caller only has to name the template and the new
 * session, not resupply the body `updateTemplate` otherwise requires.
 */
export async function relinkTemplateSession(params: {
  studyId: string;
  templateId: string;
  actorId: string;
  sessionTemplateId: string;
}): Promise<void> {
  const { studyId, templateId, actorId, sessionTemplateId } = params;

  const current = await getTemplate(studyId, templateId);
  if (!current) throw new NotFoundError("template", templateId);

  await updateTemplate({
    studyId,
    templateId,
    actorId,
    nameEs: current.nameEs,
    bodyEs: current.bodyEs,
    bodyEn: current.bodyEn,
    sessionTemplateId,
    active: current.active,
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
  target: SendTarget;
  templateId: string;
  actorId: string;
  status?: "SENT" | "SKIPPED";
  skipReason?: string | null;
}): Promise<string> {
  const { studyId, target, templateId, actorId } = params;
  const status = params.status ?? "SENT";
  const skipReason = status === "SKIPPED" ? params.skipReason?.trim().slice(0, 280) || null : null;

  return getDb().transaction(async (tx) => {
    // One subject, resolved here so the row cannot name a participant and a
    // cohort at once — the database refuses that too, but a clear error beats a
    // constraint violation.
    let subjectLabel: string;
    if (target.kind === "PARTICIPANT") {
      const [participant] = await tx
        .select({ id: participants.id, code: participants.code })
        .from(participants)
        .where(and(eq(participants.id, target.participantId), eq(participants.studyId, studyId)))
        .limit(1);
      if (!participant) throw new NotFoundError("participant", target.participantId);
      subjectLabel = participant.code;
    } else {
      const [cohort] = await tx
        .select({ id: cohorts.id, code: cohorts.code })
        .from(cohorts)
        .where(and(eq(cohorts.id, target.cohortId), eq(cohorts.studyId, studyId)))
        .limit(1);
      if (!cohort) throw new NotFoundError("cohort", target.cohortId);
      subjectLabel = cohort.code;
    }

    const [template] = await tx
      .select({
        id: communicationTemplates.id,
        key: communicationTemplates.key,
        stage: communicationTemplates.stage,
        channel: communicationTemplates.channel,
        bodyEs: communicationTemplates.bodyEs,
        version: communicationTemplates.version,
        audience: communicationTemplates.audience,
      })
      .from(communicationTemplates)
      .where(
        and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.studyId, studyId)),
      )
      .limit(1);
    if (!template) throw new NotFoundError("template", templateId);

    // A channel template must be recorded against a cohort, and a personal one
    // against a person. Mismatching them would make the log say something that
    // did not happen.
    if (template.audience !== (target.kind === "PARTICIPANT" ? "PARTICIPANT" : "COHORT_CHANNEL")) {
      throw new ConflictError("audienceMismatch");
    }

    const [created] = await tx
      .insert(communications)
      .values({
        studyId,
        participantId: target.kind === "PARTICIPANT" ? target.participantId : null,
        cohortId: target.kind === "COHORT_CHANNEL" ? target.cohortId : null,
        audience: template.audience,
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
        subject: subjectLabel,
        audience: template.audience,
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
