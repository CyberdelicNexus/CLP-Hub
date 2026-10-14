import "server-only";
import { and, eq } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import { communications, participantContacts, participants, studies } from "@/db/schema";
import { automaticTemplateProblem } from "@/domain/automation";
import {
  renderTemplate,
  type CommunicationAudience,
  type CommunicationChannel,
  type CommunicationStage,
} from "@/domain/communication";
import { suggestValues } from "./communications";
import { isMailConfigured, sendMail } from "./mailer";

/**
 * The AUTOMATIC email path (D-116). The one place a rule-driven action reaches
 * a person's inbox without someone pressing "send".
 *
 * What it will do, and nothing more:
 *
 * - Send an EMAIL template addressed to ONE participant, to that participant's
 *   own address, one email per person. Never WhatsApp, never a group email.
 * - Render only the variables that are always known (`AUTOMATIC_VARIABLES`).
 *   A template that needs a date or a link carries it in its own wording; a
 *   value that turns out to be missing stops that recipient, it is never sent
 *   as `⟨fecha⟩`.
 * - Record each email that went out as a `communications` row (template body
 *   with placeholders intact, never the rendered text, D-039), with an audit
 *   row whose actor is SYSTEM. There is no `sentBy`: nobody sent it.
 *
 * It never retries. A recipient that failed is reported back so the processor
 * can raise an alert and a person can decide; sending the batch again would
 * email everyone who already received it.
 */

export interface AutomaticTemplate {
  id: string;
  key: string;
  nameEs: string;
  bodyEs: string;
  version: number;
  stage: CommunicationStage;
  channel: CommunicationChannel;
  audience: CommunicationAudience;
}

export type RecipientFailure = "noEmail" | "missingValues" | "rejected" | "network" | "notFound";

export type DeliveryResult =
  /** No sender configured. Nothing was attempted and nothing was claimed. */
  | { kind: "notConfigured" }
  /** The template cannot be sent automatically. Nothing was attempted. */
  | { kind: "templateRefused"; problem: string }
  | {
      kind: "attempted";
      communicationIds: string[];
      failures: { participantCode: string; reason: RecipientFailure }[];
    };

export { isMailConfigured };

export async function deliverAutomaticEmail(params: {
  studyId: string;
  actionId: string;
  ruleKey: string;
  template: AutomaticTemplate;
  participantIds: readonly string[];
}): Promise<DeliveryResult> {
  const { studyId, actionId, ruleKey, template } = params;

  const problem = automaticTemplateProblem(template);
  if (problem) return { kind: "templateRefused", problem };
  if (!isMailConfigured()) return { kind: "notConfigured" };

  const db = getDb();
  const [study] = await db
    .select({ timezone: studies.timezone, contactEmail: studies.contactEmail })
    .from(studies)
    .where(eq(studies.id, studyId))
    .limit(1);

  const communicationIds: string[] = [];
  const failures: { participantCode: string; reason: RecipientFailure }[] = [];

  for (const participantId of params.participantIds) {
    const [person] = await db
      .select({ code: participants.code, email: participantContacts.email })
      .from(participants)
      .leftJoin(participantContacts, eq(participantContacts.participantId, participants.id))
      .where(and(eq(participants.id, participantId), eq(participants.studyId, studyId)))
      .limit(1);
    if (!person) {
      failures.push({ participantCode: "?", reason: "notFound" });
      continue;
    }
    if (!person.email) {
      failures.push({ participantCode: person.code, reason: "noEmail" });
      continue;
    }

    // The values are gathered and rendered in memory and never written down.
    const values = await suggestValues(studyId, participantId, {
      includeContact: true,
      timezone: study?.timezone ?? "Europe/Madrid",
    });
    const rendered = renderTemplate(template.bodyEs, values, { canReadContact: true });
    if (rendered.missing.length > 0) {
      failures.push({ participantCode: person.code, reason: "missingValues" });
      continue;
    }

    const sent = await sendMail({
      to: [person.email],
      subject: template.nameEs,
      text: rendered.text,
      replyTo: study?.contactEmail ?? undefined,
      idempotencyKey: `action-${actionId}-${participantId}`,
    });
    if (!sent.ok) {
      failures.push({
        participantCode: person.code,
        reason: sent.reason === "not_configured" ? "rejected" : sent.reason,
      });
      continue;
    }

    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(communications)
        .values({
          studyId,
          participantId,
          cohortId: null,
          audience: "PARTICIPANT",
          templateId: template.id,
          templateVersion: template.version,
          templateBody: template.bodyEs,
          stage: template.stage,
          channel: template.channel,
          status: "SENT",
          sentBy: null,
        })
        .returning({ id: communications.id });

      await recordAuditEvent(tx, {
        studyId,
        actor: { type: "SYSTEM" },
        action: "communication.sent_automatically",
        entityType: "communication",
        entityId: created.id,
        after: {
          subject: person.code,
          templateKey: template.key,
          templateVersion: template.version,
          channel: template.channel,
          ruleKey,
          scheduledActionId: actionId,
        },
      });
      return created.id;
    });
    communicationIds.push(id);
  }

  return { kind: "attempted", communicationIds, failures };
}
