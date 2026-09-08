import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { permissionsForRoles, type Permission } from "@/domain/permissions";
import type { StaffRole } from "@/domain/roles";
import type { StudyStatus } from "@/domain/study";
import { STUDY_COOKIE } from "@/i18n/cookies";
import { resolveCohortScope, type CohortScope } from "./cohort-scope";
import { resolveActiveStudyId } from "./resolve-study";
import { getStaffSession, type StaffSession } from "./session";

export interface StudyContext {
  session: StaffSession;
  study: { id: string; code: string; title: string; status: StudyStatus; timezone: string };
  /** Roles the staff member holds in the active study. */
  roles: StaffRole[];
  permissions: Set<Permission>;
  /**
   * Cohorts this caller may see, or null when no narrowing applies.
   * Resolved from cohort_staff for callers without `cohorts.read.all`.
   * An empty array means "assigned to none" and is a real answer.
   */
  cohortScope: CohortScope;
}

/**
 * The active study for this request. Every service call in the team area
 * receives this context; the study id is never taken from client input.
 * Returns null when unauthenticated or when the user has no memberships.
 */
export const getStudyContext = cache(async (): Promise<StudyContext | null> => {
  const session = await getStaffSession();
  if (!session) return null;

  const store = await cookies();
  const studyId = resolveActiveStudyId(session.memberships, store.get(STUDY_COOKIE)?.value);
  if (!studyId) return null;

  const rows = session.memberships.filter((m) => m.studyId === studyId);
  const roles = rows.map((m) => m.role);
  const first = rows[0];
  const permissions = permissionsForRoles(roles);
  const cohortScope = await resolveCohortScope({
    studyId: first.studyId,
    userId: session.userId,
    permissions,
  });

  return {
    session,
    study: {
      id: first.studyId,
      code: first.studyCode,
      title: first.studyTitle,
      status: first.studyStatus,
      timezone: first.studyTimezone,
    },
    roles,
    permissions,
    cohortScope,
  };
});
