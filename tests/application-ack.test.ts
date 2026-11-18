import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D-151: the "we have your application" email goes out right after the public
 * form, not at the next daily cron. These pin the shape of that path, since it
 * needs a database and the mail provider to run for real.
 */
const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

describe("automatic email right after an application", () => {
  const action = read("src", "app", "(public)", "clearlight", "participar", "actions.ts");
  const automation = read("src", "services", "automation.ts");

  it("the public form sends the event's automatic emails from after(), not inline", () => {
    expect(action).toMatch(/import \{ after \} from "next\/server"/);
    expect(action).toMatch(/after\(async \(\) => \{\s*try \{\s*await processAutomaticActionsForEvent\(/);
  });

  it("only AUTOMATIC messages that are already due, for that one event", () => {
    const fn = automation.slice(automation.indexOf("export async function processAutomaticActionsForEvent"));
    const body = fn.slice(0, fn.indexOf("return runActions"));
    expect(body).toContain("eq(scheduledActions.eventId, params.eventId)");
    expect(body).toContain('eq(scheduledActions.status, "PENDING")');
    expect(body).toContain('eq(scheduledActions.actionKind, "MESSAGE")');
    expect(body).toContain('eq(scheduledActions.deliveryMode, "AUTOMATIC")');
    expect(body).toContain("lte(scheduledActions.scheduledFor, now)");
  });

  it("goes through the same per-action path as the cron (claim, send, audit)", () => {
    expect(automation).toMatch(/processDueActions[\s\S]*return runActions\(due, now\)/);
    expect(automation).toMatch(/async function runActions[\s\S]*processOne\(action, now\)/);
  });
});
