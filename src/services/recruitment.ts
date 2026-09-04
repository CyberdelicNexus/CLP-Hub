import "server-only";
import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb, type DbExecutor } from "@/db/client";
import {
  applicationAnswers,
  applicationQuestions,
  applications,
  participantContacts,
  participants,
  studies,
  type Application,
  type ApplicationQuestion,
  type QuestionOption,
} from "@/db/schema";
import { extractContact, type AnswerValue, type FormQuestion } from "@/domain/application-form";
import type { Locale } from "@/domain/locale";
import {
  canTransitionApplication,
  formatParticipantCode,
  normalizeEmail,
  recruitmentStatusForApplication,
  type ApplicationStatus,
} from "@/domain/recruitment";

/**
 * Recruitment operations (Phase 1).
 *
 * Every write runs in one transaction together with its audit row. Nothing here
 * evaluates eligibility or transitions a participant automatically beyond the
 * funnel status implied by an explicit staff action.
 */

/** Repeat submissions inside this window return the existing application. */
const DUPLICATE_SUBMISSION_WINDOW_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The study currently accepting public applications.
 *
 * Recruitment is open only when the study is ACTIVE, `recruitment_open` is set,
 * and today falls inside the configured window. Returns null when no study
 * qualifies, or when more than one does — an ambiguous public form is a
 * configuration error, not something to guess at.
 */
export async function getOpenRecruitmentStudy(): Promise<{
  id: string;
  code: string;
  title: string;
  defaultLocale: Locale;
} | null> {
  const rows = await getDb()
    .select({
      id: studies.id,
      code: studies.code,
      title: studies.title,
      defaultLocale: studies.defaultLocale,
    })
    .from(studies)
    .where(
      and(
        eq(studies.status, "ACTIVE"),
        eq(studies.recruitmentOpen, true),
        sql`(${studies.recruitmentStart} is null or ${studies.recruitmentStart} <= current_date)`,
        sql`(${studies.recruitmentEnd} is null or ${studies.recruitmentEnd} >= current_date)`,
      ),
    )
    .limit(2);

  return rows.length === 1 ? rows[0] : null;
}

export async function getActiveQuestions(studyId: string): Promise<ApplicationQuestion[]> {
  return getDb()
    .select()
    .from(applicationQuestions)
    .where(and(eq(applicationQuestions.studyId, studyId), eq(applicationQuestions.active, true)))
    .orderBy(asc(applicationQuestions.position), asc(applicationQuestions.key));
}

export interface ApplicationListRow {
  id: string;
  status: ApplicationStatus;
  source: string;
  submittedAt: Date;
  participantId: string;
  participantCode: string;
  /** Only populated when the caller holds participants.contact.read. */
  fullName: string | null;
  email: string | null;
}

/**
 * Applications for a study, newest first.
 *
 * `includeContact` must reflect the caller's `participants.contact.read`
 * permission: when false the contact columns are never selected, so Category A
 * data does not travel to a screen that is not allowed to show it.
 */
export async function listApplications(
  studyId: string,
  options: { includeContact: boolean; status?: ApplicationStatus; limit?: number },
): Promise<ApplicationListRow[]> {
  const { includeContact, status, limit = 100 } = options;

  const rows = await getDb()
    .select({
      id: applications.id,
      status: applications.status,
      source: applications.source,
      submittedAt: applications.submittedAt,
      participantId: participants.id,
      participantCode: participants.code,
      fullName: includeContact ? participantContacts.fullName : sql<null>`null`,
      email: includeContact ? participantContacts.email : sql<null>`null`,
    })
    .from(applications)
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
    .where(
      status
        ? and(eq(applications.studyId, studyId), eq(applications.status, status))
        : eq(applications.studyId, studyId),
    )
    .orderBy(desc(applications.submittedAt))
    .limit(limit);

  return rows as ApplicationListRow[];
}

export async function countApplicationsByStatus(
  studyId: string,
): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ status: applications.status, total: count() })
    .from(applications)
    .where(eq(applications.studyId, studyId))
    .groupBy(applications.status);

  return Object.fromEntries(rows.map((r) => [r.status, Number(r.total)]));
}

export interface ApplicationDetail {
  application: Application;
  participant: { id: string; code: string; recruitmentStatus: string };
  contact: { fullName: string | null; email: string | null; phone: string | null } | null;
  answers: {
    questionId: string;
    key: string;
    labelEs: string;
    labelEn: string | null;
    /** Option list, so a stored choice value can be shown with its label. */
    options: QuestionOption[] | null;
    value: AnswerValue;
  }[];
}

export async function getApplicationDetail(
  studyId: string,
  applicationId: string,
  options: { includeContact: boolean },
): Promise<ApplicationDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({
      application: applications,
      participantId: participants.id,
      participantCode: participants.code,
      recruitmentStatus: participants.recruitmentStatus,
    })
    .from(applications)
    .innerJoin(participants, eq(participants.id, applications.participantId))
    .where(and(eq(applications.id, applicationId), eq(applications.studyId, studyId)))
    .limit(1);

  if (!row) return null;

  const answers = await db
    .select({
      questionId: applicationAnswers.questionId,
      key: applicationQuestions.key,
      labelEs: applicationQuestions.labelEs,
      labelEn: applicationQuestions.labelEn,
      options: applicationQuestions.options,
      value: applicationAnswers.value,
    })
    .from(applicationAnswers)
    .innerJoin(applicationQuestions, eq(applicationQuestions.id, applicationAnswers.questionId))
    .where(eq(applicationAnswers.applicationId, applicationId))
    .orderBy(asc(applicationQuestions.position));

  let contact: ApplicationDetail["contact"] = null;
  if (options.includeContact) {
    const [c] = await db
      .select({
        fullName: participantContacts.fullName,
        email: participantContacts.email,
        phone: participantContacts.phone,
      })
      .from(participantContacts)
      .where(eq(participantContacts.participantId, row.participantId))
      .limit(1);
    contact = c ?? null;
  }

  return {
    application: row.application,
    participant: {
      id: row.participantId,
      code: row.participantCode,
      recruitmentStatus: row.recruitmentStatus,
    },
    contact,
    answers,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface SubmitApplicationInput {
  studyId: string;
  locale: Locale;
  questions: readonly FormQuestion[];
  values: ReadonlyMap<string, AnswerValue>;
}

export interface SubmitApplicationResult {
  applicationId: string;
  participantCode: string;
  /** True when an identical submission inside the dedupe window was returned. */
  deduplicated: boolean;
}

/**
 * Record a public application.
 *
 * The actor is the participant, not a staff member, so the audit row carries
 * actor_type PARTICIPANT. Duplicate handling follows D-013: within one study a
 * repeat email attaches a new application to the existing participant rather
 * than creating a second person.
 */
export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<SubmitApplicationResult> {
  const { studyId, locale, questions, values } = input;
  const contact = extractContact(questions, values);
  const emailNormalized = contact.email ? normalizeEmail(contact.email) : null;

  return getDb().transaction(async (tx) => {
    const existing = emailNormalized
      ? await findParticipantByEmail(tx, studyId, emailNormalized)
      : null;

    let participantId: string;
    let participantCode: string;

    if (existing) {
      participantId = existing.id;
      participantCode = existing.code;

      // Collapse double submits (impatient clicking, a retried request) instead
      // of creating a second application for the same person.
      const [recent] = await tx
        .select({ id: applications.id })
        .from(applications)
        .where(
          and(
            eq(applications.participantId, participantId),
            gt(
              applications.submittedAt,
              new Date(Date.now() - DUPLICATE_SUBMISSION_WINDOW_MS),
            ),
          ),
        )
        .limit(1);

      if (recent) {
        return { applicationId: recent.id, participantCode, deduplicated: true };
      }

      // Refresh contact details from the newer submission.
      await tx
        .update(participantContacts)
        .set({
          fullName: contact.fullName ?? null,
          email: contact.email ?? null,
          emailNormalized,
          phone: contact.phone ?? null,
        })
        .where(eq(participantContacts.participantId, participantId));
    } else {
      const [{ nextval }] = await tx.execute<{ nextval: string }>(
        sql`select nextval('participant_code_seq') as nextval`,
      );
      participantCode = formatParticipantCode(Number(nextval));

      const [created] = await tx
        .insert(participants)
        .values({ studyId, code: participantCode, locale, recruitmentStatus: "INTERESTED" })
        .returning({ id: participants.id });
      participantId = created.id;

      await tx.insert(participantContacts).values({
        participantId,
        studyId,
        fullName: contact.fullName ?? null,
        email: contact.email ?? null,
        emailNormalized,
        phone: contact.phone ?? null,
      });

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "PARTICIPANT", id: participantId },
        action: "participant.created",
        entityType: "participant",
        entityId: participantId,
        // Identify by code, not by contact details: audit snapshots are read
        // under audit.read and should not widen PII exposure unnecessarily.
        after: { code: participantCode, recruitmentStatus: "INTERESTED", source: "PUBLIC_FORM" },
      });
    }

    const [application] = await tx
      .insert(applications)
      .values({ studyId, participantId, locale, status: "SUBMITTED", source: "PUBLIC_FORM" })
      .returning({ id: applications.id });

    if (values.size > 0) {
      await tx.insert(applicationAnswers).values(
        [...values].map(([questionId, value]) => ({
          applicationId: application.id,
          questionId,
          value,
        })),
      );
    }

    const nextStatus = recruitmentStatusForApplication("SUBMITTED");
    if (nextStatus) {
      await tx
        .update(participants)
        .set({ recruitmentStatus: nextStatus })
        .where(eq(participants.id, participantId));
    }

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "PARTICIPANT", id: participantId },
      action: "application.submitted",
      entityType: "application",
      entityId: application.id,
      // Answer content is deliberately not snapshotted here: it would duplicate
      // free-text into the audit log, which is read under a different permission.
      after: {
        status: "SUBMITTED",
        source: "PUBLIC_FORM",
        participantCode,
        answerCount: values.size,
      },
    });

    return { applicationId: application.id, participantCode, deduplicated: false };
  });
}

export class InvalidTransitionError extends Error {
  constructor(from: ApplicationStatus, to: ApplicationStatus) {
    super(`Cannot move an application from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Staff triage. The caller must already have asserted applications.manage.
 * Advancing the application also advances the participant's funnel status when
 * the vocabulary implies one — inside the same transaction, with its own audit row.
 */
export async function setApplicationStatus(params: {
  studyId: string;
  applicationId: string;
  actorId: string;
  status: ApplicationStatus;
}): Promise<void> {
  const { studyId, applicationId, actorId, status } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: applications.id,
        status: applications.status,
        participantId: applications.participantId,
        recruitmentStatus: participants.recruitmentStatus,
      })
      .from(applications)
      .innerJoin(participants, eq(participants.id, applications.participantId))
      .where(and(eq(applications.id, applicationId), eq(applications.studyId, studyId)))
      .limit(1);

    if (!current) throw new Error(`Application ${applicationId} not found in study ${studyId}`);
    if (current.status === status) return;
    if (!canTransitionApplication(current.status, status)) {
      throw new InvalidTransitionError(current.status, status);
    }

    await tx.update(applications).set({ status }).where(eq(applications.id, applicationId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "application.status_changed",
      entityType: "application",
      entityId: applicationId,
      before: { status: current.status },
      after: { status },
    });

    const nextRecruitment = recruitmentStatusForApplication(status);
    if (nextRecruitment && nextRecruitment !== current.recruitmentStatus) {
      await tx
        .update(participants)
        .set({ recruitmentStatus: nextRecruitment })
        .where(eq(participants.id, current.participantId));

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "participant.recruitment_status_changed",
        entityType: "participant",
        entityId: current.participantId,
        before: { recruitmentStatus: current.recruitmentStatus },
        after: { recruitmentStatus: nextRecruitment },
        metadata: { via: "application", applicationId },
      });
    }
  });
}

async function findParticipantByEmail(
  executor: DbExecutor,
  studyId: string,
  emailNormalized: string,
): Promise<{ id: string; code: string } | null> {
  const [row] = await executor
    .select({ id: participants.id, code: participants.code })
    .from(participantContacts)
    .innerJoin(participants, eq(participants.id, participantContacts.participantId))
    .where(
      and(
        eq(participantContacts.studyId, studyId),
        eq(participantContacts.emailNormalized, emailNormalized),
      ),
    )
    .limit(1);
  return row ?? null;
}
