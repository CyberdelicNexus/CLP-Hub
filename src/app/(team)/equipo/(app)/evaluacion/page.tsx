import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { ScreeningBadge } from "@/components/team/participant-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listOpenScreenings } from "@/services/participant-ops";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("screening") };
}

/**
 * The screening queue: appointments still to happen, soonest first. Recording an
 * outcome happens on the participant, so each row links there rather than
 * duplicating the form.
 */
export default async function ScreeningQueuePage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("screening.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const includeContact = ctx.permissions.has("participants.contact.read");
  const rows = await listOpenScreenings(ctx.study.id, { includeContact });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.screening")}</h1>
        <p className="text-sm text-muted-foreground">{t("screening.subtitle")}</p>
      </header>

      <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
        {t("screening.boundary")}
      </p>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("screening.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("screening.emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3">{t("participants.table.code")}</th>
                  {includeContact ? (
                    <th scope="col" className="px-4 py-3">{t("participants.table.name")}</th>
                  ) : null}
                  <th scope="col" className="px-4 py-3">{t("screening.when")}</th>
                  <th scope="col" className="px-4 py-3">{t("participants.table.status")}</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("participants.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = `${TEAM_BASE_PATH}/participantes/${row.participantId}`;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td data-numeric className="px-4 py-3 font-medium">
                        <Link
                          href={href}
                          className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.participantCode}
                        </Link>
                      </td>
                      {includeContact ? <td className="px-4 py-3">{row.fullName ?? "—"}</td> : null}
                      <td data-numeric className="px-4 py-3 text-muted-foreground">
                        {row.scheduledAt ? formatDate(row.scheduledAt, ctx.study.timezone) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ScreeningBadge
                          status={row.status}
                          label={t(`participants.screeningStatus.${row.status}`)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={href}
                          aria-label={`${t("participants.table.open")} ${row.participantCode}`}
                          className="inline-flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    value,
  );
}
