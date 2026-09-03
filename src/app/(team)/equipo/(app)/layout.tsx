import { getTranslations } from "next-intl/server";
import { requireStaffSession } from "@/auth/session";
import { getStudyContext } from "@/auth/study-context";
import { TeamShell } from "@/components/team/shell";
import { NoStudyAccess } from "@/components/team/no-study-access";

/**
 * Guarded layout for the whole team area. Unauthenticated users are
 * redirected (server-side, independent of the proxy). Authenticated staff
 * without any study membership see a clear message instead of an empty shell.
 */
export default async function TeamAppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession();
  const ctx = await getStudyContext();
  const t = await getTranslations("team.noStudy");

  if (!ctx) {
    return <NoStudyAccess title={t("title")} description={t("description")} email={session.email} />;
  }

  return <TeamShell ctx={ctx}>{children}</TeamShell>;
}
