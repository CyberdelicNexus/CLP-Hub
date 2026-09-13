import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/config/env";
import { getDb } from "@/db/client";
import { studies } from "@/db/schema";
import { logger } from "@/lib/logger";
import { processDueActions, runSweeps } from "@/services/automation";

/**
 * The scheduled-action processor (Phase 8).
 *
 * Invoked by Vercel Cron (docs/automations.md). Two jobs, in this order:
 *
 * 1. Work through actions that have come due — re-check each against the state
 *    as it is NOW, and either PREPARE it or SKIP it with the unmet condition
 *    recorded.
 * 2. Sweep for operational anomalies and raise alerts, deduplicated by subject.
 *
 * IT SENDS NOTHING. There is no outbound call in this file, in the service it
 * calls, or anywhere in this repository. A message that passes its re-check
 * becomes READY and appears in the team's queue; a person copies it and sends it
 * themselves (D-004, D-039, D-043). `tests/automation.test.ts` asserts the
 * absence over this file rather than trusting it.
 *
 * It is safe to run twice. Materialisation is unique per (rule, event), alerts
 * are deduplicated per subject, and an action is only picked up while PENDING.
 */

/** Never prerendered, never cached: it reads and writes live state. */
export const dynamic = "force-dynamic";

/**
 * A single run's ceiling.
 *
 * A cap rather than a full drain, because a backlog after an outage should be
 * worked through over several ticks instead of in one request that times out
 * halfway and leaves the queue in an unknown state. What is left stays PENDING
 * and keeps its original `scheduledFor`, so nothing is lost and lateness stays
 * visible.
 */
const ACTIONS_PER_RUN = 200;

/**
 * Constant-time-ish comparison of the shared secret.
 *
 * Not because a timing attack on a cron endpoint is likely, but because the
 * cheap version of this check is the one people copy into the next endpoint.
 */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function authorize(request: NextRequest): { ok: true } | { ok: false; status: number } {
  const env = getEnv();

  // Unset means closed. An unconfigured deployment must not expose a processor
  // that writes to every study, so the absence of a secret is a refusal rather
  // than a skipped check.
  if (!env.CRON_SECRET) return { ok: false, status: 503 };

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !secretMatches(token, env.CRON_SECRET)) return { ok: false, status: 401 };

  return { ok: true };
}

export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    // Nothing about why. A 401 that explains itself is a 401 that helps.
    logger.warn({ event: "processor.refused", status: auth.status }, "processor refused");
    return NextResponse.json({ error: "refused" }, { status: auth.status });
  }

  const now = new Date();
  const db = getDb();

  // Every study that is not a draft. A paused study still has headsets out and
  // reminders already scheduled; freezing its queue would hide work rather than
  // stop it.
  const active = await db
    .select({ id: studies.id, code: studies.code })
    .from(studies)
    .where(eq(studies.status, "ACTIVE"));

  const results: Record<string, unknown>[] = [];

  for (const study of active) {
    try {
      const processed = await processDueActions({
        studyId: study.id,
        now,
        limit: ACTIONS_PER_RUN,
      });
      const swept = await runSweeps({ studyId: study.id, now });
      results.push({ study: study.code, ...processed, alertsRaised: swept.raised });
    } catch (err) {
      // One study's bad configuration must not stop the others.
      logger.error(
        {
          event: "processor.study.failed",
          study: study.code,
          err: err instanceof Error ? err.message : String(err),
        },
        "processor failed for study",
      );
      results.push({ study: study.code, error: true });
    }
  }

  logger.info({ event: "processor.run", studies: results.length }, "processor run");

  // Counts and study codes only. No participant code, no template body, no
  // rendered message — this response ends up in a cron provider's log.
  return NextResponse.json({ ranAt: now.toISOString(), results });
}

/**
 * GET is refused even with the right secret.
 *
 * This endpoint changes state. A GET that did would be retried by a browser, a
 * prefetch or a link checker, and the one property worth protecting here is that
 * it only runs when something meant to run it.
 */
export async function GET() {
  return NextResponse.json({ error: "method" }, { status: 405 });
}
