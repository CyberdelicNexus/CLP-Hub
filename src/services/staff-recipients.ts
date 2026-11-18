import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { studies, userRoles, users } from "@/db/schema";
import { hasPermission } from "@/domain/permissions";
import { isStaffRole, type StaffRole } from "@/domain/roles";

/**
 * Who is emailed when something new arrives for the team: a consulta (D-088)
 * or an application (D-152). One list for both, so the team manages it in one
 * place: everyone active who holds `inquiries.manage` in the study (unless the
 * study switched staff notices off, D-119), plus the team mailbox
 * (`studies.contact_email`) either way. Granting or revoking that permission
 * in Equipo adds or removes a person.
 */
export async function staffNotificationRecipients(studyId: string): Promise<string[]> {
  const db = getDb();
  const [study] = await db
    .select({ contactEmail: studies.contactEmail, notifyStaff: studies.notifyStaffOfInquiries })
    .from(studies)
    .where(eq(studies.id, studyId))
    .limit(1);
  const rows = await db
    .select({ email: users.email, role: userRoles.role })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.studyId, studyId), isNull(userRoles.revokedAt), eq(users.active, true)));

  const byEmail = new Map<string, StaffRole[]>();
  for (const r of rows) {
    if (!isStaffRole(r.role)) continue;
    byEmail.set(r.email, [...(byEmail.get(r.email) ?? []), r.role]);
  }
  const to =
    study?.notifyStaff === false
      ? []
      : [...byEmail].filter(([, roles]) => hasPermission(roles, "inquiries.manage")).map(([email]) => email);
  const mailbox = study?.contactEmail?.trim();
  if (mailbox && !to.some((e) => e.toLowerCase() === mailbox.toLowerCase())) to.push(mailbox);
  return to;
}
