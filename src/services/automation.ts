import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb, type DbExecutor } from "@/db/client";
import {
  alerts,
  automationRules,
  cohortSessions,
  cohorts,
  communicationTemplates,
  consents,
  deviceAssignments,
  devices,
  participantCohortAssignments,
  participants,
  scheduledActions,
  screenings,
  sessionAttendance,
  sessionTemplates,
  studyArms,
  studyEvents,
  tasks,
  users,
  type Alert,
  type AutomationRule,
  type CommunicationTemplate,
  type ScheduledAction,
  type Task,
} from "@/db/schema";
import {
  alertDedupeKey,
  automaticTemplateProblem,
  decide,
  isDeliveryModeAvailable,
  invalidatesPriorSchedule,
  parseConditions,
  resolveScope,
  sessionScopeMatches,
  scheduledFor as computeScheduledFor,
  severityFor,
  SKIP_REASON_MAX_LENGTH,
  TASK_DETAIL_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  type ActionKind,
  type AlertKind,
  type ConditionFacts,
  type DeliveryMode,
  type EventType,
  type RuleConditions,
  type ScopeCohort,
  type SubjectKind,
  type TaskPriority,
} from "@/domain/automation";
import { assessCohortSize } from "@/domain/cohort";
import { deliverAutomaticEmail, isMailConfigured } from "./email-delivery";

/**
 * Automation (Phase 8): events in, scheduled work out.
 *
 * There is no HTTP client, credential or endpoint in this file, and
 * `tests/automation.test.ts` asserts it. A MANUAL action stops at READY,
 * waiting for a person (D-004, D-039, D-043). An AUTOMATIC one, which D-116
 * allows for email only, is handed to `email-delivery.ts`, the single place a
 * rule reaches an inbox.
 *
 * Three rules the code here keeps, each of which is a decision someone could
 * otherwise undo by accident:
 *
 * 1. **The go/no-go is taken when the action is due.** `snapshotJson` is written
 *    at materialisation for traceability and is never read for the decision. A
 *    reminder planned on Monday for someone who withdrew on Tuesday is SKIPPED
 *    with the unmet condition named.
 * 2. **Rules are configuration.** No timing, threshold or template key appears
 *    in this file. It knows how to read a rule; it knows nothing about this
 *    trial (CLAUDE.md rule 6).
 * 3. **Conditions are a closed allow-list of operational predicates.** Facts are
 *    gathered in `gatherFacts`, which reads only yes/no operational columns —
 *    never an eligibility result, a consent scope, an arm or a screening note.
 */

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}

export class RuleError extends Error {
  readonly problem:
    | "unavailableDeliveryMode"
    | "invalidOffset"
    | "duplicateKey"
    | "shape"
    /** AUTOMATIC with a template that is not an individual email with safe variables. */
    | "automaticTemplate";
  constructor(problem: RuleError["problem"]) {
    super(problem);
    this.name = "RuleError";
    this.problem = problem;
  }
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

/** The thing an event, action, task or alert is about. */
export type Subject =
  | { kind: "PARTICIPANT"; id: string }
  | { kind: "COHORT"; id: string }
  | { kind: "SESSION"; id: string }
  | { kind: "DEVICE"; id: string }
  | { kind: "STUDY" };

/** Subject → the four nullable foreign keys every automation table carries. */
function subjectColumns(subject: Subject) {
  return {
    subjectKind: subject.kind as SubjectKind,
    participantId: subject.kind === "PARTICIPANT" ? subject.id : null,
    cohortId: subject.kind === "COHORT" ? subject.id : null,
    sessionId: subject.kind === "SESSION" ? subject.id : null,
    deviceId: subject.kind === "DEVICE" ? subject.id : null,
  };
}

function subjectOf(row: {
  subjectKind: SubjectKind;
  participantId: string | null;
  cohortId: string | null;
  sessionId: string | null;
  deviceId: string | null;
}): Subject {
  switch (row.subjectKind) {
    case "PARTICIPANT":
      return { kind: "PARTICIPANT", id: row.participantId as string };
    case "COHORT":
      return { kind: "COHORT", id: row.cohortId as string };
    case "SESSION":
      return { kind: "SESSION", id: row.sessionId as string };
    case "DEVICE":
      return { kind: "DEVICE", id: row.deviceId as string };
    default:
      return { kind: "STUDY" };
  }
}

// ---------------------------------------------------------------------------
// Recording an event
// ---------------------------------------------------------------------------

export interface StudyEventInput {
  studyId: string;
  eventType: EventType;
  subject: Subject;
  /**
   * What a rule's offset is measured from. Defaults to now.
   *
   * Pass the session's start for a session event, the visit's time for a visit
   * event. That is what lets one engine serve both "immediately after the
   * application" and "24 h before session 2" without either rule knowing which
   * kind it is.
   */
  anchorAt?: Date;
  occurredAt?: Date;
  /** Codes, ids and status names only. Never a name or a contact detail. */
  metadata?: Record<string, unknown> | null;
}

export interface EventResult {
  eventId: string;
  /** Actions materialised from matching rules. */
  scheduled: number;
  /** Open actions cancelled because this event invalidated them. */
  cancelled: number;
}

/**
 * Record that something happened, and schedule whatever the study's rules say
 * should follow.
 *
 * CALL THIS INSIDE THE TRANSACTION THAT MADE THE CHANGE. It takes a
 * `DbExecutor` for exactly that reason: a session marked HELD and the events it
 * triggers must commit together, or the schedule silently drifts from the
 * record it is supposed to follow.
 *
 * It is safe when a study has no rules at all — which is the normal state for
 * a study that has not configured any — and it never throws on a rule it cannot
 * use. A rule whose delivery mode is unavailable, or whose conditions contain
 * keys this version does not know, is skipped and reported, because one bad
 * configuration row must not stop a facilitator from recording attendance.
 */
export async function recordStudyEvent(
  executor: DbExecutor,
  input: StudyEventInput,
): Promise<EventResult> {
  const now = input.occurredAt ?? new Date();
  const anchorAt = input.anchorAt ?? now;
  const cols = subjectColumns(input.subject);

  const [event] = await executor
    .insert(studyEvents)
    .values({
      studyId: input.studyId,
      eventType: input.eventType,
      ...cols,
      occurredAt: now,
      anchorAt,
      metadata: input.metadata ?? null,
    })
    .returning({ id: studyEvents.id });

  // A rescheduled or cancelled session, or a withdrawal, does not edit the work
  // already planned against its subject — it cancels it and lets the new event
  // create new work. Editing in place would rewrite a row whose audit trail says
  // it was scheduled for a different time (docs/automations.md).
  let cancelled = 0;
  if (invalidatesPriorSchedule(input.eventType) && input.subject.kind !== "STUDY") {
    cancelled = await cancelOpenActionsFor(executor, input.studyId, input.subject);
  }

  const rules = await executor
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.studyId, input.studyId),
        eq(automationRules.eventType, input.eventType),
        eq(automationRules.active, true),
      ),
    )
    .orderBy(asc(automationRules.position), asc(automationRules.key));

  let scheduled = 0;
  // Read once, and only if some rule is scoped: most events match no scoped rule.
  let scope: ScopeContext | null = null;
  for (const rule of rules) {
    // A rule saved before a constraint existed, or edited by hand, must not stop
    // the transaction that is recording real work. Whether an AUTOMATIC message
    // is an email is checked when it comes due, against the template as it is then.
    if (rule.deliveryMode === "AUTOMATIC" && rule.actionKind !== "MESSAGE") continue;

    // Scoped rules (D-116): to one session template, to cohorts of one arm.
    let audienceCohortId: string | null = null;
    if (rule.armId || rule.sessionTemplateId) {
      scope ??= await loadScopeContext(executor, input.subject);
      if (!sessionScopeMatches(rule.sessionTemplateId, scope.sessionTemplateId)) continue;
      const resolved = resolveScope(rule.armId, scope.cohort, scope.partners);
      if (!resolved.applies) continue;
      audienceCohortId = resolved.audienceCohortId;
    }

    const inserted = await executor
      .insert(scheduledActions)
      .values({
        studyId: input.studyId,
        ruleId: rule.id,
        eventId: event.id,
        ...cols,
        audienceCohortId,
        actionKind: rule.actionKind,
        deliveryMode: rule.deliveryMode,
        scheduledFor: computeScheduledFor(anchorAt, rule.offsetMinutes),
        status: "PENDING",
        // Traceability only. Never read when the action comes due.
        snapshotJson: {
          ruleKey: rule.key,
          eventType: input.eventType,
          anchorAt: anchorAt.toISOString(),
          offsetMinutes: rule.offsetMinutes,
        },
      })
      // One action per (rule, event). Re-running the materialiser is free, which
      // is what makes an overlapping or retrying cron safe.
      .onConflictDoNothing()
      .returning({ id: scheduledActions.id });

    if (inserted.length > 0) scheduled += 1;
  }

  // ONE audit row per event, not one per action. The change that caused the
  // event is audited by its own service; this records what the automation did
  // about it, which is the part nobody was watching.
  await recordAuditEvent(executor, {
    studyId: input.studyId,
    actor: { type: "SYSTEM" },
    action: "study_event.recorded",
    entityType: "study_event",
    entityId: event.id,
    after: {
      eventType: input.eventType,
      subjectKind: input.subject.kind,
      anchorAt: anchorAt.toISOString(),
      scheduled,
      cancelled,
    },
  });

  return { eventId: event.id, scheduled, cancelled };
}

/** What a scoped rule reads about an event's subject. Configuration only. */
interface ScopeContext {
  cohort: ScopeCohort | null;
  partners: ScopeCohort[];
  sessionTemplateId: string | null;
}

/**
 * The cohort an event is about, the cohorts paired with it, and the session
 * template, for `resolveScope`. Reads cohort configuration (its arm, its pair),
 * never a participant's allocation.
 *
 * An event about one participant looks only at their own current cohort: a
 * rule for the control arm must not fire because someone in the programme
 * cohort did something.
 */
async function loadScopeContext(executor: DbExecutor, subject: Subject): Promise<ScopeContext> {
  let cohortId: string | null = null;
  let sessionTemplateId: string | null = null;
  const withPartners = subject.kind !== "PARTICIPANT";

  if (subject.kind === "SESSION") {
    const [session] = await executor
      .select({ cohortId: cohortSessions.cohortId, templateId: cohortSessions.templateId })
      .from(cohortSessions)
      .where(eq(cohortSessions.id, subject.id))
      .limit(1);
    cohortId = session?.cohortId ?? null;
    sessionTemplateId = session?.templateId ?? null;
  } else if (subject.kind === "COHORT") {
    cohortId = subject.id;
  } else if (subject.kind === "PARTICIPANT") {
    const [assignment] = await executor
      .select({ cohortId: participantCohortAssignments.cohortId })
      .from(participantCohortAssignments)
      .where(
        and(
          eq(participantCohortAssignments.participantId, subject.id),
          isNull(participantCohortAssignments.removedAt),
        ),
      )
      .limit(1);
    cohortId = assignment?.cohortId ?? null;
  }

  if (!cohortId) return { cohort: null, partners: [], sessionTemplateId };

  const [cohort] = await executor
    .select({ id: cohorts.id, armId: cohorts.armId, pairedCohortId: cohorts.pairedCohortId })
    .from(cohorts)
    .where(eq(cohorts.id, cohortId))
    .limit(1);
  if (!cohort) return { cohort: null, partners: [], sessionTemplateId };

  const partners = withPartners
    ? await executor
        .select({ id: cohorts.id, armId: cohorts.armId })
        .from(cohorts)
        .where(
          and(
            or(
              eq(cohorts.pairedCohortId, cohort.id),
              cohort.pairedCohortId ? eq(cohorts.id, cohort.pairedCohortId) : sql`false`,
            ),
            isNull(cohorts.archivedAt),
          ),
        )
    : [];

  return { cohort: { id: cohort.id, armId: cohort.armId }, partners, sessionTemplateId };
}

/** Cancel every still-open action pointing at this subject. */
async function cancelOpenActionsFor(
  executor: DbExecutor,
  studyId: string,
  subject: Subject,
): Promise<number> {
  if (subject.kind === "STUDY") return 0;
  const column =
    subject.kind === "PARTICIPANT"
      ? scheduledActions.participantId
      : subject.kind === "COHORT"
        ? scheduledActions.cohortId
        : subject.kind === "SESSION"
          ? scheduledActions.sessionId
          : scheduledActions.deviceId;

  const rows = await executor
    .update(scheduledActions)
    .set({
      status: "CANCELLED",
      skipReason: "anchorInvalidated",
      processedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledActions.studyId, studyId),
        eq(column, subject.id),
        inArray(scheduledActions.status, ["PENDING", "READY"]),
      ),
    )
    .returning({ id: scheduledActions.id });

  return rows.length;
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/**
 * The operational state an action is re-checked against, read NOW.
 *
 * Every query below reads a yes/no operational column. None of them touches an
 * eligibility result, a consent scope, an arm, a screening note or a contact
 * field — `consentActive` asks whether a consent row exists and stands, never
 * what it granted.
 *
 * A fact about something the action is not attached to defaults to the value
 * that does not block: a message to a cohort has no participant, so
 * `participantActive` is true. A rule that pairs a cohort event with
 * `participantActive` is a configuration mistake, not something the processor
 * should silently refuse work over.
 */
export async function gatherFacts(
  executor: DbExecutor,
  subject: Subject,
  /** A scoped action's audience cohort (D-116): the cohort questions are about it. */
  audienceCohortId: string | null = null,
): Promise<ConditionFacts> {
  const facts: ConditionFacts = {
    participantActive: true,
    participantEnrolled: false,
    consentActive: false,
    cohortActive: false,
    sessionScheduled: false,
    attendanceNotRecorded: true,
    deviceOut: false,
    vrNotReady: false,
  };

  // A session action is about the participants in that session's cohort, so the
  // session's own state answers the session questions and the cohort answers the
  // cohort ones.
  let participantId: string | null = null;
  let cohortId: string | null = null;
  let sessionId: string | null = null;

  if (subject.kind === "PARTICIPANT") participantId = subject.id;
  if (subject.kind === "COHORT") cohortId = subject.id;
  if (subject.kind === "SESSION") sessionId = subject.id;

  if (sessionId) {
    const [session] = await executor
      .select({ status: cohortSessions.status, cohortId: cohortSessions.cohortId })
      .from(cohortSessions)
      .where(eq(cohortSessions.id, sessionId))
      .limit(1);
    facts.sessionScheduled = session?.status === "SCHEDULED";
    cohortId = session?.cohortId ?? null;

    const [recorded] = await executor
      .select({ n: count() })
      .from(sessionAttendance)
      .where(
        and(
          eq(sessionAttendance.sessionId, sessionId),
          sql`${sessionAttendance.status} <> 'EXPECTED'`,
        ),
      );
    facts.attendanceNotRecorded = Number(recorded?.n ?? 0) === 0;
  }

  if (subject.kind === "DEVICE") {
    const [open] = await executor
      .select({ participantId: deviceAssignments.participantId })
      .from(deviceAssignments)
      .where(and(eq(deviceAssignments.deviceId, subject.id), isNull(deviceAssignments.closedAt)))
      .limit(1);
    facts.deviceOut = Boolean(open);
    participantId = open?.participantId ?? null;
  }

  if (audienceCohortId) cohortId = audienceCohortId;

  if (cohortId) {
    const [cohort] = await executor
      .select({ status: cohorts.status })
      .from(cohorts)
      .where(eq(cohorts.id, cohortId))
      .limit(1);
    facts.cohortActive = cohort ? cohort.status !== "COMPLETED" : false;
  }

  if (participantId) {
    const [participant] = await executor
      .select({ enrollmentStatus: participants.enrollmentStatus })
      .from(participants)
      .where(eq(participants.id, participantId))
      .limit(1);

    const enrollment = participant?.enrollmentStatus ?? null;
    // Active means still in the study. Not a judgement — the two statuses that
    // end a participant's involvement are the two the team set themselves.
    facts.participantActive = enrollment !== "WITHDRAWN" && enrollment !== "COMPLETED";
    facts.participantEnrolled =
      enrollment === "ENROLLED" || enrollment === "RANDOMIZED" || enrollment === "COHORT_ASSIGNED";

    // EXISTENCE, never scope. "Is there a consent that stands", nothing more.
    const [consent] = await executor
      .select({ n: count() })
      .from(consents)
      .where(and(eq(consents.participantId, participantId), eq(consents.status, "CONSENTED")));
    facts.consentActive = Number(consent?.n ?? 0) > 0;

    if (!cohortId) {
      const [assignment] = await executor
        .select({ status: cohorts.status })
        .from(participantCohortAssignments)
        .innerJoin(cohorts, eq(cohorts.id, participantCohortAssignments.cohortId))
        .where(
          and(
            eq(participantCohortAssignments.participantId, participantId),
            isNull(participantCohortAssignments.removedAt),
          ),
        )
        .limit(1);
      facts.cohortActive = assignment ? assignment.status !== "COMPLETED" : false;
    }

    const [assignment] = await executor
      .select({ readiness: deviceAssignments.readiness })
      .from(deviceAssignments)
      .where(
        and(
          eq(deviceAssignments.participantId, participantId),
          isNull(deviceAssignments.closedAt),
        ),
      )
      .limit(1);
    facts.deviceOut = Boolean(assignment);
    // Reported, never inferred (D-003). "Not reported ready" includes UNKNOWN,
    // which is the honest reading: nobody has said it works.
    facts.vrNotReady = assignment ? assignment.readiness !== "READY" : false;
  }

  return facts;
}

// ---------------------------------------------------------------------------
// The processor
// ---------------------------------------------------------------------------

export interface ProcessSummary {
  examined: number;
  prepared: number;
  completed: number;
  skipped: number;
  failed: number;
  /** AUTOMATIC emails sent to at least one recipient (D-116). */
  sent: number;
  /** AUTOMATIC emails left PENDING because no sender is configured. */
  deferred: number;
}

/**
 * Work through the actions that have come due.
 *
 * WHAT THIS DOES NOT DO: send, deliver, notify, email, post or call anything.
 * A MESSAGE action that passes its re-check becomes READY and appears in the
 * team's queue; a person copies it, pastes it, and says they did (D-004).
 *
 * A TASK or ALERT action is DONE when the task or alert exists, because
 * creating it IS the whole action — nothing is waiting on a person to deliver.
 *
 * There is no grace window: an action that should have been prepared on Friday
 * and was not, because the processor was down, is still prepared on Monday with
 * its original `scheduledFor` visible. Dropping it silently would hide an outage.
 *
 * Failures are per action. One rule pointing at a deleted template must not stop
 * the other ninety-nine, so each is caught, marked FAILED, and raised as an
 * alert rather than swallowed.
 */
export async function processDueActions(params: {
  studyId: string;
  now?: Date;
  limit?: number;
}): Promise<ProcessSummary> {
  const now = params.now ?? new Date();
  const limit = params.limit ?? 200;
  const db = getDb();

  const due = await db
    .select()
    .from(scheduledActions)
    .where(
      and(
        eq(scheduledActions.studyId, params.studyId),
        eq(scheduledActions.status, "PENDING"),
        lte(scheduledActions.scheduledFor, now),
      ),
    )
    .orderBy(asc(scheduledActions.scheduledFor))
    .limit(limit);

  const summary: ProcessSummary = {
    examined: due.length,
    prepared: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    sent: 0,
    deferred: 0,
  };

  for (const action of due) {
    try {
      const outcome = await processOne(action, now);
      if (outcome === "prepared") summary.prepared += 1;
      else if (outcome === "completed") summary.completed += 1;
      else if (outcome === "sent") summary.sent += 1;
      else if (outcome === "deferred") summary.deferred += 1;
      else summary.skipped += 1;
    } catch (err) {
      summary.failed += 1;
      await failAction(action, err);
    }
  }

  return summary;
}

type Outcome = "prepared" | "completed" | "skipped" | "sent" | "deferred";

async function processOne(action: ScheduledAction, now: Date): Promise<Outcome> {
  const db = getDb();

  const [rule] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, action.ruleId))
    .limit(1);
  if (!rule) throw new NotFoundError("automation_rule", action.ruleId);

  // A MESSAGE action is about its template as it stands NOW: edited to WhatsApp
  // since the rule was saved, an AUTOMATIC one is refused rather than sent.
  const [template] =
    action.actionKind === "MESSAGE" && rule.communicationTemplateId
      ? await db
          .select()
          .from(communicationTemplates)
          .where(eq(communicationTemplates.id, rule.communicationTemplateId))
          .limit(1)
      : [];
  if (action.actionKind === "MESSAGE" && !template) {
    throw new NotFoundError("communication_template", rule.communicationTemplateId ?? "none");
  }

  // Unknown condition keys are dropped rather than fatal: a row written by an
  // older version must not make every run throw. What it must not do is take
  // effect silently, so the drop is reported as a misconfiguration.
  const { conditions, dropped } = parseConditions(rule.conditionsJson);
  const subject = subjectOf(action);
  const facts = await gatherFacts(db, subject, action.audienceCohortId);

  const verdict = decide({
    conditions,
    facts,
    deliveryMode: action.deliveryMode as DeliveryMode,
    channel: template?.channel ?? null,
  });

  if (dropped.length > 0) {
    await raiseAlert({
      studyId: action.studyId,
      kind: "RULE_MISCONFIGURED",
      subject: { kind: "STUDY" },
      detail: `${rule.key}: ${dropped.slice(0, 5).join(", ")}`,
      ruleId: rule.id,
    });
  }

  if (verdict.decision === "refuse") {
    throw new RuleError("unavailableDeliveryMode");
  }

  // The scope is re-checked like a condition: someone moved to another cohort,
  // or a pair undone, since this was planned no longer receives it (D-116).
  const unmet: string[] = verdict.decision === "skip" ? [...verdict.unmet] : [];
  if (rule.armId) {
    const context = await loadScopeContext(db, subject);
    const current = resolveScope(rule.armId, context.cohort, context.partners);
    if (!current.applies || current.audienceCohortId !== action.audienceCohortId) {
      unmet.push("outOfScope");
    }
  }

  if (unmet.length > 0) {
    await skipAction(action, rule.key, unmet, now);
    return "skipped";
  }

  if (action.actionKind === "MESSAGE" && action.deliveryMode === "AUTOMATIC" && template) {
    return sendAutomatic(action, rule, template, now);
  }

  // From here the action is going ahead. What "going ahead" means depends on
  // what it produces — and for a MANUAL message it means putting it in front of
  // a person, never sending it.
  if (action.actionKind === "MESSAGE") {
    await db.transaction(async (tx) => {
      await tx
        .update(scheduledActions)
        .set({ status: "READY", processedAt: now })
        .where(eq(scheduledActions.id, action.id));

      await recordAuditEvent(tx, {
        studyId: action.studyId,
        actor: { type: "SYSTEM" },
        action: "scheduled_action.prepared",
        entityType: "scheduled_action",
        entityId: action.id,
        after: { ruleKey: rule.key, deliveryMode: action.deliveryMode },
      });
    });
    return "prepared";
  }

  if (action.actionKind === "TASK") {
    await createRuleTask(action, rule, now);
    return "completed";
  }

  await raiseAlert({
    studyId: action.studyId,
    kind: rule.alertKind as AlertKind,
    subject,
    detail: rule.nameEs.slice(0, 200),
    ruleId: rule.id,
    scheduledActionId: action.id,
  });
  await closeAction(action.id, action.studyId, rule.key, now);
  return "completed";
}

async function skipAction(
  action: ScheduledAction,
  ruleKey: string,
  unmet: readonly string[],
  now: Date,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx
      .update(scheduledActions)
      .set({
        status: "SKIPPED",
        // The unmet conditions, as a vocabulary rather than prose, so
        // "how often do we skip because someone withdrew" is countable.
        skipReason: unmet.join(",").slice(0, SKIP_REASON_MAX_LENGTH),
        processedAt: now,
      })
      .where(eq(scheduledActions.id, action.id));

    await recordAuditEvent(tx, {
      studyId: action.studyId,
      actor: { type: "SYSTEM" },
      action: "scheduled_action.skipped",
      entityType: "scheduled_action",
      entityId: action.id,
      after: { ruleKey, unmet },
    });
  });
}

/**
 * Who an automatic email goes to: the participant the action is about, or every
 * active member of the cohort it is for — the scoped audience cohort first,
 * else the subject's own cohort. One email per person, never a group email.
 */
async function automaticRecipients(action: ScheduledAction): Promise<string[]> {
  const db = getDb();
  if (action.subjectKind === "PARTICIPANT" && action.participantId) return [action.participantId];

  let cohortId = action.audienceCohortId ?? action.cohortId;
  if (!cohortId && action.sessionId) {
    const [session] = await db
      .select({ cohortId: cohortSessions.cohortId })
      .from(cohortSessions)
      .where(eq(cohortSessions.id, action.sessionId))
      .limit(1);
    cohortId = session?.cohortId ?? null;
  }
  if (!cohortId) return [];

  const members = await db
    .select({ id: participants.id, enrollment: participants.enrollmentStatus })
    .from(participantCohortAssignments)
    .innerJoin(participants, eq(participants.id, participantCohortAssignments.participantId))
    .where(
      and(
        eq(participantCohortAssignments.cohortId, cohortId),
        isNull(participantCohortAssignments.removedAt),
      ),
    );
  // The same reading as `participantActive`: someone who withdrew or finished
  // is not written to, without that being a failure anyone has to look at.
  return members
    .filter((m) => m.enrollment !== "WITHDRAWN" && m.enrollment !== "COMPLETED")
    .map((m) => m.id);
}

/**
 * Send an AUTOMATIC email action (D-116).
 *
 * - No sender configured: nothing is claimed, the action stays PENDING, and a
 *   CRITICAL alert says so. Once mail is configured it goes out, late, with its
 *   original time visible: the same "no grace window" rule as everything else.
 * - Otherwise the action is claimed (PENDING → READY) so an overlapping run
 *   cannot take it too, then sent. Every recipient who got it has a
 *   `communications` row; anyone who did not is named by code in an alert. It
 *   is never retried: the batch would reach the people who already got it.
 */
async function sendAutomatic(
  action: ScheduledAction,
  rule: AutomationRule,
  template: CommunicationTemplate,
  now: Date,
): Promise<Outcome> {
  const db = getDb();

  if (automaticTemplateProblem(template)) throw new RuleError("automaticTemplate");

  if (!isMailConfigured()) {
    await raiseAlert({
      studyId: action.studyId,
      kind: "EMAIL_NOT_CONFIGURED",
      subject: { kind: "STUDY" },
      detail: rule.key,
      ruleId: rule.id,
    });
    return "deferred";
  }

  const claimed = await db
    .update(scheduledActions)
    .set({ status: "READY", processedAt: now })
    .where(and(eq(scheduledActions.id, action.id), eq(scheduledActions.status, "PENDING")))
    .returning({ id: scheduledActions.id });
  if (claimed.length === 0) return "deferred";

  const recipients = await automaticRecipients(action);
  if (recipients.length === 0) {
    await skipAction(action, rule.key, ["noRecipients"], now);
    return "skipped";
  }

  const result = await deliverAutomaticEmail({
    studyId: action.studyId,
    actionId: action.id,
    ruleKey: rule.key,
    template,
    participantIds: recipients,
  });
  if (result.kind === "templateRefused") throw new RuleError("automaticTemplate");
  if (result.kind === "notConfigured") {
    // Configuration vanished between the check and the send. Put it back.
    await db
      .update(scheduledActions)
      .set({ status: "PENDING", processedAt: null })
      .where(eq(scheduledActions.id, action.id));
    return "deferred";
  }

  const sent = result.communicationIds.length;
  const failed = result.failures.length;

  await db.transaction(async (tx) => {
    await tx
      .update(scheduledActions)
      .set(
        sent > 0
          ? {
              status: "DONE",
              completedAt: now,
              // One communication can be linked; a cohort batch is found by
              // the audit rows that name this action.
              communicationId: sent === 1 ? result.communicationIds[0] : null,
              skipReason: failed > 0 ? `emailNotSent:${failed}` : null,
            }
          : { status: "FAILED", skipReason: `emailNotSent:${failed}` },
      )
      .where(eq(scheduledActions.id, action.id));

    await recordAuditEvent(tx, {
      studyId: action.studyId,
      actor: { type: "SYSTEM" },
      action: "scheduled_action.sent",
      entityType: "scheduled_action",
      entityId: action.id,
      after: { ruleKey: rule.key, sent, failed },
    });
  });

  if (failed > 0) {
    await raiseAlert({
      studyId: action.studyId,
      kind: "EMAIL_NOT_SENT",
      subject: subjectOf(action),
      // Codes and a reason vocabulary only, never an address.
      detail: `${rule.key}: ${result.failures
        .map((f) => `${f.participantCode} (${f.reason})`)
        .join(", ")}`,
      ruleId: rule.id,
      scheduledActionId: action.id,
      refreshDetail: true,
    });
  }

  return sent > 0 ? "sent" : "skipped";
}

/** Create the task a TASK rule asks for, and finish the action that produced it. */
async function createRuleTask(
  action: ScheduledAction,
  rule: AutomationRule,
  now: Date,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx
      .insert(tasks)
      .values({
        studyId: action.studyId,
        // Deduped on the action, not on the rule: two sessions of the same
        // cohort legitimately each need their own "prepare the room" task.
        dedupeKey: `action:${action.id}`,
        titleEs: rule.taskTitleEs?.slice(0, TASK_TITLE_MAX_LENGTH) ?? rule.nameEs,
        status: "OPEN",
        priority: rule.taskPriority as TaskPriority,
        origin: "RULE",
        dueAt: action.scheduledFor,
        participantId: action.participantId,
        cohortId: action.cohortId,
        sessionId: action.sessionId,
        deviceId: action.deviceId,
        ruleId: rule.id,
        scheduledActionId: action.id,
      })
      .onConflictDoNothing();

    await tx
      .update(scheduledActions)
      .set({ status: "DONE", processedAt: now, completedAt: now })
      .where(eq(scheduledActions.id, action.id));

    await recordAuditEvent(tx, {
      studyId: action.studyId,
      actor: { type: "SYSTEM" },
      action: "task.created",
      entityType: "scheduled_action",
      entityId: action.id,
      after: { ruleKey: rule.key, origin: "RULE" },
    });
  });
}

async function closeAction(
  actionId: string,
  studyId: string,
  ruleKey: string,
  now: Date,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx
      .update(scheduledActions)
      .set({ status: "DONE", processedAt: now, completedAt: now })
      .where(eq(scheduledActions.id, actionId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "SYSTEM" },
      action: "scheduled_action.completed",
      entityType: "scheduled_action",
      entityId: actionId,
      after: { ruleKey },
    });
  });
}

/**
 * A processing failure becomes a FAILED row and a CRITICAL alert.
 *
 * Never a log line and nothing else. The whole point of a queue that prepares
 * reminders is that somebody notices when it stops, and a failure visible only
 * in a log is a failure nobody sees.
 */
async function failAction(action: ScheduledAction, err: unknown): Promise<void> {
  const reason = err instanceof RuleError ? err.problem : "processingError";
  await getDb()
    .update(scheduledActions)
    .set({ status: "FAILED", skipReason: reason, processedAt: new Date() })
    .where(eq(scheduledActions.id, action.id));

  await raiseAlert({
    studyId: action.studyId,
    kind: "SCHEDULED_ACTION_FAILED",
    subject: subjectOf(action),
    detail: reason,
    scheduledActionId: action.id,
  });
}

// ---------------------------------------------------------------------------
// Sweeps
// ---------------------------------------------------------------------------

/**
 * Operational anomalies that are true of the data right now.
 *
 * These are STATE checks, deliberately separate from rules. A rule answers
 * "this happened, so do that in N minutes"; a sweep answers "look at the study
 * as it stands — is anything missing, late or inconsistent".
 *
 * NOTHING HERE IS TIME-CONFIGURED. A check like "warn if the headset is not
 * ready 48 h before the session" has a trial-specific number in it, so it
 * belongs in a rule row (event SESSION_SCHEDULED, a negative offset, action
 * ALERT) and not in this file — non-negotiable 6. Every sweep below reads either
 * a configured bound (`cohorts.min_size`) or a fact with no threshold at all
 * (a return date that has passed, a determination with no reason).
 *
 * Every finding is deduplicated by subject, so a headset three weeks overdue is
 * one row that keeps its `raisedAt` and moves its `lastSeenAt`.
 */
export async function runSweeps(params: {
  studyId: string;
  now?: Date;
}): Promise<{ raised: number; kinds: Partial<Record<AlertKind, number>> }> {
  const now = params.now ?? new Date();
  const db = getDb();
  const kinds: Partial<Record<AlertKind, number>> = {};
  let raised = 0;

  const bump = async (
    kind: AlertKind,
    subject: Subject,
    detail: string,
  ) => {
    const created = await raiseAlert({ studyId: params.studyId, kind, subject, detail, now });
    if (created) {
      raised += 1;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
  };

  // 1. An allocation recorded for someone with no consent that stands.
  //    EXISTENCE ONLY — this never looks at what the consent granted. Recorded
  //    in the audit today and surfaced nowhere, which docs/decisions.md listed
  //    as an open question; D-043 answers it by showing it to a person.
  const withoutConsent = await db
    .select({ id: participants.id, code: participants.code })
    .from(participants)
    .where(
      and(
        eq(participants.studyId, params.studyId),
        sql`exists (select 1 from randomizations r where r.participant_id = ${participants.id})`,
        sql`not exists (
          select 1 from consents c
          where c.participant_id = ${participants.id} and c.status = 'CONSENTED'
        )`,
      ),
    );
  for (const p of withoutConsent) {
    await bump("ALLOCATION_WITHOUT_CONSENT", { kind: "PARTICIPANT", id: p.id }, p.code);
  }

  // 2 & 3. Cohorts outside their CONFIGURED bounds. A cohort with no bounds is
  //        not judged — unbounded is a legitimate configuration, not a default
  //        of six to eight (D-033).
  const cohortRows = await db
    .select({
      id: cohorts.id,
      code: cohorts.code,
      status: cohorts.status,
      minSize: cohorts.minSize,
      maxSize: cohorts.maxSize,
      members: sql<number>`(
        select count(*) from participant_cohort_assignments a
        where a.cohort_id = ${cohorts.id} and a.removed_at is null
      )`,
    })
    .from(cohorts)
    .where(eq(cohorts.studyId, params.studyId));

  for (const row of cohortRows) {
    const size = assessCohortSize({
      members: Number(row.members),
      minSize: row.minSize,
      maxSize: row.maxSize,
    });
    // Under-size only bites once someone says the cohort is running: a cohort
    // has to be allowed to pass through being too small on its way to the right
    // size (domain/cohort.ts, SIZE_CHECKED_STATUSES).
    if (size.verdict === "UNDER" && row.status === "ACTIVE") {
      await bump(
        "COHORT_UNDERSIZED",
        { kind: "COHORT", id: row.id },
        `${row.code}: ${size.members}/${size.minSize}`,
      );
    }
    if (size.verdict === "OVER") {
      await bump(
        "COHORT_OVER_CAPACITY",
        { kind: "COHORT", id: row.id },
        `${row.code}: ${size.members}/${size.maxSize}`,
      );
    }
  }

  // 4. A headset past the date it was expected back, still out. The date is
  //    entered by logistics per assignment, so there is no threshold here.
  const overdue = await db
    .select({ deviceId: devices.id, code: devices.code, expected: deviceAssignments.expectedReturnAt })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(
      and(
        eq(deviceAssignments.studyId, params.studyId),
        isNull(deviceAssignments.closedAt),
        sql`${deviceAssignments.expectedReturnAt} is not null`,
        lte(deviceAssignments.expectedReturnAt, now),
      ),
    );
  for (const row of overdue) {
    await bump("DEVICE_RETURN_OVERDUE", { kind: "DEVICE", id: row.deviceId }, row.code);
  }

  // 5. Exclusions with no reason attached. A constraint refuses these now, so
  //    the count should be zero; rows written before it exists are real and a
  //    flow diagram that dropped them would understate the exclusions. Raised
  //    against the STUDY, never against the people — naming one of three
  //    excluded participants would be worse than naming none.
  const [unreasoned] = await db
    .select({ n: count() })
    .from(screenings)
    .where(
      and(
        eq(screenings.studyId, params.studyId),
        eq(screenings.result, "INELIGIBLE"),
        isNull(screenings.reasonId),
        sql`${screenings.completedAt} is not null`,
      ),
    );
  if (Number(unreasoned?.n ?? 0) > 0) {
    await bump("EXCLUSION_WITHOUT_REASON", { kind: "STUDY" }, `${unreasoned.n}`);
  }

  return { raised, kinds };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/**
 * Raise an alert, or note that an existing one is still true.
 *
 * Returns true only when a NEW row was created. A sweep runs on every tick;
 * without this, a headset three weeks overdue would have twenty-one alerts and
 * the screen that exists to show what needs attention would be the first one
 * people learn to ignore.
 *
 * A RESOLVED alert does not block a new one. The same device overdue again next
 * month is a new problem with its own `raisedAt`, and collapsing the two would
 * lose that it was fixed in between.
 */
export async function raiseAlert(params: {
  studyId: string;
  kind: AlertKind;
  subject: Subject;
  detail?: string | null;
  ruleId?: string | null;
  scheduledActionId?: string | null;
  now?: Date;
  /**
   * Replace the detail of an alert that is already open. For a failure that
   * carries new facts each time (EMAIL_NOT_SENT names who was missed); a sweep
   * leaves it unset so its alert keeps the wording it was raised with.
   */
  refreshDetail?: boolean;
}): Promise<boolean> {
  const now = params.now ?? new Date();
  const subjectId = params.subject.kind === "STUDY" ? params.studyId : params.subject.id;
  const dedupeKey = alertDedupeKey(params.kind, {
    kind: params.subject.kind,
    id: subjectId,
  });

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.studyId, params.studyId),
          eq(alerts.dedupeKey, dedupeKey),
          inArray(alerts.status, ["OPEN", "ACKNOWLEDGED"]),
        ),
      )
      .limit(1);

    if (existing) {
      // Still true. One row, two answerable questions: since when, and as of
      // when. No audit row — nothing changed that anyone decided.
      await tx
        .update(alerts)
        .set({
          lastSeenAt: now,
          ...(params.refreshDetail ? { detail: params.detail?.slice(0, 280) ?? null } : {}),
        })
        .where(eq(alerts.id, existing.id));
      return false;
    }

    const [created] = await tx
      .insert(alerts)
      .values({
        studyId: params.studyId,
        kind: params.kind,
        severity: severityFor(params.kind),
        status: "OPEN",
        dedupeKey,
        ...subjectColumns(params.subject),
        detail: params.detail?.slice(0, 280) ?? null,
        ruleId: params.ruleId ?? null,
        scheduledActionId: params.scheduledActionId ?? null,
        raisedAt: now,
        lastSeenAt: now,
      })
      .returning({ id: alerts.id });

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "SYSTEM" },
      action: "alert.raised",
      entityType: "alert",
      entityId: created.id,
      after: { kind: params.kind, severity: severityFor(params.kind), dedupeKey },
    });

    return true;
  });
}

export interface AlertRow extends Alert {
  participantCode: string | null;
  cohortCode: string | null;
  deviceCode: string | null;
  acknowledgedByName: string | null;
}

/** Alerts for the study, unresolved first, most severe first. */
export async function listAlerts(
  studyId: string,
  options: { status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"; limit?: number } = {},
): Promise<AlertRow[]> {
  const conditions = [eq(alerts.studyId, studyId)];
  if (options.status) conditions.push(eq(alerts.status, options.status));

  const rows = await getDb()
    .select({
      alert: alerts,
      participantCode: participants.code,
      cohortCode: cohorts.code,
      deviceCode: devices.code,
      acknowledgedByName: users.displayName,
    })
    .from(alerts)
    .leftJoin(participants, eq(participants.id, alerts.participantId))
    .leftJoin(cohorts, eq(cohorts.id, alerts.cohortId))
    .leftJoin(devices, eq(devices.id, alerts.deviceId))
    .leftJoin(users, eq(users.id, alerts.acknowledgedBy))
    .where(and(...conditions))
    .orderBy(asc(alerts.status), desc(alerts.severity), desc(alerts.raisedAt))
    .limit(options.limit ?? 200);

  return rows.map((r) => ({
    ...r.alert,
    participantCode: r.participantCode,
    cohortCode: r.cohortCode,
    deviceCode: r.deviceCode,
    acknowledgedByName: r.acknowledgedByName,
  }));
}

export async function countUnresolvedAlerts(studyId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(alerts)
    .where(and(eq(alerts.studyId, studyId), inArray(alerts.status, ["OPEN", "ACKNOWLEDGED"])));
  return Number(row?.n ?? 0);
}

/** "I have seen this." Does not claim it is fixed. */
export async function acknowledgeAlert(params: {
  studyId: string;
  alertId: string;
  actorId: string;
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: alerts.id, status: alerts.status, kind: alerts.kind })
      .from(alerts)
      .where(and(eq(alerts.id, params.alertId), eq(alerts.studyId, params.studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("alert", params.alertId);
    if (current.status !== "OPEN") return;

    await tx
      .update(alerts)
      .set({ status: "ACKNOWLEDGED", acknowledgedBy: params.actorId, acknowledgedAt: new Date() })
      .where(eq(alerts.id, params.alertId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "alert.acknowledged",
      entityType: "alert",
      entityId: params.alertId,
      before: { status: current.status },
      after: { status: "ACKNOWLEDGED", kind: current.kind },
    });
  });
}

/**
 * "This is dealt with."
 *
 * A person's statement, never the sweep's. A sweep that closed its own alerts
 * would erase the record that something was wrong for two weeks, and the note
 * is where the team says what they did about it.
 */
export async function resolveAlert(params: {
  studyId: string;
  alertId: string;
  actorId: string;
  note?: string | null;
}): Promise<void> {
  const note = params.note?.trim().slice(0, 280) || null;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: alerts.id, status: alerts.status, kind: alerts.kind })
      .from(alerts)
      .where(and(eq(alerts.id, params.alertId), eq(alerts.studyId, params.studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("alert", params.alertId);
    if (current.status === "RESOLVED") return;

    await tx
      .update(alerts)
      .set({
        status: "RESOLVED",
        resolvedBy: params.actorId,
        resolvedAt: new Date(),
        resolutionNote: note,
      })
      .where(eq(alerts.id, params.alertId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "alert.resolved",
      entityType: "alert",
      entityId: params.alertId,
      before: { status: current.status },
      // The length of the note, not the note: it is the one free-text field on
      // this screen, and the audit log is read by more people than the alert is.
      after: { status: "RESOLVED", kind: current.kind, noteLength: note?.length ?? 0 },
    });
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface TaskRow extends Task {
  participantCode: string | null;
  cohortCode: string | null;
  assignedToName: string | null;
}

export async function listTasks(
  studyId: string,
  options: { status?: "OPEN" | "DONE" | "CANCELLED"; assignedTo?: string; limit?: number } = {},
): Promise<TaskRow[]> {
  const conditions = [eq(tasks.studyId, studyId)];
  if (options.status) conditions.push(eq(tasks.status, options.status));
  if (options.assignedTo) conditions.push(eq(tasks.assignedTo, options.assignedTo));

  const rows = await getDb()
    .select({
      task: tasks,
      participantCode: participants.code,
      cohortCode: cohorts.code,
      assignedToName: users.displayName,
    })
    .from(tasks)
    .leftJoin(participants, eq(participants.id, tasks.participantId))
    .leftJoin(cohorts, eq(cohorts.id, tasks.cohortId))
    .leftJoin(users, eq(users.id, tasks.assignedTo))
    .where(and(...conditions))
    // Open first, then by when it is due — a task with no date sorts last
    // rather than first, because "no deadline" is not "most urgent".
    .orderBy(asc(tasks.status), sql`${tasks.dueAt} asc nulls last`, desc(tasks.createdAt))
    .limit(options.limit ?? 200);

  return rows.map((r) => ({
    ...r.task,
    participantCode: r.participantCode,
    cohortCode: r.cohortCode,
    assignedToName: r.assignedToName,
  }));
}

export async function countOpenTasks(studyId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.studyId, studyId), eq(tasks.status, "OPEN")));
  return Number(row?.n ?? 0);
}

export async function createTask(params: {
  studyId: string;
  actorId: string;
  titleEs: string;
  detail?: string | null;
  priority?: TaskPriority;
  dueAt?: Date | null;
  assignedTo?: string | null;
  participantId?: string | null;
  cohortId?: string | null;
}): Promise<string> {
  const titleEs = params.titleEs.trim().slice(0, TASK_TITLE_MAX_LENGTH);

  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(tasks)
      .values({
        studyId: params.studyId,
        titleEs,
        detail: params.detail?.trim().slice(0, TASK_DETAIL_MAX_LENGTH) || null,
        status: "OPEN",
        priority: params.priority ?? "NORMAL",
        origin: "MANUAL",
        dueAt: params.dueAt ?? null,
        assignedTo: params.assignedTo || null,
        participantId: params.participantId || null,
        cohortId: params.cohortId || null,
      })
      .returning({ id: tasks.id });

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "task.created",
      entityType: "task",
      entityId: created.id,
      // Length, not content. A task title is staff-authored free text on a
      // shared screen (D-035); the audit log is read by more people still.
      after: {
        origin: "MANUAL",
        priority: params.priority ?? "NORMAL",
        titleLength: titleEs.length,
        assigned: Boolean(params.assignedTo),
      },
    });

    return created.id;
  });
}

/** Close a task, or cancel it. Both are a person's statement, both audited. */
export async function closeTask(params: {
  studyId: string;
  taskId: string;
  actorId: string;
  status: "DONE" | "CANCELLED";
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: tasks.id, status: tasks.status, origin: tasks.origin })
      .from(tasks)
      .where(and(eq(tasks.id, params.taskId), eq(tasks.studyId, params.studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("task", params.taskId);
    if (current.status !== "OPEN") return;

    const now = new Date();
    await tx
      .update(tasks)
      .set({
        status: params.status,
        // The constraint ties completedAt to DONE: a cancelled task was never
        // completed, and recording a completion time for one would say it was.
        completedAt: params.status === "DONE" ? now : null,
        completedBy: params.status === "DONE" ? params.actorId : null,
      })
      .where(eq(tasks.id, params.taskId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: params.status === "DONE" ? "task.completed" : "task.cancelled",
      entityType: "task",
      entityId: params.taskId,
      before: { status: current.status },
      after: { status: params.status, origin: current.origin },
    });
  });
}

export async function assignTask(params: {
  studyId: string;
  taskId: string;
  actorId: string;
  assignedTo: string | null;
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: tasks.id, assignedTo: tasks.assignedTo })
      .from(tasks)
      .where(and(eq(tasks.id, params.taskId), eq(tasks.studyId, params.studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("task", params.taskId);

    await tx
      .update(tasks)
      .set({ assignedTo: params.assignedTo })
      .where(eq(tasks.id, params.taskId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "task.assigned",
      entityType: "task",
      entityId: params.taskId,
      before: { assignedTo: current.assignedTo },
      after: { assignedTo: params.assignedTo },
    });
  });
}

// ---------------------------------------------------------------------------
// The prepared queue
// ---------------------------------------------------------------------------

export interface PreparedActionRow extends ScheduledAction {
  ruleName: string;
  ruleKey: string;
  templateId: string | null;
  templateName: string | null;
  participantCode: string | null;
  /**
   * The cohort the message is actually addressed to.
   *
   * NOT the same as `cohortId`. A session reminder's subject is the SESSION —
   * that is what the rule anchors on and what has to be re-checked — but the
   * message goes to the cohort's channel. Resolving it here is what lets the
   * queue open the composer on the right subject; without it a session action
   * would be prepared and then be unaddressable, which is the same as not
   * being prepared at all.
   */
  targetCohortId: string | null;
  cohortCode: string | null;
}

/**
 * Messages that are prepared and waiting for a person.
 *
 * This is the end of the line for automation. Everything on this list was
 * scheduled by a rule, re-checked when it came due, and found to still make
 * sense — and now a human opens it, copies it and sends it themselves.
 */
export async function listPreparedActions(
  studyId: string,
  options: { limit?: number } = {},
): Promise<PreparedActionRow[]> {
  const rows = await getDb()
    .select({
      action: scheduledActions,
      ruleName: automationRules.nameEs,
      ruleKey: automationRules.key,
      templateId: automationRules.communicationTemplateId,
      templateName: communicationTemplates.nameEs,
      participantCode: participants.code,
      targetCohortId: cohorts.id,
      cohortCode: cohorts.code,
    })
    .from(scheduledActions)
    .innerJoin(automationRules, eq(automationRules.id, scheduledActions.ruleId))
    .leftJoin(
      communicationTemplates,
      eq(communicationTemplates.id, automationRules.communicationTemplateId),
    )
    .leftJoin(participants, eq(participants.id, scheduledActions.participantId))
    // A session action carries no cohort of its own, so the cohort is reached
    // through the session. Joined rather than resolved per row so the queue is
    // still one query.
    .leftJoin(cohortSessions, eq(cohortSessions.id, scheduledActions.sessionId))
    .leftJoin(
      cohorts,
      sql`${cohorts.id} = coalesce(${scheduledActions.audienceCohortId}, ${scheduledActions.cohortId}, ${cohortSessions.cohortId})`,
    )
    .where(
      and(
        eq(scheduledActions.studyId, studyId),
        eq(scheduledActions.status, "READY"),
        eq(scheduledActions.actionKind, "MESSAGE"),
      ),
    )
    .orderBy(asc(scheduledActions.scheduledFor))
    .limit(options.limit ?? 100);

  return rows.map((r) => ({
    ...r.action,
    ruleName: r.ruleName,
    ruleKey: r.ruleKey,
    templateId: r.templateId,
    templateName: r.templateName,
    participantCode: r.participantCode,
    targetCohortId: r.targetCohortId,
    cohortCode: r.cohortCode,
  }));
}

/**
 * Attach the communication a person recorded to the action that prepared it.
 *
 * Called after `recordSend`, so the queue item disappears and the timeline shows
 * that this particular reminder was the one that went out. The action does not
 * record the send itself: a `communications` row is the record, and duplicating
 * it here would create two answers to "what did we send" (D-039).
 */
export async function completeMessageAction(params: {
  studyId: string;
  actionId: string;
  actorId: string;
  communicationId: string;
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: scheduledActions.id, status: scheduledActions.status })
      .from(scheduledActions)
      .where(
        and(eq(scheduledActions.id, params.actionId), eq(scheduledActions.studyId, params.studyId)),
      )
      .limit(1);
    if (!current) throw new NotFoundError("scheduled_action", params.actionId);

    const now = new Date();
    await tx
      .update(scheduledActions)
      .set({
        status: "DONE",
        completedAt: now,
        completedBy: params.actorId,
        communicationId: params.communicationId,
      })
      .where(eq(scheduledActions.id, params.actionId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "scheduled_action.completed",
      entityType: "scheduled_action",
      entityId: params.actionId,
      before: { status: current.status },
      after: { status: "DONE", communicationId: params.communicationId },
    });
  });
}

// ---------------------------------------------------------------------------
// Rules (configuration)
// ---------------------------------------------------------------------------

export interface RuleRow extends AutomationRule {
  templateName: string | null;
  armName: string | null;
  sessionTemplateName: string | null;
}

export async function listRules(studyId: string): Promise<RuleRow[]> {
  const rows = await getDb()
    .select({
      rule: automationRules,
      templateName: communicationTemplates.nameEs,
      armName: studyArms.nameEs,
      sessionTemplateName: sessionTemplates.nameEs,
    })
    .from(automationRules)
    .leftJoin(
      communicationTemplates,
      eq(communicationTemplates.id, automationRules.communicationTemplateId),
    )
    .leftJoin(studyArms, eq(studyArms.id, automationRules.armId))
    .leftJoin(sessionTemplates, eq(sessionTemplates.id, automationRules.sessionTemplateId))
    .where(eq(automationRules.studyId, studyId))
    .orderBy(asc(automationRules.eventType), asc(automationRules.position), asc(automationRules.key));

  return rows.map((r) => ({
    ...r.rule,
    templateName: r.templateName,
    armName: r.armName,
    sessionTemplateName: r.sessionTemplateName,
  }));
}

/** The events whose subject is a session, so the only ones a session scope can match. */
const SESSION_EVENTS: readonly EventType[] = [
  "SESSION_SCHEDULED",
  "SESSION_RESCHEDULED",
  "SESSION_CANCELLED",
  "SESSION_HELD",
];

export async function createRule(params: {
  studyId: string;
  actorId: string;
  key: string;
  nameEs: string;
  eventType: EventType;
  actionKind: ActionKind;
  offsetMinutes: number;
  deliveryMode?: DeliveryMode;
  communicationTemplateId?: string | null;
  taskTitleEs?: string | null;
  taskPriority?: TaskPriority;
  alertKind?: AlertKind | null;
  conditions?: RuleConditions;
  /** Scope to cohorts running this arm (D-116). */
  armId?: string | null;
  /** Scope to sessions of this template. Session events only. */
  sessionTemplateId?: string | null;
}): Promise<string> {
  const key = params.key.trim().toLowerCase();
  const deliveryMode = params.deliveryMode ?? "MANUAL";
  const armId = params.armId || null;
  const sessionTemplateId = params.sessionTemplateId || null;

  if (deliveryMode === "AUTOMATIC" && params.actionKind !== "MESSAGE") {
    throw new RuleError("unavailableDeliveryMode");
  }
  if (sessionTemplateId && !SESSION_EVENTS.includes(params.eventType)) throw new RuleError("shape");

  return getDb().transaction(async (tx) => {
    // Refused here, not at execution time. A rule saved as AUTOMATIC and quietly
    // downgraded when it fires would tell the team their messages were going
    // out. AUTOMATIC means an individual EMAIL with only always-known values.
    if (params.actionKind === "MESSAGE" && params.communicationTemplateId) {
      const [template] = await tx
        .select()
        .from(communicationTemplates)
        .where(
          and(
            eq(communicationTemplates.id, params.communicationTemplateId),
            eq(communicationTemplates.studyId, params.studyId),
          ),
        )
        .limit(1);
      if (!template) throw new NotFoundError("communication_template", params.communicationTemplateId);
      if (!isDeliveryModeAvailable(deliveryMode, template.channel)) {
        throw new RuleError("unavailableDeliveryMode");
      }
      if (deliveryMode === "AUTOMATIC" && automaticTemplateProblem(template)) {
        throw new RuleError("automaticTemplate");
      }
    }
    if (armId) {
      const [arm] = await tx
        .select({ id: studyArms.id })
        .from(studyArms)
        .where(and(eq(studyArms.id, armId), eq(studyArms.studyId, params.studyId)))
        .limit(1);
      if (!arm) throw new NotFoundError("study_arm", armId);
    }
    if (sessionTemplateId) {
      const [tpl] = await tx
        .select({ id: sessionTemplates.id })
        .from(sessionTemplates)
        .where(
          and(eq(sessionTemplates.id, sessionTemplateId), eq(sessionTemplates.studyId, params.studyId)),
        )
        .limit(1);
      if (!tpl) throw new NotFoundError("session_template", sessionTemplateId);
    }

    const [existing] = await tx
      .select({ id: automationRules.id })
      .from(automationRules)
      .where(and(eq(automationRules.studyId, params.studyId), eq(automationRules.key, key)))
      .limit(1);
    if (existing) throw new RuleError("duplicateKey");

    const [created] = await tx
      .insert(automationRules)
      .values({
        studyId: params.studyId,
        key,
        nameEs: params.nameEs.trim(),
        eventType: params.eventType,
        actionKind: params.actionKind,
        offsetMinutes: params.offsetMinutes,
        deliveryMode,
        communicationTemplateId:
          params.actionKind === "MESSAGE" ? (params.communicationTemplateId ?? null) : null,
        taskTitleEs: params.actionKind === "TASK" ? (params.taskTitleEs?.trim() ?? null) : null,
        taskPriority: params.taskPriority ?? "NORMAL",
        alertKind: params.actionKind === "ALERT" ? (params.alertKind ?? null) : null,
        conditionsJson: params.conditions ?? {},
        armId,
        sessionTemplateId,
      })
      .returning({ id: automationRules.id });

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "automation_rule.created",
      entityType: "automation_rule",
      entityId: created.id,
      // A rule is configuration: the whole shape is safe to snapshot, and this
      // is the row a reviewer will want to see the history of.
      after: {
        key,
        eventType: params.eventType,
        actionKind: params.actionKind,
        offsetMinutes: params.offsetMinutes,
        deliveryMode,
        conditions: params.conditions ?? {},
        armId,
        sessionTemplateId,
      },
    });

    return created.id;
  });
}

export async function setRuleActive(params: {
  studyId: string;
  ruleId: string;
  actorId: string;
  active: boolean;
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: automationRules.id, key: automationRules.key, active: automationRules.active })
      .from(automationRules)
      .where(and(eq(automationRules.id, params.ruleId), eq(automationRules.studyId, params.studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("automation_rule", params.ruleId);

    await tx
      .update(automationRules)
      .set({ active: params.active })
      .where(eq(automationRules.id, params.ruleId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: params.active ? "automation_rule.activated" : "automation_rule.deactivated",
      entityType: "automation_rule",
      entityId: params.ruleId,
      before: { active: current.active },
      after: { active: params.active, key: current.key },
    });
  });
}
