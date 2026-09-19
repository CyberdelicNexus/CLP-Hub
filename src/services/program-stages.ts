import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import { cohorts, programStages, type ProgramStage } from "@/db/schema";

/**
 * Programme stages (Phase 4f, 2026-09-18 request). Configuration reads and
 * the one write that moves a cohort between stages — see
 * src/domain/program-stage.ts for why there is no fixed transition graph
 * here the way there is for `CohortStatus`.
 */

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found in this study`);
    this.name = "NotFoundError";
  }
}

/** Every active stage for a study, in programme order. */
export async function listProgramStages(studyId: string): Promise<ProgramStage[]> {
  return getDb()
    .select()
    .from(programStages)
    .where(and(eq(programStages.studyId, studyId), eq(programStages.active, true)))
    .orderBy(asc(programStages.position));
}

/**
 * Move a cohort to a stage. Any configured stage to any other — unlike
 * `CohortStatus`'s strictly-forward lifecycle, staff can move a cohort back a
 * stage or skip ahead (the timeline is a record of where the cohort actually
 * is, not a one-way gate), so every move is simply recorded and audited
 * rather than checked against a transition graph. `stageId: null` clears the
 * cohort's stage back to "programme not started".
 */
export async function setCohortStage(params: {
  studyId: string;
  cohortId: string;
  actorId: string;
  stageId: string | null;
}): Promise<void> {
  const { studyId, cohortId, actorId, stageId } = params;

  await getDb().transaction(async (tx) => {
    const [cohort] = await tx
      .select({ id: cohorts.id, code: cohorts.code, currentStageId: cohorts.currentStageId })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohortId), eq(cohorts.studyId, studyId)))
      .limit(1);
    if (!cohort) throw new NotFoundError("cohort", cohortId);
    if (cohort.currentStageId === stageId) return;

    let stageCode: string | null = null;
    if (stageId) {
      const [stage] = await tx
        .select({ id: programStages.id, code: programStages.code })
        .from(programStages)
        .where(and(eq(programStages.id, stageId), eq(programStages.studyId, studyId)))
        .limit(1);
      if (!stage) throw new NotFoundError("program stage", stageId);
      stageCode = stage.code;
    }

    const now = new Date();
    await tx
      .update(cohorts)
      .set({ currentStageId: stageId, currentStageEnteredAt: stageId ? now : null })
      .where(eq(cohorts.id, cohortId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "cohort.stage_changed",
      entityType: "cohort",
      entityId: cohortId,
      before: { stageId: cohort.currentStageId },
      after: { stageId, stageCode, cohortCode: cohort.code },
    });
  });
}
