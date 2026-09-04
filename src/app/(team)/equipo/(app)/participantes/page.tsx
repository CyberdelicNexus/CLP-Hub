import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import {
  EligibilityBadge,
  EnrollmentBadge,
} from "@/components/team/participant-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { ELIGIBILITY_STATUSES, isEligibilityStatus } from "@/domain/participant-state";
import { listParticipants } from "@/services/participant-ops";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("participants") };
}

/**
 * Participants list, filterable by eligibility. Contact columns are only
 * selected when the viewer holds participants.contact.read.
 */
export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ elegibilidad?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("participants.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { elegibilidad } = await searchParams;
  const eligibility = isEligibilityStatus(elegibilidad) ? elegibilidad : undefined;
  const includeContact = ctx.permissions.has("participants.contact.read");
  const rows = await listParticipants(ctx.study.id, { includeContact, eligibility });

  const base = `${TEAM_BASE_PATH}/participantes`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.participants")}</h1>
        <p className="text-sm text-muted-foreground">{t("participants.subtitle")}</p>
      </header>

      <nav aria-label={t("participants.filterLabel")} className="flex flex-wrap gap-2">
        <FilterChip href={base} active={!eligibility} label={t("participants.all")} />
        {ELIGIBILITY_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`${base}?elegibilidad=${s}`}
            active={eligibility === s}
            label={t(`participants.eligibility.${s}`)}
          />
        ))}
      </nav>

      {!includeContact ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t("participants.contactHidden")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("participants.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("participants.emptyDescription")}</p>
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
                  <th scope="col" className="px-4 py-3">{t("participants.table.eligibility")}</th>
                  <th scope="col" className="px-4 py-3">{t("participants.table.enrollment")}</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("participants.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td data-numeric className="px-4 py-3 font-medium">
                      <Link
                        href={`${base}/${row.id}`}
                        className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {row.code}
                      </Link>
                    </td>
                    {includeContact ? <td className="px-4 py-3">{row.fullName ?? "—"}</td> : null}
                    <td className="px-4 py-3">
                      <EligibilityBadge
                        status={row.eligibilityStatus}
                        label={t(`participants.eligibility.${row.eligibilityStatus}`)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.enrollmentStatus ? (
                        <EnrollmentBadge
                          status={row.enrollmentStatus}
                          label={t(`participants.enrollment.${row.enrollmentStatus}`)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${base}/${row.id}`}
                        aria-label={`${t("participants.table.open")} ${row.code}`}
                        className="inline-flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          : "inline-flex items-center rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}
