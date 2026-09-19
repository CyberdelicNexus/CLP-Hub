/**
 * Study-scoped staff roles. A user may hold several roles within one study
 * and different roles across studies. Permissions are derived in
 * ./permissions.ts; roles carry no behaviour themselves.
 */
export const STAFF_ROLES = [
  "ADMIN",
  "STUDY_MANAGER",
  "FACILITATOR",
  "RESEARCHER",
  "LOGISTICS",
  // Added 2026-09-19 for two real team members ("Supervisor" of facilitators
  // and sessions) who didn't fit any existing role — see permissions.ts for
  // the permission set and its reasoning.
  "SUPERVISOR",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}
