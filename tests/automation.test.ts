import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_KINDS,
  ALERT_KINDS,
  ALERT_SEVERITY_BY_KIND,
  CAN_DELIVER_WITHOUT_A_PERSON,
  CONDITION_KEYS,
  DELIVERY_MODES,
  EVENT_TYPES,
  OFFSET_MINUTES_MAX,
  OFFSET_MINUTES_MIN,
  SCHEDULED_ACTION_STATUSES,
  TASK_PRIORITIES,
  alertDedupeKey,
  decide,
  describeOffset,
  invalidatesPriorSchedule,
  isDeliveryModeAvailable,
  isDue,
  isOverdue,
  isValidOffset,
  parseConditions,
  scheduledFor,
  severityFor,
  unmetConditions,
  type ConditionFacts,
  type RuleConditions,
} from "@/domain/automation";
import { hasPermission } from "@/domain/permissions";

const SOURCES = [
  "src/domain/automation.ts",
  "src/services/automation.ts",
  "src/app/api/internal/process-scheduled-actions/route.ts",
] as const;

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const facts = (over: Partial<ConditionFacts> = {}): ConditionFacts => ({
  participantActive: true,
  participantEnrolled: true,
  consentActive: true,
  cohortActive: true,
  sessionScheduled: true,
  attendanceNotRecorded: true,
  deviceOut: true,
  vrNotReady: false,
  ...over,
});

const minute = 60_000;

describe("nothing sends a message", () => {
  /**
   * Phase 8 is the phase where a send would creep in: a processor that walks a
   * queue of due reminders is one HTTP client away from being a mailer. The
   * guarantee is an absolute — "no send path exists" — for the same reason D-018
   * makes randomization an absolute rather than a set of guards.
   */
  it("has no HTTP client, credential or endpoint anywhere in the feature", () => {
    for (const rel of SOURCES) {
      const source = read(rel);
      expect(source, rel).not.toMatch(/\bfetch\s*\(/);
      expect(source, rel).not.toMatch(/axios|XMLHttpRequest|nodemailer|twilio|sendgrid|resend/i);
      expect(source, rel).not.toMatch(/api[_-]?key|apiToken|accessToken|smtp/i);
      expect(source, rel).not.toMatch(/https?:\/\/(?!\S*example\.com)[a-z]/i);
    }
  });

  it("states the absence as a constant, not as a hope", () => {
    expect(CAN_DELIVER_WITHOUT_A_PERSON).toBe(false);
  });

  /**
   * AUTOMATIC stays in the vocabulary because docs/automations.md designed for
   * it. What must never happen is a rule stored as AUTOMATIC: the team would
   * believe their reminders were going out on their own.
   */
  it("refuses AUTOMATIC delivery while nothing can deliver", () => {
    expect(DELIVERY_MODES).toContain("AUTOMATIC");
    expect(isDeliveryModeAvailable("AUTOMATIC")).toBe(false);
    expect(isDeliveryModeAvailable("MANUAL")).toBe(true);
    expect(isDeliveryModeAvailable("APPROVAL_REQUIRED")).toBe(true);
  });

  it("refuses it at the database too, not only in code", () => {
    const migration = read("supabase/migrations/0015_automation.sql");
    expect(migration).toMatch(/automation_rules_no_automatic_delivery/);
    expect(migration).toMatch(/delivery_mode <> 'AUTOMATIC'/);
  });

  /**
   * A status the application cannot observe would be a claim, not a record —
   * the same argument `communication_status` makes by having only SENT and
   * SKIPPED. Here the system never even gets to SENT: READY is the end of what
   * it can do alone, and DONE is a person's statement.
   */
  it("offers no status that would mean the system delivered something", () => {
    expect(SCHEDULED_ACTION_STATUSES).not.toContain("SENT");
    expect(SCHEDULED_ACTION_STATUSES).not.toContain("DELIVERED");
    expect(SCHEDULED_ACTION_STATUSES).toContain("READY");
  });

  it("refuses an unavailable delivery mode before it looks at anything else", () => {
    const verdict = decide({
      conditions: { participantActive: true },
      facts: facts({ participantActive: false }),
      deliveryMode: "AUTOMATIC",
    });
    // Not "skip". The mode is wrong regardless of whether the conditions hold,
    // and reporting it as a skip would hide a misconfiguration as a normal day.
    expect(verdict).toEqual({ decision: "refuse", reason: "unavailableDeliveryMode" });
  });
});

describe("what a rule may test", () => {
  /**
   * The closed allow-list is the whole safety model, exactly as it is for
   * template variables. A rule that could read an arbitrary column would
   * eventually branch on a screening result, which this application must never
   * do (CLAUDE.md rule 3).
   */
  it("exposes nothing clinical and no determination", () => {
    const forbidden = [
      "eligibility",
      "eligible",
      "ineligible",
      "screening",
      "result",
      "arm",
      "allocation",
      "randomiz",
      "diagnos",
      "score",
      "email",
      "phone",
      "name",
    ];
    for (const key of CONDITION_KEYS) {
      for (const word of forbidden) {
        expect(key.toLowerCase(), key).not.toContain(word);
      }
    }
  });

  it("tests only whether a consent exists, never what it granted", () => {
    expect(CONDITION_KEYS).toContain("consentActive");
    expect(CONDITION_KEYS.join(" ")).not.toMatch(/scope/i);
  });

  /**
   * A row written by an older version, or edited by hand, must not make the
   * processor throw on every run — but it must not quietly take effect either.
   */
  it("drops unknown condition keys instead of honouring or rejecting them", () => {
    const { conditions, dropped } = parseConditions({
      participantActive: true,
      eligibilityStatus: "ELIGIBLE",
      sessionScheduled: "yes",
    });
    expect(conditions).toEqual({ participantActive: true });
    expect(dropped.sort()).toEqual(["eligibilityStatus", "sessionScheduled"]);
  });

  it("survives a null, a string and an array in the column", () => {
    expect(parseConditions(null).conditions).toEqual({});
    expect(parseConditions("participantActive").conditions).toEqual({});
    expect(parseConditions(["participantActive"]).conditions).toEqual({});
  });

  it("ignores a condition the rule did not set", () => {
    // Absent means "do not care", not "must be false".
    expect(unmetConditions({}, facts({ participantActive: false }))).toEqual([]);
  });

  it("reports every unmet condition, not just the first", () => {
    const conditions: RuleConditions = {
      participantActive: true,
      sessionScheduled: true,
      consentActive: true,
    };
    const unmet = unmetConditions(
      conditions,
      facts({ participantActive: false, sessionScheduled: false }),
    );
    // "They withdrew AND the session was cancelled" is more use to whoever
    // reads the log than a row that stops at the first problem.
    expect(unmet.sort()).toEqual(["participantActive", "sessionScheduled"]);
  });

  it("can require a condition to be false", () => {
    expect(unmetConditions({ deviceOut: false }, facts({ deviceOut: true }))).toEqual(["deviceOut"]);
    expect(unmetConditions({ deviceOut: false }, facts({ deviceOut: false }))).toEqual([]);
  });
});

describe("the decision is taken when the action is due", () => {
  /**
   * THE RULE THAT MATTERS MOST (docs/automations.md, "Execution rule"). A
   * reminder scheduled on Monday for a participant who withdrew on Tuesday is
   * skipped, with the reason recorded, and never prepared.
   */
  it("skips a reminder for someone who has left, and names why", () => {
    const verdict = decide({
      conditions: { participantActive: true },
      facts: facts({ participantActive: false }),
      deliveryMode: "MANUAL",
    });
    expect(verdict).toEqual({ decision: "skip", unmet: ["participantActive"] });
  });

  it("skips a session reminder for a session that was cancelled", () => {
    const verdict = decide({
      conditions: { sessionScheduled: true },
      facts: facts({ sessionScheduled: false }),
      deliveryMode: "MANUAL",
    });
    expect(verdict).toEqual({ decision: "skip", unmet: ["sessionScheduled"] });
  });

  it("prepares — and only prepares — when everything still holds", () => {
    const verdict = decide({
      conditions: { participantActive: true, sessionScheduled: true },
      facts: facts(),
      deliveryMode: "MANUAL",
    });
    expect(verdict).toEqual({ decision: "prepare" });
    // There is no third decision that means "sent".
    expect(Object.values(verdict)).not.toContain("deliver");
  });

  it("takes the decision from the facts it is given, never from a snapshot", () => {
    const source = read("src/services/automation.ts");
    // `decide` is called with freshly gathered facts. If someone ever passes the
    // stored snapshot instead, this is the line that has to change.
    expect(source).toMatch(/const facts = await gatherFacts\(/);
    expect(source).toMatch(/facts,\s*\n\s*deliveryMode/);
  });
});

describe("when an action fires", () => {
  it("offsets from the anchor, not from when the event was recorded", () => {
    const sessionStart = new Date("2026-10-01T18:00:00.000Z");
    // "24 h before the session", expressed as a rule offset of -1440 minutes.
    expect(scheduledFor(sessionStart, -1440).toISOString()).toBe("2026-09-30T18:00:00.000Z");
    // "immediately after", expressed as 0.
    expect(scheduledFor(sessionStart, 0).getTime()).toBe(sessionStart.getTime());
    expect(scheduledFor(sessionStart, 90).getTime()).toBe(sessionStart.getTime() + 90 * minute);
  });

  it("bounds the offset at about a year either way", () => {
    expect(isValidOffset(-1440)).toBe(true);
    expect(isValidOffset(0)).toBe(true);
    expect(isValidOffset(OFFSET_MINUTES_MIN)).toBe(true);
    expect(isValidOffset(OFFSET_MINUTES_MAX)).toBe(true);
    expect(isValidOffset(OFFSET_MINUTES_MIN - 1)).toBe(false);
    expect(isValidOffset(OFFSET_MINUTES_MAX + 1)).toBe(false);
    expect(isValidOffset(1.5)).toBe(false);
  });

  /**
   * No grace window, deliberately. An action that should have been prepared on
   * Friday and was not, because the processor was down, is still prepared on
   * Monday with its original time visible. Dropping it would hide an outage.
   */
  it("treats a long-overdue action as due, not as expired", () => {
    const when = new Date("2026-09-01T10:00:00.000Z");
    expect(isDue(when, new Date("2026-09-01T10:00:00.000Z"))).toBe(true);
    expect(isDue(when, new Date("2026-09-30T10:00:00.000Z"))).toBe(true);
    expect(isDue(when, new Date("2026-09-01T09:59:59.000Z"))).toBe(false);
  });

  /**
   * Rescheduling recreates rather than edits. Editing in place would rewrite a
   * row whose audit trail says it was scheduled for a different time.
   */
  it("knows which events invalidate work already planned", () => {
    expect(invalidatesPriorSchedule("SESSION_RESCHEDULED")).toBe(true);
    expect(invalidatesPriorSchedule("SESSION_CANCELLED")).toBe(true);
    expect(invalidatesPriorSchedule("PARTICIPANT_WITHDRAWN")).toBe(true);
    expect(invalidatesPriorSchedule("SESSION_SCHEDULED")).toBe(false);
    expect(invalidatesPriorSchedule("APPLICATION_SUBMITTED")).toBe(false);
  });
});

describe("events", () => {
  /** Every one is something the team did or something that was booked. */
  it("names no determination and no clinical fact", () => {
    for (const event of EVENT_TYPES) {
      expect(event).not.toMatch(/ELIGIBLE|INELIGIBLE|RESULT|SCORE|DIAGNOS/);
    }
    // The fact that a determination was made is an event; what it was is not.
    expect(EVENT_TYPES).toContain("ELIGIBILITY_DETERMINED");
  });

  it("carries no participant identity into the event log", () => {
    const service = read("src/services/automation.ts");
    // Events are written with codes. `fullName` and contact columns are not
    // imported here at all, so a metadata blob cannot accidentally carry one.
    expect(service).not.toMatch(/participantContacts|fullName/);
  });
});

describe("alerts", () => {
  it("gives every kind a severity", () => {
    for (const kind of ALERT_KINDS) {
      expect(ALERT_SEVERITY_BY_KIND[kind], kind).toBeDefined();
      expect(severityFor(kind)).toBe(ALERT_SEVERITY_BY_KIND[kind]);
    }
  });

  it("treats an allocation without consent as the most serious thing it knows", () => {
    expect(severityFor("ALLOCATION_WITHOUT_CONSENT")).toBe("CRITICAL");
    expect(severityFor("SCHEDULED_ACTION_FAILED")).toBe("CRITICAL");
  });

  /**
   * The key carries no date on purpose: a headset still overdue tomorrow is the
   * same problem, and a key that moved daily would defeat the deduplication it
   * exists for — the alerts screen would become the one people scroll past.
   */
  it("deduplicates by subject, and the key does not move with time", () => {
    const key = alertDedupeKey("DEVICE_RETURN_OVERDUE", { kind: "DEVICE", id: "abc" });
    expect(key).toBe("DEVICE_RETURN_OVERDUE:DEVICE:abc");
    expect(alertDedupeKey("DEVICE_RETURN_OVERDUE", { kind: "DEVICE", id: "abc" })).toBe(key);
    expect(key).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("distinguishes the same problem on two different subjects", () => {
    expect(alertDedupeKey("COHORT_UNDERSIZED", { kind: "COHORT", id: "a" })).not.toBe(
      alertDedupeKey("COHORT_UNDERSIZED", { kind: "COHORT", id: "b" }),
    );
  });

  /**
   * An exclusion count is about the study. Naming one of three excluded people
   * on a shared screen would be worse than naming none.
   */
  it("raises the exclusion sweep against the study, not against a person", () => {
    const service = read("src/services/automation.ts");
    expect(service).toMatch(/bump\("EXCLUSION_WITHOUT_REASON", \{ kind: "STUDY" \}/);
  });

  it("never resolves its own alerts", () => {
    const service = read("src/services/automation.ts");
    // `resolveAlert` takes an actorId and audits as STAFF. A sweep that closed
    // its own alerts would erase that something was wrong for two weeks.
    expect(service).toMatch(/export async function resolveAlert\(params: \{[\s\S]*?actorId: string/);
    expect(service).not.toMatch(/status: "RESOLVED"[\s\S]{0,120}type: "SYSTEM"/);
  });
});

describe("sweeps hardcode no trial specifics", () => {
  /**
   * Non-negotiable 6. A check like "warn 48 h before the session if the headset
   * is not ready" has this trial's number in it, so it belongs in a rule row —
   * event SESSION_SCHEDULED, a negative offset, action ALERT — not in a sweep.
   */
  it("contains no bare duration or group-size constant", () => {
    const service = read("src/services/automation.ts");
    const sweeps = service.slice(service.indexOf("export async function runSweeps"));
    const body = sweeps.slice(0, sweeps.indexOf("\n// ---"));
    // Strip comments before looking for numbers: the prose explains thresholds
    // precisely so the code does not have to contain them.
    const code = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\b(?:24|48|72)\s*\*\s*60/);
    expect(code).not.toMatch(/\b(?:6|7|8)\s*[<>]=?\s*/);
    expect(code).not.toMatch(/hours?\s*[:=]\s*\d/i);
  });

  it("reads the cohort bounds from the row rather than assuming any", () => {
    const service = read("src/services/automation.ts");
    expect(service).toMatch(/minSize: cohorts\.minSize/);
    expect(service).toMatch(/maxSize: cohorts\.maxSize/);
  });
});

describe("tasks", () => {
  it("keeps a scale the team can actually tell apart", () => {
    expect([...TASK_PRIORITIES]).toEqual(["LOW", "NORMAL", "HIGH"]);
  });

  it("counts only open tasks with a past date as overdue", () => {
    const now = new Date("2026-09-13T12:00:00.000Z");
    const yesterday = new Date("2026-09-12T12:00:00.000Z");
    const tomorrow = new Date("2026-09-14T12:00:00.000Z");
    expect(isOverdue({ dueAt: yesterday, status: "OPEN" }, now)).toBe(true);
    expect(isOverdue({ dueAt: tomorrow, status: "OPEN" }, now)).toBe(false);
    // A task with no date is not overdue, and a closed one never is.
    expect(isOverdue({ dueAt: null, status: "OPEN" }, now)).toBe(false);
    expect(isOverdue({ dueAt: yesterday, status: "DONE" }, now)).toBe(false);
    expect(isOverdue({ dueAt: yesterday, status: "CANCELLED" }, now)).toBe(false);
  });

  it("sorts a task with no due date last, not first", () => {
    const service = read("src/services/automation.ts");
    // "No deadline" is not "most urgent".
    expect(service).toMatch(/dueAt\} asc nulls last/);
  });
});

describe("the processor endpoint", () => {
  const route = read("src/app/api/internal/process-scheduled-actions/route.ts");

  it("is closed when no secret is configured", () => {
    expect(route).toMatch(/if \(!env\.CRON_SECRET\) return \{ ok: false, status: 503 \}/);
  });

  it("refuses GET, because it changes state", () => {
    expect(route).toMatch(/export async function GET\(\)/);
    expect(route).toMatch(/status: 405/);
  });

  it("returns counts and study codes, never message content", () => {
    expect(route).not.toMatch(/templateBody|bodyEs|participantCode|renderTemplate/);
  });
});

describe("the prepared queue is addressable", () => {
  const service = read("src/services/automation.ts");
  const page = read("src/app/(team)/equipo/(app)/comunicaciones/page.tsx");

  /**
   * A session reminder's SUBJECT is the session — that is what the rule anchors
   * on and what gets re-checked — but the message goes to that session's cohort
   * channel. Without resolving it, such an action would be prepared and then be
   * unaddressable, which is the same as not being prepared at all. Found by
   * running the pipeline against a real database rather than by reading it.
   */
  it("resolves a session action's cohort through the session", () => {
    expect(service).toMatch(
      /coalesce\(\$\{scheduledActions\.cohortId\}, \$\{cohortSessions\.cohortId\}\)/,
    );
    expect(service).toMatch(/targetCohortId: cohorts\.id/);
  });

  it("never builds a link it cannot address", () => {
    // `cohorte=null` in a URL is worse than no link: it looks like it works.
    expect(page).toMatch(/action\.targetCohortId/);
    expect(page).not.toMatch(/cohorte=\$\{action\.cohortId\}/);
  });

  /**
   * A skip is a person deciding NOT to send. The queue item should stay visible
   * rather than disappear as if the message had gone out.
   */
  it("closes a queue item only on a real send", () => {
    const actions = read("src/app/(team)/equipo/(app)/comunicaciones/actions.ts");
    expect(actions).toMatch(/parsed\.data\.actionId && parsed\.data\.status === "SENT"/);
  });
});

describe("permissions", () => {
  it("lets the roles that do the work see the queue", () => {
    expect(hasPermission(["FACILITATOR"], "tasks.read")).toBe(true);
    expect(hasPermission(["LOGISTICS"], "alerts.read")).toBe(true);
    expect(hasPermission(["STUDY_MANAGER"], "tasks.manage")).toBe(true);
  });

  /**
   * A researcher reads research state. Operational queues are not theirs, and
   * an alert naming a cohort that is under-recruited is not a research output.
   */
  it("keeps the researcher out of the operational queues", () => {
    expect(hasPermission(["RESEARCHER"], "tasks.read")).toBe(false);
    expect(hasPermission(["RESEARCHER"], "alerts.read")).toBe(false);
  });

  it("keeps rule configuration to whoever configures the study", () => {
    expect(hasPermission(["ADMIN"], "study.settings.manage")).toBe(true);
    expect(hasPermission(["FACILITATOR"], "study.settings.manage")).toBe(false);
    expect(hasPermission(["STUDY_MANAGER"], "study.settings.manage")).toBe(false);
  });
});

describe("the vocabulary matches the migration", () => {
  const migration = read("supabase/migrations/0015_automation.sql");

  it("declares every event type the domain knows", () => {
    for (const event of EVENT_TYPES) expect(migration, event).toContain(`'${event}'`);
  });

  it("declares every alert kind the domain knows", () => {
    for (const kind of ALERT_KINDS) expect(migration, kind).toContain(`'${kind}'`);
  });

  it("declares every action kind and scheduled-action status", () => {
    for (const kind of ACTION_KINDS) expect(migration, kind).toContain(`'${kind}'`);
    for (const status of SCHEDULED_ACTION_STATUSES) {
      expect(migration, status).toContain(`'${status}'`);
    }
  });

  it("makes one rule fire at most once per event", () => {
    // What makes an overlapping or retrying cron safe.
    expect(migration).toMatch(/scheduled_actions_rule_event_unique[\s\S]*?\(rule_id, event_id\)/);
  });
});

describe("an offset reads as a duration, not as a sum", () => {
  /**
   * Rules are stored in minutes because that is the only unit that expresses
   * every timing without rounding. Reading one back as "2880 min antes" makes
   * the person checking whether the rule is right do the arithmetic in their
   * head, on the screen where a mistake is expensive.
   */
  it("picks the largest unit that says it exactly", () => {
    expect(describeOffset(0)).toEqual({ direction: "same", unit: "minutes", value: 0 });
    expect(describeOffset(-2880)).toEqual({ direction: "before", unit: "days", value: 2 });
    expect(describeOffset(-1440)).toEqual({ direction: "before", unit: "days", value: 1 });
    expect(describeOffset(-120)).toEqual({ direction: "before", unit: "hours", value: 2 });
    expect(describeOffset(120)).toEqual({ direction: "after", unit: "hours", value: 2 });
  });

  /** Exactness beats tidiness: 90 minutes is not "1.5 h". */
  it("never rounds", () => {
    expect(describeOffset(-90)).toEqual({ direction: "before", unit: "minutes", value: 90 });
    // 1500 minutes IS exactly 25 hours, so hours is the exact reading — and
    // "25 horas antes" is still better than "1500 min antes".
    expect(describeOffset(-1500)).toEqual({ direction: "before", unit: "hours", value: 25 });
    expect(describeOffset(-1501)).toEqual({ direction: "before", unit: "minutes", value: 1501 });
    expect(describeOffset(45)).toEqual({ direction: "after", unit: "minutes", value: 45 });
  });

  it("carries the sign in the direction, never in the value", () => {
    for (const minutes of [-2880, -90, -1, 1, 90, 2880]) {
      expect(describeOffset(minutes).value).toBeGreaterThan(0);
    }
  });
});
