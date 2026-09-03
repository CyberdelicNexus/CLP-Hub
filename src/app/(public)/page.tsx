import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TEAM_BASE_PATH } from "@/domain/navigation";

/**
 * Public landing placeholder. The real recruitment site arrives in Phase 1.
 * Participant-facing pages are Spanish-first; this placeholder uses the
 * same message system so no string is hardcoded.
 */
export default async function PublicHomePage() {
  const t = await getTranslations("public.landing");
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Link href={`${TEAM_BASE_PATH}/login`} className="mt-12 text-xs text-muted-foreground underline-offset-4 hover:underline">
        {t("teamAccess")}
      </Link>
    </main>
  );
}
