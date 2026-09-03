import "server-only";
import { eq } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { Locale } from "@/domain/locale";

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
