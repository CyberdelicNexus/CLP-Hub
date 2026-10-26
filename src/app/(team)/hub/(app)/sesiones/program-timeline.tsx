"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Circle, Diamond, Hexagon, Octagon, Square, Star, Triangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setCohortStageAction, type CohortState } from "../cohortes/actions";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import type { SessionModality } from "@/domain/session";

const initial: CohortState = { error: null };

/**
 * Stage colour and shape are assigned by POSITION, not by stage identity —
 * a stage's name is configuration (rule 6), so nothing here may branch on
 * what a stage is called. Cycling a fixed palette/shape set by index still
 * gives every stage its own look ("a different gradient colour with a
 * different icon", 2026-09-19) without the code knowing or caring what any
 * of them mean.
 *
 * `--chart-5` is deliberately excluded here (2026-09-19 follow-up: "not
 * sure why the timeline colours became red") — its hue (~12-14°) reads as a
 * warm red/coral, which every other status-style token in this app (
 * `--destructive`, `--status-critical-*`) reserves for "something is
 * wrong." Whichever stage happened to land on index 4 (mod 5) rendered
 * fully in that hue, which looked like an alarm on a screen that is just
 * showing normal progress. Four hues is still plenty to keep S0-S6 visually
 * distinct.
 */
const STAGE_SHAPES = [Circle, Square, Triangle, Diamond, Star, Hexagon, Octagon];
const STAGE_HUES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4"] as const;

function stageGradient(index: number): string {
  const a = STAGE_HUES[index % STAGE_HUES.length];
  const b = STAGE_HUES[(index + 1) % STAGE_HUES.length];
  return `linear-gradient(135deg, var(${a}), var(${b}))`;
}
/**
 * How dim a PAST stage's own gradient reads, the further behind the cohort's
 * current stage it is (2026-09-19: "use in each stage the gradient you
 * applied to the bg of the icon, and modulate brightness depending on the
 * current stage") — the stage just before the current one stays almost at
 * full brightness, and each step further back dims a little more, so the
 * trail reads as leading up to where the cohort is now without every past
 * stop collapsing into one flat colour.
 */
function pastBrightness(stepsBehind: number): number {
  return Math.max(0.4, 1 - stepsBehind * 0.14);
}

export interface TimelineStage {
  id: string;
  nameEs: string;
  modality: SessionModality;
}

export interface TimelineCohort {
  id: string;
  code: string;
  name: string;
  currentStageId: string | null;
}

/**
 * The programme as a horizontal line of stages, with every visible cohort's
 * current position marked on it. Moving a cohort is one click on the stage it
 * should be at — not a forward-only wizard, because a stage here is a record
 * of where the cohort actually is (staff can correct or skip ahead), not a
 * gate. Each move calls the same `setCohortStageAction` a plain form would,
 * audited under `cohort.stage_changed`.
 */
export function ProgramTimeline({
  stages,
  cohorts,
  canManage,
  modalityLabels,
  errorLabels,
  emptyLabel,
  notStartedLabel,
}: {
  stages: TimelineStage[];
  cohorts: TimelineCohort[];
  canManage: boolean;
  modalityLabels: Record<SessionModality, string>;
  errorLabels: Record<string, string>;
  emptyLabel: string;
  notStartedLabel: string;
}) {
  if (stages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  // Below sm, `stages.length` equal-width columns (up to 7 for S0-S6) leave
  // each stage's icon+label too narrow to read — the header and every
  // cohort row scroll together horizontally instead, in one shared
  // min-width wrapper so the columns stay aligned across rows
  // (2026-09-19 mobile pass).
  const minWidth = `${Math.max(stages.length * 5.5, 24)}rem`;

  return (
    <div className="space-y-6 overflow-x-auto">
      <div style={{ minWidth }}>
        <div
          className="grid grid-cols-[repeat(var(--stage-count),1fr)] gap-1"
          style={{ "--stage-count": stages.length } as React.CSSProperties}
        >
          {stages.map((stage, i) => {
            const Icon = STAGE_SHAPES[i % STAGE_SHAPES.length];
            return (
              <div key={stage.id} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundImage: stageGradient(i) }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-[0.7rem] leading-tight font-medium text-balance">{stage.nameEs}</span>
                <span className="text-[0.65rem] text-muted-foreground">{modalityLabels[stage.modality]}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-3">
        {cohorts.map((cohort) => {
          const activeIndex = stages.findIndex((s) => s.id === cohort.currentStageId);
          return (
            <div key={cohort.id} className="rounded-2xl bg-muted/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Link
                  href={`${TEAM_BASE_PATH}/cohortes/${cohort.id}`}
                  data-numeric
                  className="rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {cohort.code}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{cohort.name}</span>
                {cohort.currentStageId === null ? (
                  <span className="ml-auto text-xs text-muted-foreground">{notStartedLabel}</span>
                ) : null}
              </div>
              <div
                className="grid grid-cols-[repeat(var(--stage-count),1fr)] items-center gap-1"
                style={{ "--stage-count": stages.length } as React.CSSProperties}
              >
                {stages.map((stage, i) => (
                  <StageNode
                    key={stage.id}
                    cohortId={cohort.id}
                    stage={stage}
                    isCurrent={cohort.currentStageId === stage.id}
                    isPast={activeIndex !== -1 && activeIndex > i}
                    gradient={stageGradient(i)}
                    brightness={activeIndex !== -1 && activeIndex > i ? pastBrightness(activeIndex - i) : 1}
                    canManage={canManage}
                    errorLabels={errorLabels}
                  />
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function StageNode({
  cohortId,
  stage,
  isCurrent,
  isPast,
  gradient,
  brightness,
  canManage,
  errorLabels,
}: {
  cohortId: string;
  stage: TimelineStage;
  isCurrent: boolean;
  isPast: boolean;
  /** This stage's own two-hue gradient — the same one behind its icon above,
   * so a stage keeps one identity wherever it appears (2026-09-19). */
  gradient: string;
  /** 1 for the current stage; dimmed for a past one by how far behind it is. */
  brightness: number;
  canManage: boolean;
  errorLabels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(setCohortStageAction, initial);

  useEffect(() => {
    // A failed move is rare (the stage still exists, the cohort still
    // exists) and doesn't need to block the timeline's layout — just say so.
    if (state.error) toast.error(errorLabels[state.error] ?? errorLabels.failed);
  }, [state.error, errorLabels]);

  const dot = (
    <span
      className={cn("mx-auto block h-2 rounded-full transition-all duration-200", !isCurrent && !isPast && "bg-border")}
      style={
        isCurrent || isPast
          ? {
              backgroundImage: gradient,
              height: isCurrent ? "0.75rem" : undefined,
              filter: `brightness(${brightness})`,
            }
          : undefined
      }
    />
  );

  if (!canManage) {
    return <div className="px-1" title={stage.nameEs}>{dot}</div>;
  }

  return (
    <form action={action} className="px-1">
      <input type="hidden" name="cohortId" value={cohortId} />
      <button
        type="submit"
        name="stageId"
        value={stage.id}
        disabled={pending || isCurrent}
        title={stage.nameEs}
        aria-current={isCurrent ? "step" : undefined}
        className="w-full rounded focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
      >
        {dot}
      </button>
    </form>
  );
}
