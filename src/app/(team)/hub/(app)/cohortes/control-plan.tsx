import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import type { StudyContext } from "@/auth/study-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { toStudyLocal } from "@/lib/study-time";
import { listCohortPlan } from "@/services/cohort-plan";
import { listTemplates } from "@/services/communications";
import { listSessions } from "@/services/sessions";
import { AddPlanEntryForm, PlanEntryRow } from "./plan-forms";

/**
 * The control group's cohort template (2026-10-28, D-136): no programme
 * sessions, only messages. Shown for a cohort that follows another
 * (`paired_cohort_id`, D-116) — that pairing, not the arm's name, is what
 * makes a cohort "the one without sessions" (rule 6).
 *
 * Each planned message has a date. Eligible emails go out on their own at
 * that time; everything else (a WhatsApp reminder, an email with a link
 * still to fill in) is a dated reminder with its text ready to copy. The
 * followed cohort's session dates are listed alongside, since "a week after
 * S0" is how the team thinks about these.
 */
export async function ControlPlan({
  ctx,
  cohortId,
  followsCohort,
}: {
  ctx: StudyContext;
  cohortId: string;
  followsCohort: { id: string; code: string; name: string };
}) {
  const t = await getTranslations();
  const canManage = ctx.permissions.has("communications.manage");
  const tz = ctx.study.timezone;

  const [plan, templates, followedSessions] = await Promise.all([
    listCohortPlan(ctx.study.id, cohortId),
    listTemplates(ctx.study.id, { activeOnly: true }),
    listSessions(ctx.study.id, { scope: ctx.cohortScope, cohortId: followsCohort.id }),
  ]);

  const planned = new Set(plan.map((p) => p.template.id));
  // Emails first: they are what this group receives; WhatsApp after, for the
  // odd reminder.
  const options = templates
    .filter((tpl) => !planned.has(tpl.id))
    .sort((a, b) => (a.channel === b.channel ? a.nameEs.localeCompare(b.nameEs, "es") : a.channel === "EMAIL" ? -1 : 1))
    .map((tpl) => ({ id: tpl.id, label: `${tpl.channel === "EMAIL" ? "✉" : "💬"} ${tpl.nameEs}` }));

  const fmt = (d: Date) => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d);
  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("cohorts.plan.error.invalid"),
    notFound: t("cohorts.error.notFound"),
    locked: t("cohorts.plan.error.locked"),
    failed: t("cohorts.error.failed"),
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>{t("cohorts.plan.title")}</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("cohorts.plan.help")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <CalendarDays className="size-3.5" aria-hidden />
            <Link href={`${TEAM_BASE_PATH}/cohortes?cohorte=${followsCohort.id}`} className="hover:underline">
              {t("cohorts.plan.followedDates", { code: followsCohort.code })}
            </Link>
          </p>
          {followedSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("cohorts.plan.noFollowedDates")}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {followedSessions.map((s) => (
                <li key={s.id} className="rounded-lg bg-card px-2 py-1 text-xs ring-1 ring-foreground/5">
                  <span className="font-medium">{s.name}</span>{" "}
                  <span data-numeric className="text-muted-foreground">
                    {fmt(s.scheduledStart)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {plan.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("cohorts.plan.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {plan.map((p) => (
              <PlanEntryRow
                key={p.id}
                cohortId={cohortId}
                canManage={canManage}
                entry={{
                  id: p.id,
                  templateId: p.template.id,
                  name: p.template.nameEs,
                  body: p.template.bodyEs,
                  channel: p.template.channel,
                  sendAt: toStudyLocal(p.sendAt, tz),
                  sendAtLabel: fmt(p.sendAt),
                  status: p.status,
                  manualReason: p.manualReason ? t(`cohorts.plan.manualReason.${p.manualReason}`) : null,
                }}
                labels={{
                  automatic: t("cohorts.plan.automatic"),
                  manual: t("cohorts.plan.manual"),
                  status: {
                    PLANNED: t("cohorts.plan.status.PLANNED"),
                    SENT: t("cohorts.plan.status.SENT"),
                    PARTIAL: t("cohorts.plan.status.PARTIAL"),
                    FAILED: t("cohorts.plan.status.FAILED"),
                    CANCELLED: t("cohorts.plan.status.CANCELLED"),
                  },
                  save: t("common.save"),
                  remove: t("cohorts.plan.remove"),
                  copy: t("cohorts.plan.copy"),
                  copied: t("sessions.contentLinkCopied"),
                  saved: t("cohorts.plan.saved"),
                  errors,
                }}
              />
            ))}
          </ul>
        )}

        {canManage ? (
          <div className="border-t border-border pt-4">
            <AddPlanEntryForm
              cohortId={cohortId}
              options={options}
              labels={{
                template: t("cohorts.plan.template"),
                when: t("cohorts.plan.when"),
                add: t("cohorts.plan.add"),
                added: t("cohorts.plan.saved"),
                errors,
              }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
