import "server-only";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import {
  cohortPlannedMessages,
  cohorts,
  communicationTemplates,
  participantCohortAssignments,
  type CohortPlannedMessage,
} from "@/db/schema";
import { automaticTemplateProblem } from "@/domain/automation";
import type { CommunicationAudience, CommunicationChannel } from "@/domain/communication";
import { raiseAlert } from "./automation";
import { deliverAutomaticEmail, isMailConfigured } from "./email-delivery";
import { NotFoundError } from "./sessions";

/**
 * A cohort's message plan (2026-10-28, D-136) — the control group's
 * template. That cohort has no sessions, so its messages are dated on the
 * cohort itself while it is being set up.
 *
 * Two kinds of entry, decided by the template and never by the cohort's arm:
 *
 * - AUTOMATIC: an EMAIL template D-116 allows to send unattended
 *   (`automaticTemplateProblem` is null). The processor sends it at `sendAt`,
 *   one email per current member, through `deliverAutomaticEmail` — the same
 *   single path to an inbox, the same SYSTEM-actor audit rows, the same
 *   "never retried; a failure raises EMAIL_NOT_SENT" rule.
 * - MANUAL: anything else (a WhatsApp reminder, an email that still has a
 *   `{{enlace}}` to fill in). A dated reminder with the text to copy; nothing
 *   sends it, and the processor never touches it.
 */

export interface PlanEntry {
  id: string;
  sendAt: Date;
  status: CohortPlannedMessage["status"];
  processedAt: Date | null;
  template: {
    id: string;
    nameEs: string;
    bodyEs: string;
    channel: CommunicationChannel;
    audience: CommunicationAudience;
  };
  /** Null when it will send on its own; otherwise why it is copy-only. */
  manualReason: ReturnType<typeof automaticTemplateProblem>;
}

export class PlanLockedError extends Error {
  constructor() {
    super("planned message already processed");
    this.name = "PlanLockedError";
  }
}

export async function listCohortPlan(studyId: string, cohortId: string): Promise<PlanEntry[]> {
  const rows = await getDb()
    .select({ plan: cohortPlannedMessages, template: communicationTemplates })
    .from(cohortPlannedMessages)
    .innerJoin(communicationTemplates, eq(communicationTemplates.id, cohortPlannedMessages.templateId))
    .where(and(eq(cohortPlannedMessages.studyId, studyId), eq(cohortPlannedMessages.cohortId, cohortId)))
    .orderBy(asc(cohortPlannedMessages.sendAt));

  return rows.map(({ plan, template }) => ({
    id: plan.id,
    sendAt: plan.sendAt,
    status: plan.status,
    processedAt: plan.processedAt,
    template: {
      id: template.id,
      nameEs: template.nameEs,
      bodyEs: template.bodyEs,
      channel: template.channel,
      audience: template.audience,
    },
    manualReason: automaticTemplateProblem(template),
  }));
}

/**
 * Add a template to the plan, move its date, or (`sendAt: null`) take it off.
 * Only while it is still PLANNED: once the processor has sent it, the record
 * of what went out stays as it is.
 */
export async function setPlannedMessage(params: {
  studyId: string;
  cohortId: string;
  templateId: string;
  actorId: string;
  sendAt: Date | null;
}): Promise<void> {
  const { studyId, cohortId, templateId, actorId, sendAt } = params;

  await getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select({ code: cohorts.code })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);

    const [template] = await tx
      .select({ key: communicationTemplates.key })
      .from(communicationTemplates)
      .where(and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.studyId, studyId)))
      .limit(1);
    if (!template) throw new NotFoundError("communication template", templateId);

    const [current] = await tx
      .select()
      .from(cohortPlannedMessages)
      .where(and(eq(cohortPlannedMessages.cohortId, cohortId), eq(cohortPlannedMessages.templateId, templateId)))
      .limit(1);
    if (current && current.status !== "PLANNED") throw new PlanLockedError();

    const audit = { cohortCode: cohort.code, templateKey: template.key };

    if (!sendAt) {
      if (!current) return;
      await tx.delete(cohortPlannedMessages).where(eq(cohortPlannedMessages.id, current.id));
      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "cohort_plan.removed",
        entityType: "cohort_planned_message",
        entityId: current.id,
        before: { sendAt: current.sendAt.toISOString() },
        after: audit,
      });
      return;
    }

    if (current) {
      if (current.sendAt.getTime() === sendAt.getTime()) return;
      await tx
        .update(cohortPlannedMessages)
        .set({ sendAt, updatedAt: new Date() })
        .where(eq(cohortPlannedMessages.id, current.id));
      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "STAFF", id: actorId },
        action: "cohort_plan.rescheduled",
        entityType: "cohort_planned_message",
        entityId: current.id,
        before: { sendAt: current.sendAt.toISOString() },
        after: { sendAt: sendAt.toISOString(), ...audit },
      });
      return;
    }

    const [created] = await tx
      .insert(cohortPlannedMessages)
      .values({ studyId, cohortId, templateId, sendAt, createdBy: actorId })
      .returning({ id: cohortPlannedMessages.id });
    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort_plan.added",
      entityType: "cohort_planned_message",
      entityId: created.id,
      after: { sendAt: sendAt.toISOString(), ...audit },
    });
  });
}

/**
 * Send every AUTOMATIC plan entry that has come due. Called by the scheduled
 * processor, once per active study. MANUAL entries are left alone.
 *
 * With no sender configured nothing is claimed, so the entry goes out
 * (visibly late) once mail works — the processor's existing rule.
 */
export async function processDuePlannedMessages(params: {
  studyId: string;
  now: Date;
  limit: number;
}): Promise<{ sent: number; failed: number }> {
  const { studyId, now, limit } = params;
  if (!isMailConfigured()) return { sent: 0, failed: 0 };

  const db = getDb();
  const due = await db
    .select({ plan: cohortPlannedMessages, template: communicationTemplates })
    .from(cohortPlannedMessages)
    .innerJoin(communicationTemplates, eq(communicationTemplates.id, cohortPlannedMessages.templateId))
    .where(
      and(
        eq(cohortPlannedMessages.studyId, studyId),
        eq(cohortPlannedMessages.status, "PLANNED"),
        isNull(cohortPlannedMessages.processedAt),
        lte(cohortPlannedMessages.sendAt, now),
      ),
    )
    .orderBy(asc(cohortPlannedMessages.sendAt))
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const { plan, template } of due) {
    // Re-checked as the template is NOW: edited to WhatsApp, or given a
    // `{{enlace}}`, since it was planned → it is simply a reminder again.
    if (automaticTemplateProblem(template) || !template.active) continue;

    // Claim it first, so an overlapping run cannot send it twice.
    const [claimed] = await db
      .update(cohortPlannedMessages)
      .set({ processedAt: now, updatedAt: now })
      .where(and(eq(cohortPlannedMessages.id, plan.id), isNull(cohortPlannedMessages.processedAt)))
      .returning({ id: cohortPlannedMessages.id });
    if (!claimed) continue;

    const members = await db
      .select({ participantId: participantCohortAssignments.participantId })
      .from(participantCohortAssignments)
      .where(
        and(eq(participantCohortAssignments.cohortId, plan.cohortId), isNull(participantCohortAssignments.removedAt)),
      );

    const result = await deliverAutomaticEmail({
      studyId,
      actionId: plan.id,
      ruleKey: "cohort-plan",
      template,
      participantIds: members.map((m) => m.participantId),
    });

    const failures = result.kind === "attempted" ? result.failures : [];
    const delivered = result.kind === "attempted" ? result.communicationIds.length : 0;
    const status = failures.length === 0 && result.kind === "attempted"
      ? "SENT"
      : delivered > 0
        ? "PARTIAL"
        : "FAILED";

    await db
      .update(cohortPlannedMessages)
      .set({ status, updatedAt: new Date() })
      .where(eq(cohortPlannedMessages.id, plan.id));

    sent += delivered;
    failed += failures.length;

    if (status !== "SENT") {
      await raiseAlert({
        studyId,
        kind: "EMAIL_NOT_SENT",
        subject: { kind: "COHORT", id: plan.cohortId },
        // Codes and a reason vocabulary only, never an address.
        detail: `cohort-plan ${template.key}: ${
          failures.length > 0
            ? failures.map((f) => `${f.participantCode} (${f.reason})`).join(", ")
            : result.kind
        }`,
        refreshDetail: true,
        now,
      });
    }
  }

  return { sent, failed };
}
