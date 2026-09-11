import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countExclusionsWithoutReason, getStudyFlowCounts } from "@/services/study-flow";

/**
 * The study flow, as numbers (Phase 4a).
 *
 * This is the data a CONSORT diagram is drawn from, shown as a table rather than
 * as a drawn diagram: the figures are what staff need day to day, and a diagram
 * that looked publication-ready would invite someone to paste it into a paper
 * before the numbers have been checked against the approved system.
 *
 * Deliberately absent: percentages, retention rates, and any per-person detail.
 * The first two would fold categories together into a figure that reads as a
 * claim (the argument of D-024); the third would turn an aggregate view into a
 * re-identification surface in a study this small.
 */
export async function StudyFlowSummary({ studyId }: { studyId: string }) {
  const t = await getTranslations("flow");
  const [counts, unreasoned] = await Promise.all([
    getStudyFlowCounts(studyId),
    countExclusionsWithoutReason(studyId),
  ]);

  const stages: { key: string; value: number }[] = [
    { key: "applicationsReceived", value: counts.applicationsReceived },
    { key: "peopleApplied", value: counts.peopleApplied },
    { key: "assessed", value: counts.assessed },
    { key: "eligible", value: counts.determination.eligible },
    { key: "ineligible", value: counts.determination.ineligible },
    { key: "reviewRequired", value: counts.determination.reviewRequired },
    { key: "waitlist", value: counts.determination.waitlist },
    { key: "pending", value: counts.determination.pending },
    { key: "eligibleNotAllocated", value: counts.eligibleNotAllocated },
  ];

  const notAssessed: { key: string; value: number }[] = [
    { key: "noShow", value: counts.notAssessed.noShow },
    { key: "cancelled", value: counts.notAssessed.cancelled },
    { key: "stillScheduled", value: counts.notAssessed.stillScheduled },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs leading-relaxed text-muted-foreground">{t("note")}</p>

        {/*
          An exclusion with no reason cannot be reported. The constraint added in
          migration 0007 prevents new ones; rows written before it are surfaced
          here so they can be completed rather than silently dropped from the
          totals.
        */}
        {unreasoned > 0 ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-surface-peach px-4 py-3 text-xs leading-relaxed text-surface-peach-ink"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("unreasoned", { count: unreasoned })}</span>
          </p>
        ) : null}

        <Section title={t("stages")}>
          {stages.map((s) => (
            <Row key={s.key} label={t(`stage.${s.key}`)} value={s.value} />
          ))}
        </Section>

        <Section title={t("notAssessed")}>
          {notAssessed.map((s) => (
            <Row key={s.key} label={t(`notAssessedReason.${s.key}`)} value={s.value} />
          ))}
        </Section>

        <Section title={t("exclusions")}>
          {counts.exclusionsByReason.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t("noExclusions")}</p>
          ) : (
            counts.exclusionsByReason.map((r) => (
              <Row
                key={r.reasonId}
                label={r.labelEs}
                hint={t(`category.${r.category}`)}
                value={r.count}
              />
            ))
          )}
        </Section>

        <Section title={t("allocation")}>
          {counts.allocation.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t("noArms")}</p>
          ) : (
            counts.allocation.map((a) => (
              <Row
                key={a.armId}
                label={a.armNameEs}
                hint={t("inCohort", { count: a.inCohort })}
                value={a.allocated}
              />
            ))
          )}
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <dl className="divide-y divide-border">{children}</dl>
    </section>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm">
        {label}
        {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      </dt>
      <dd data-numeric className="text-sm font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}
