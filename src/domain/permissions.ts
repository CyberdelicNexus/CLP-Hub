import type { StaffRole } from "./roles";

/**
 * Permission keys are the single source of truth for authorization.
 * UI visibility, server actions and service functions all check these.
 * Add a key here first; never encode role names inside feature code.
 *
 * Naming: <area>.<capability>
 * "*.read" is list/detail access, "*.manage" is create/update,
 * more specific keys gate sensitive sub-data (e.g. participants.contact.read).
 */
export const PERMISSIONS = [
  // Study administration
  "study.settings.manage",
  "team.read",
  "team.manage",
  "audit.read",

  // Recruitment (Phase 1)
  "applications.read",
  "applications.manage",

  // Participants (Phase 2)
  "participants.read",
  "participants.manage",
  "participants.contact.read",
  "screening.read",
  "screening.manage",
  "consent.read",
  "consent.manage",
  "randomization.read",

  // Cohorts and program (Phase 3)
  "cohorts.read",
  "cohorts.manage",
  "sessions.read",
  "sessions.manage",
  "attendance.manage",

  // Content (Phase 5)
  "content.read",
  "content.manage",
  "content.publish",

  // VR logistics (Phase 6)
  "logistics.read",
  "logistics.manage",

  // Communications (Phase 7)
  "communications.read",
  "communications.manage",
  "communications.approve",

  // Operations (Phase 8)
  "tasks.read",
  "tasks.manage",
  "alerts.read",

  // Research
  "exports.research",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/**
 * Role → permission matrix. Least privilege by default.
 * Documented in docs/permissions.md; keep both in sync.
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  ADMIN: ALL,

  STUDY_MANAGER: [
    "team.read",
    "audit.read",
    "applications.read",
    "applications.manage",
    "participants.read",
    "participants.manage",
    "participants.contact.read",
    "screening.read",
    "screening.manage",
    "consent.read",
    "consent.manage",
    "randomization.read",
    "cohorts.read",
    "cohorts.manage",
    "sessions.read",
    "sessions.manage",
    "attendance.manage",
    "content.read",
    "content.manage",
    "content.publish",
    "logistics.read",
    "logistics.manage",
    "communications.read",
    "communications.manage",
    "communications.approve",
    "tasks.read",
    "tasks.manage",
    "alerts.read",
  ],

  // Facilitators see their cohorts and sessions and limited operational
  // participant data. Cohort-level scoping (cohort_staff) arrives in Phase 3.
  FACILITATOR: [
    "participants.read",
    "cohorts.read",
    "sessions.read",
    "sessions.manage",
    "attendance.manage",
    "content.read",
    "communications.read",
    "tasks.read",
    "tasks.manage",
    "alerts.read",
  ],

  // Researchers see research-status information, never contact data.
  RESEARCHER: [
    "participants.read",
    "screening.read",
    "consent.read",
    "randomization.read",
    "cohorts.read",
    "sessions.read",
    "content.read",
    "exports.research",
  ],

  // Logistics needs shipping and contact data; no screening or consent detail.
  LOGISTICS: [
    "participants.read",
    "participants.contact.read",
    "cohorts.read",
    "logistics.read",
    "logistics.manage",
    "tasks.read",
    "tasks.manage",
    "alerts.read",
  ],
};

export function permissionsForRoles(roles: readonly StaffRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role]) set.add(p);
  }
  return set;
}

export function hasPermission(roles: readonly StaffRole[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}
