import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cohortStaff, cohorts } from "@/db/schema";
import type { Permission } from "@/domain/permissions";

/**
 * Cohort-level narrowing.
 *
 * Most staff see every cohort in their study. Facilitators see only the cohorts
 * they actually run. That distinction is expressed as a permission —
 * `cohorts.read.all` — rather than a role check, so feature code never branches
 * on role names (non-negotiable 8) and a future role gets the right behaviour by
 * being granted the key or not.
 *
 * `null` means "no narrowing applies"; an array means "exactly these cohorts",
 * and an empty array legitimately means "none", which callers must treat as a
 * real answer rather than as missing data.
 */
export type CohortScope = string[] | null;

export function isUnrestricted(scope: CohortScope): scope is null {
  return scope === null;
}

/** Resolve the scope for a user in a study. Called once per request. */
export async function resolveCohortScope(params: {
  studyId: string;
  userId: string;
  permissions: ReadonlySet<Permission>;
}): Promise<CohortScope> {
  if (params.permissions.has("cohorts.read.all")) return null;

  const rows = await getDb()
    .select({ cohortId: cohortStaff.cohortId })
    .from(cohortStaff)
    .innerJoin(cohorts, eq(cohorts.id, cohortStaff.cohortId))
    .where(
      and(
        eq(cohortStaff.userId, params.userId),
        eq(cohorts.studyId, params.studyId),
        isNull(cohortStaff.revokedAt),
      ),
    );

  return rows.map((r) => r.cohortId);
}
