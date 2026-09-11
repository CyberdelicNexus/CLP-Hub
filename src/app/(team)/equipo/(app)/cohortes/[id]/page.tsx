import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CohortOccupancy } from "@/components/team/cohort-occupancy";
import { assessCohortSize, nextCohortStatus, sizeIsCheckedAt } from "@/domain/cohort";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { getCohortDetail, listAssignableStaff } from "@/services/cohorts";
import { AdvanceCohortForm, AssignStaffForm, RevokeStaffForm } from "../cohort-forms";
import { cohortTone } from "../tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cohorts");
  return { title: t("detailTitle") };
}

/**
 * One cohort: its lifecycle, the staff who run it, and its members.
 *
 * A facilitator reaching a cohort they do not staff gets a 404 rather than a
 * permission error — the narrowing happens in the query, so out-of-scope
 * cohorts simply do not exist for them.
 */
export default async function CohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("cohorts.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { id } = await params;
  const includeContact = ctx.permissions.has("participants.contact.read");
  const detail = await getCohortDetail(ctx.study.id, id, { scope: ctx.cohortScope, includeContact });
  if (!detail) notFound();

  const canManage = ctx.permissions.has("cohorts.manage");
  const { cohort, staff, members } = detail;
  const size = assessCohortSize({
    members: members.length,
    minSize: cohort.minSize,
    maxSize: cohort.maxSize,
  });
  const next = nextCohortStatus(cohort.status);

  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("cohorts.error.invalid"),
    notFound: t("cohorts.error.notFound"),
    duplicateCode: t("cohorts.error.duplicateCode"),
    alreadyRandomized: t("cohorts.error.alreadyRandomized"),
    alreadyAssigned: t("cohorts.error.alreadyAssigned"),
    cohortClosed: t("cohorts.error.cohortClosed"),
    badReference: t("participants.error.badReference"),
    failed: t("cohorts.error.failed"),
  };
  const base = { submit: t("common.save"), submitting: t("common.loading"), errors };

  const assignable = canManage ? await listAssignableStaff(ctx.study.id) : [];
  const assignedIds = new Set(staff.map((s) => s.userId));

  return (
    <div className="space-y-6">
      <Link
        href={`${TEAM_BASE_PATH}/cohortes`}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("cohorts.backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {cohort.code}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{cohort.name}</h1>
          <p data-numeric className="text-sm text-muted-foreground">
            {cohort.plannedStartDate ?? "—"} → {cohort.plannedEndDate ?? "—"}
          </p>
        </div>
        <StatusBadge tone={cohortTone(cohort.status)}>
          {t(`cohorts.status.${cohort.status}`)}
        </StatusBadge>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {t("cohorts.members")}{" "}
              <span className="font-normal text-muted-foreground">
                <CohortOccupancy
                  size={size}
                  labels={{
                    under: t("cohorts.size.under", { needed: size.needed }),
                    over: t("cohorts.size.over"),
                    remaining: t("cohorts.size.remaining", { remaining: size.remaining ?? 0 }),
                  }}
                />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("cohorts.noMembers")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.participantId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                    <Link
                      href={`${TEAM_BASE_PATH}/participantes/${m.participantId}`}
                      data-numeric
                      className="rounded font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {m.code}
                    </Link>
                    {includeContact ? <span className="text-sm">{m.fullName ?? "—"}</span> : null}
                    {m.armCode ? (
                      <StatusBadge tone="info">
                        {t("cohorts.arm")} {m.armCode}
                      </StatusBadge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("cohorts.lifecycle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/*
                Said before the button is pressed, not only after the server
                refuses: someone about to activate a cohort should know it is
                short before they try, so they can go and fill it.
              */}
              {next && sizeIsCheckedAt(next) && (size.verdict === "UNDER" || size.verdict === "OVER") ? (
                <p className="rounded-xl bg-surface-peach px-3 py-2 text-xs leading-relaxed text-surface-peach-ink">
                  {size.verdict === "UNDER"
                    ? t("cohorts.size.warnUnder", { members: size.members, min: size.minSize ?? 0 })
                    : t("cohorts.size.warnOver", { members: size.members, max: size.maxSize ?? 0 })}
                </p>
              ) : null}
              {canManage ? (
                <AdvanceCohortForm
                  cohortId={cohort.id}
                  next={next ? { value: next, label: t(`cohorts.advanceTo.${next}`) } : null}
                  labels={{
                    ...base,
                    terminal: t("cohorts.lifecycleEnd"),
                    confirmUnder: t("cohorts.size.confirmUnder", {
                      members: size.members,
                      min: size.minSize ?? 0,
                    }),
                    confirmOver: t("cohorts.size.confirmOver", {
                      members: size.members,
                      max: size.maxSize ?? 0,
                    }),
                    overrideReason: t("cohorts.size.overrideReason"),
                    confirmSubmit: t("cohorts.size.confirmSubmit"),
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("cohorts.readOnly")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cohorts.staff")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("cohorts.noStaff")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {staff.map((s) => (
                    <li key={s.userId} className="flex items-center justify-between gap-2 py-2">
                      <span className="text-sm">{s.displayName}</span>
                      {canManage ? (
                        <RevokeStaffForm
                          cohortId={cohort.id}
                          userId={s.userId}
                          labels={{ ...base, submit: t("cohorts.revokeStaff") }}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {canManage ? (
                <AssignStaffForm
                  cohortId={cohort.id}
                  staff={assignable.filter((s) => !assignedIds.has(s.id))}
                  labels={{
                    ...base,
                    submit: t("cohorts.assignStaff"),
                    person: t("cohorts.field.person"),
                    note: t("cohorts.staffVisibilityNote"),
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
