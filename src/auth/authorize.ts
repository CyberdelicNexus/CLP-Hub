import { hasPermission, type Permission } from "@/domain/permissions";
import type { StaffRole } from "@/domain/roles";

/** Minimal shape needed to authorize: the roles held in the active study. */
export interface AuthorizationSubject {
  roles: readonly StaffRole[];
  study: { id: string };
}

export class AuthorizationError extends Error {
  readonly permission: Permission;
  readonly studyId: string;
  constructor(permission: Permission, studyId: string) {
    super(`Missing permission "${permission}" in study ${studyId}`);
    this.name = "AuthorizationError";
    this.permission = permission;
    this.studyId = studyId;
  }
}

export function can(subject: AuthorizationSubject, permission: Permission): boolean {
  return hasPermission(subject.roles, permission);
}

/** Throw-on-failure guard for service functions and server actions. */
export function assertPermission(subject: AuthorizationSubject, permission: Permission): void {
  if (!can(subject, permission)) throw new AuthorizationError(permission, subject.study.id);
}
