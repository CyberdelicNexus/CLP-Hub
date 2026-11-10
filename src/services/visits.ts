import "server-only";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import {
  cohorts,
  participantCohortAssignments,
  participants,
  participantVisits,
  sessionTemplates,
  type ParticipantVisit,
} from "@/db/schema";
import { syncInitialVisit } from "./participant-care";
import { NotFoundError } from "./sessions";

/**
 * Individual visits (2026-10-28, D-136): a date per participant for a session
 * template whose `attendance` is INDIVIDUAL — S0's home visit and the POST
 * pickup in this study.
 *
 * A visit is a plan, not a hand-over: setting the S0 date does not move a
 * headset. The device's own milestones stay on `device_assignments`, recorded
 * by a person, and the logistics screen reads both side by side.
 */

export class VisitNotAllowedError extends Error {
  readonly reason: "notIndividual" | "notMember" | "notBooked" | "notConfigured" | "hasRecord";
  constructor(reason: VisitNotAllowedError["reason"]) {
    super(reason);
    this.name = "VisitNotAllowedError";
    this.reason = reason;
  }
}

/** Every visit planned for a cohort's members, keyed by participant then template. */
export async function listCohortVisits(
  studyId: string,
  cohortId: string,
): Promise<ParticipantVisit[]> {
  return getDb()
    .select()
    .from(participantVisits)
    .where(and(eq(participantVisits.studyId, studyId), eq(participantVisits.cohortId, cohortId)))
    .orderBy(asc(participantVisits.scheduledAt));
}

/** Visits for a set of participants (the logistics screen's allocation table). */
export async function listVisitsFor(
  studyId: string,
  participantIds: readonly string[],
): Promise<(ParticipantVisit & { deviceHandoff: string })[]> {
  if (participantIds.length === 0) return [];
  const rows = await getDb()
    .select({ visit: participantVisits, deviceHandoff: sessionTemplates.deviceHandoff })
    .from(participantVisits)
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, participantVisits.templateId))
    .where(
      and(
        eq(participantVisits.studyId, studyId),
        inArray(participantVisits.participantId, [...participantIds]),
      ),
    );
  return rows.map((r) => ({ ...r.visit, deviceHandoff: r.deviceHandoff }));
}

/** The individual sessions a headset changes hands at, in programme order. */
export async function listHandoffTemplates(studyId: string) {
  return getDb()
    .select({
      id: sessionTemplates.id,
      code: sessionTemplates.code,
      deviceHandoff: sessionTemplates.deviceHandoff,
    })
    .from(sessionTemplates)
    .where(
      and(
        eq(sessionTemplates.studyId, studyId),
        eq(sessionTemplates.attendance, "INDIVIDUAL"),
        eq(sessionTemplates.active, true),
        ne(sessionTemplates.deviceHandoff, "NONE"),
      ),
    )
    .orderBy(asc(sessionTemplates.position));
}

/**
 * Set, move or clear one participant's visit. `scheduledAt: null` clears it.
 * Only for an INDIVIDUAL template, and only for a current member of the cohort.
 * `handoffOnly` is the logistics screen's way in (D-143): it may book the visits
 * a headset changes hands at, and no other.
 */
export async function setParticipantVisit(params: {
  studyId: string;
  cohortId: string;
  participantId: string;
  templateId: string;
  actorId: string;
  scheduledAt: Date | null;
  handoffOnly?: boolean;
}): Promise<void> {
  const { studyId, cohortId, participantId, templateId, actorId, scheduledAt, handoffOnly } = params;

  await getDb().transaction(async (tx) => {
    const [template] = await tx
      .select({
        id: sessionTemplates.id,
        code: sessionTemplates.code,
        attendance: sessionTemplates.attendance,
        deviceHandoff: sessionTemplates.deviceHandoff,
        visitChecks: sessionTemplates.visitChecks,
      })
      .from(sessionTemplates)
      .where(and(eq(sessionTemplates.id, templateId), eq(sessionTemplates.studyId, studyId)))
      .limit(1);
    if (!template) throw new NotFoundError("session template", templateId);
    if (template.attendance !== "INDIVIDUAL") throw new VisitNotAllowedError("notIndividual");
    if (handoffOnly && template.deviceHandoff === "NONE") throw new VisitNotAllowedError("notConfigured");

    const [cohort] = await tx
      .select({ id: cohorts.id })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);

    const [member] = await tx
      .select({ code: participants.code })
      .from(participantCohortAssignments)
      .innerJoin(participants, eq(participants.id, participantCohortAssignments.participantId))
      .where(
        and(
          eq(participantCohortAssignments.cohortId, cohortId),
          eq(participantCohortAssignments.participantId, participantId),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1);
    if (!member) throw new VisitNotAllowedError("notMember");

    // The card's date IS the initial visit's date, for the session configured
    // as that visit (D-140).
    const syncVisit = (date: Date | null) =>
      template.visitChecks.includes("INITIAL_VISIT")
        ? syncInitialVisit(tx, {
            studyId,
            participantId,
            participantCode: member.code,
            actorId,
            scheduledAt: date,
          })
        : Promise.resolve();

    const [current] = await tx
      .select()
      .from(participantVisits)
      .where(and(eq(participantVisits.participantId, participantId), eq(participantVisits.templateId, templateId)))
      .limit(1);

    if (!scheduledAt) {
      if (!current) return;
      // The visit's row holds that record, so clearing the date would lose it.
      if (current.questionnaireCapturedAt) throw new VisitNotAllowedError("hasRecord");
      await tx.delete(participantVisits).where(eq(participantVisits.id, current.id));
      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "visit.cleared",
        entityType: "participant_visit",
        entityId: current.id,
        before: { scheduledAt: current.scheduledAt.toISOString() },
        after: { participantCode: member.code, templateCode: template.code },
      });
      await syncVisit(null);
      return;
    }

    if (current) {
      if (current.scheduledAt.getTime() === scheduledAt.getTime() && current.cohortId === cohortId) return;
      await tx
        .update(participantVisits)
        .set({ scheduledAt, cohortId, updatedAt: new Date() })
        .where(eq(participantVisits.id, current.id));
      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "visit.rescheduled",
        entityType: "participant_visit",
        entityId: current.id,
        before: { scheduledAt: current.scheduledAt.toISOString() },
        after: { scheduledAt: scheduledAt.toISOString(), participantCode: member.code, templateCode: template.code },
      });
      await syncVisit(scheduledAt);
      return;
    }

    const [created] = await tx
      .insert(participantVisits)
      .values({ studyId, cohortId, participantId, templateId, scheduledAt, createdBy: actorId })
      .returning({ id: participantVisits.id });
    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "visit.scheduled",
      entityType: "participant_visit",
      entityId: created.id,
      after: { scheduledAt: scheduledAt.toISOString(), participantCode: member.code, templateCode: template.code },
    });
    await syncVisit(scheduledAt);
  });
}

/**
 * Tick or untick that the questionnaire was filled in at this visit (D-139).
 * Says THAT it was, never a single answer (rule 4), and needs a booked visit:
 * the record lives on it.
 */
export async function setVisitQuestionnaire(params: {
  studyId: string;
  participantId: string;
  templateId: string;
  actorId: string;
  captured: boolean;
}): Promise<void> {
  const { studyId, participantId, templateId, actorId, captured } = params;

  await getDb().transaction(async (tx) => {
    const [template] = await tx
      .select({ code: sessionTemplates.code, visitChecks: sessionTemplates.visitChecks })
      .from(sessionTemplates)
      .where(and(eq(sessionTemplates.id, templateId), eq(sessionTemplates.studyId, studyId)))
      .limit(1);
    if (!template) throw new NotFoundError("session template", templateId);
    if (!template.visitChecks.includes("QUESTIONNAIRE")) throw new VisitNotAllowedError("notConfigured");

    const [visit] = await tx
      .select({
        id: participantVisits.id,
        capturedAt: participantVisits.questionnaireCapturedAt,
        participantCode: participants.code,
      })
      .from(participantVisits)
      .innerJoin(participants, eq(participants.id, participantVisits.participantId))
      .where(
        and(
          eq(participantVisits.studyId, studyId),
          eq(participantVisits.participantId, participantId),
          eq(participantVisits.templateId, templateId),
        ),
      )
      .limit(1);
    if (!visit) throw new VisitNotAllowedError("notBooked");
    if (Boolean(visit.capturedAt) === captured) return;

    const now = new Date();
    await tx
      .update(participantVisits)
      .set({
        questionnaireCapturedAt: captured ? now : null,
        questionnaireCapturedBy: captured ? actorId : null,
        updatedAt: now,
      })
      .where(eq(participantVisits.id, visit.id));
    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: captured ? "visit.questionnaire_recorded" : "visit.questionnaire_cleared",
      entityType: "participant_visit",
      entityId: visit.id,
      before: { questionnaireCapturedAt: visit.capturedAt?.toISOString() ?? null },
      after: {
        questionnaireCapturedAt: captured ? now.toISOString() : null,
        participantCode: visit.participantCode,
        templateCode: template.code,
      },
    });
  });
}
