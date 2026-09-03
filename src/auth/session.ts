import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { studies, userRoles, users } from "@/db/schema";
import type { Locale } from "@/domain/locale";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import type { StaffRole } from "@/domain/roles";
import type { StudyStatus } from "@/domain/study";
import { createSupabaseServerClient } from "./supabase/server";

export interface StaffMembership {
  studyId: string;
  studyCode: string;
  studyTitle: string;
  studyStatus: StudyStatus;
  studyTimezone: string;
  role: StaffRole;
}

export interface StaffSession {
  userId: string;
  email: string;
  displayName: string;
  preferredLocale: Locale;
  memberships: StaffMembership[];
}

/**
 * Resolves the authenticated staff member for this request, or null.
 * Deactivated staff (users.active = false) are treated as unauthenticated.
 * Memoized per request with React `cache`.
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!profile || !profile.active) return null;

  const rows = await db
    .select({
      studyId: studies.id,
      studyCode: studies.code,
      studyTitle: studies.title,
      studyStatus: studies.status,
      studyTimezone: studies.timezone,
      role: userRoles.role,
    })
    .from(userRoles)
    .innerJoin(studies, eq(studies.id, userRoles.studyId))
    .where(and(eq(userRoles.userId, profile.id), isNull(userRoles.revokedAt)))
    .orderBy(studies.code);

  return {
    userId: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    preferredLocale: profile.preferredLocale,
    memberships: rows,
  };
});

export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect(`${TEAM_BASE_PATH}/login`);
  return session;
}
