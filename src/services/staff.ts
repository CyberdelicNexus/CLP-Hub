import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import { userRoles, users } from "@/db/schema";
import type { Locale } from "@/domain/locale";
import type { StaffRole } from "@/domain/roles";

/**
 * Staff profiles and study membership.
 *
 * WHAT THIS SERVICE CANNOT DO: create a login. Staff accounts live in Supabase
 * Auth, and an application that could mint one would be an account-creation
 * surface sitting behind a single compromised session. Someone is invited
 * through Supabase, appears here once they exist, and is then GRANTED a role in
 * a study — which is the part that is this application's business, and the part
 * that is audited.
 *
 * A grant is never deleted. Revoking stamps `revokedAt`, so "who could see this
 * in March" stays answerable — the same reason consents are superseded rather
 * than overwritten.
 */

/**
 * Staff profile operations. Example of the service pattern:
 * one transaction, the change and its audit row together.
 */
export async function updatePreferredLocale(userId: string, locale: Locale): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select({ preferredLocale: users.preferredLocale }).from(users).where(eq(users.id, userId));
    if (!before || before.preferredLocale === locale) return;

    await tx.update(users).set({ preferredLocale: locale }).where(eq(users.id, userId));
    await recordAuditEvent(tx, {
      actor: { type: "STAFF", id: userId },
      action: "user.locale_changed",
      entityType: "user",
      entityId: userId,
      before: { preferredLocale: before.preferredLocale },
      after: { preferredLocale: locale },
    });
  });
}

export interface StudyMember {
  userId: string;
  displayName: string;
  email: string;
  active: boolean;
  /** Active grants in this study. A person may hold more than one. */
  roles: StaffRole[];
  /** The id of each active grant, so one role can be revoked without the others. */
  grants: { id: string; role: StaffRole; grantedAt: Date }[];
}

/**
 * Everyone with a live role in this study.
 *
 * Grouped by person rather than listed per grant, because "who is on this study
 * and what can they do" is the question, and a list with the same name three
 * times answers it badly.
 */
export async function listStudyMembers(studyId: string): Promise<StudyMember[]> {
  const rows = await getDb()
    .select({
      grantId: userRoles.id,
      role: userRoles.role,
      grantedAt: userRoles.grantedAt,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      active: users.active,
    })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.studyId, studyId), isNull(userRoles.revokedAt)))
    .orderBy(asc(users.displayName), asc(userRoles.role));

  const byUser = new Map<string, StudyMember>();
  for (const row of rows) {
    const existing = byUser.get(row.userId);
    const grant = { id: row.grantId, role: row.role, grantedAt: row.grantedAt };
    if (existing) {
      existing.roles.push(row.role);
      existing.grants.push(grant);
    } else {
      byUser.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        active: row.active,
        roles: [row.role],
        grants: [grant],
      });
    }
  }
  return [...byUser.values()];
}

/**
 * Staff who can be assigned work in this study.
 *
 * Name and id only — no email, no role. It feeds an "assign to" menu, and a
 * dropdown is not a place to publish the team's addresses.
 */
export async function listAssignableStaff(
  studyId: string,
): Promise<{ id: string; displayName: string }[]> {
  const rows = await getDb()
    .selectDistinct({ id: users.id, displayName: users.displayName })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(
      and(eq(userRoles.studyId, studyId), isNull(userRoles.revokedAt), eq(users.active, true)),
    )
    .orderBy(asc(users.displayName));
  return rows;
}

/** Staff accounts that exist but hold no live role in this study. */
export async function listStaffWithoutRole(
  studyId: string,
): Promise<{ id: string; displayName: string; email: string }[]> {
  const members = await listStudyMembers(studyId);
  const held = new Set(members.map((m) => m.userId));
  const all = await getDb()
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.displayName));
  return all.filter((u) => !held.has(u.id));
}

export class DuplicateGrantError extends Error {
  constructor() {
    super("That person already holds this role in this study");
    this.name = "DuplicateGrantError";
  }
}

export class GrantNotFoundError extends Error {
  constructor(id: string) {
    super(`Grant ${id} not found in this study`);
    this.name = "GrantNotFoundError";
  }
}

/**
 * Give someone a role in this study.
 *
 * A permission-relevant change, so it is audited with the role on the row
 * (CLAUDE.md rule 5). Roles are not exclusive: someone can be a facilitator and
 * handle logistics, and forcing a single role would push the team into granting
 * the broader of the two.
 */
export async function grantRole(params: {
  studyId: string;
  actorId: string;
  userId: string;
  role: StaffRole;
}): Promise<string> {
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: users.id, displayName: users.displayName, active: users.active })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);
    if (!target) throw new GrantNotFoundError(params.userId);

    const [existing] = await tx
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.studyId, params.studyId),
          eq(userRoles.userId, params.userId),
          eq(userRoles.role, params.role),
          isNull(userRoles.revokedAt),
        ),
      )
      .limit(1);
    if (existing) throw new DuplicateGrantError();

    const [created] = await tx
      .insert(userRoles)
      .values({
        studyId: params.studyId,
        userId: params.userId,
        role: params.role,
        grantedBy: params.actorId,
      })
      .returning({ id: userRoles.id });

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "user_role.granted",
      entityType: "user_role",
      entityId: created.id,
      after: { userId: params.userId, role: params.role, displayName: target.displayName },
    });

    return created.id;
  });
}

/**
 * Take a role away.
 *
 * The row stays and gets a `revokedAt`, so the membership history survives. An
 * audit log that can say what someone could do last March is worth more than a
 * tidy table.
 */
export async function revokeRole(params: {
  studyId: string;
  actorId: string;
  grantId: string;
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: userRoles.id,
        userId: userRoles.userId,
        role: userRoles.role,
        revokedAt: userRoles.revokedAt,
      })
      .from(userRoles)
      .where(and(eq(userRoles.id, params.grantId), eq(userRoles.studyId, params.studyId)))
      .limit(1);
    if (!current) throw new GrantNotFoundError(params.grantId);
    if (current.revokedAt) return;

    await tx
      .update(userRoles)
      .set({ revokedAt: new Date(), revokedBy: params.actorId })
      .where(eq(userRoles.id, params.grantId));

    await recordAuditEvent(tx, {
      studyId: params.studyId,
      actor: { type: "STAFF", id: params.actorId },
      action: "user_role.revoked",
      entityType: "user_role",
      entityId: params.grantId,
      before: { userId: current.userId, role: current.role },
      after: { revoked: true },
    });
  });
}
