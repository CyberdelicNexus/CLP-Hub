import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Donut } from "@/components/charts/donut";
import { countExclusionsWithoutReason, getStudyFlowCounts } from "@/services/study-flow";

/**
 * The study flow, as numbers (Phase 4a), in collapsible sections
 * (2026-09-18 request). The per-row length bars from that pass were
 * replaced (2026-09-19: "the progress bars don't mean anything") with two
 * different honest shapes for two different kinds of data:
 *   - Etapas / evaluaciones sin resultado are a funnel of SEQUENTIAL counts
 *     (applications -> people -> assessed -> ...) — a bar comparing them
 *     implies a proportion that isn't there, so these are now plain stat
 *     tiles, one number each, nothing computed.
 *   - Motivos de exclusión / asignación por grupo ARE genuine
 *     part-of-a-whole breakdowns (each reason's share of all exclusions,
 *     each arm's share of allocations), where a donut chart states a real
 *     relationship instead of a misleading one.
 * Percentages, retention rates and a publication-ready CONSORT diagram are
 * still deliberately absent (D-024).
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

  const exclusionTotal = counts.exclusionsByReason.reduce((sum, r) => sum + r.count, 0);
  const allocationTotal = counts.allocation.reduce((sum, a) => sum + a.allocated, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <Accordion
          defaultValue={["stages", "notAssessed", "exclusions", "allocation"]}
          multiple
          className="-mx-1"
        >
          <AccordionItem value="stages">
            <AccordionTrigger>{t("stages")}</AccordionTrigger>
            <AccordionPanel>
              <Tiles items={stages} labelFor={(key) => t(`stage.${key}`)} />
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="notAssessed">
            <AccordionTrigger>{t("notAssessed")}</AccordionTrigger>
            <AccordionPanel>
              <Tiles items={notAssessed} labelFor={(key) => t(`notAssessedReason.${key}`)} />
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="exclusions">
            <AccordionTrigger>{t("exclusions")}</AccordionTrigger>
            <AccordionPanel>
              {counts.exclusionsByReason.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t("noExclusions")}</p>
              ) : (
                <Donut
                  segments={counts.exclusionsByReason.map((r) => ({
                    label: `${r.labelEs} · ${t(`category.${r.category}`)}`,
                    value: r.count,
                  }))}
                  centerLabel={t("exclusionsTotal")}
                  centerValue={exclusionTotal}
                />
              )}
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="allocation">
            <AccordionTrigger>{t("allocation")}</AccordionTrigger>
            <AccordionPanel>
              {counts.allocation.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t("noArms")}</p>
              ) : (
                <Donut
                  segments={counts.allocation.map((a) => ({
                    label: `${a.armNameEs} · ${t("inCohort", { count: a.inCohort })}`,
                    value: a.allocated,
                  }))}
                  centerLabel={t("allocationTotal")}
                  centerValue={allocationTotal}
                />
              )}
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function Tiles({
  items,
  labelFor,
}: {
  items: { key: string; value: number }[];
  labelFor: (key: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{labelFor(item.key)}</p>
          <p data-numeric className="mt-0.5 text-xl font-semibold">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
