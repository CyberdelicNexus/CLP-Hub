import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { recordAuditEvent } from "@/audit/record";
import { getDb } from "@/db/client";
import { cohorts, programStages, type ProgramStage } from "@/db/schema";
import type { SessionModality } from "@/domain/session";

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

export class ConflictError extends Error {
  readonly reason: "duplicateCode";
  constructor(reason: ConflictError["reason"]) {
    super(reason);
    this.name = "ConflictError";
    this.reason = reason;
  }
}

/**
 * Every stage for a study, in programme order. Active only by default; the
 * configuration screen passes `includeInactive` so a retired stage can still
 * be found and reactivated.
 */
export async function listProgramStages(
  studyId: string,
  options?: { includeInactive?: boolean },
): Promise<ProgramStage[]> {
  const filters = [eq(programStages.studyId, studyId)];
  if (!options?.includeInactive) filters.push(eq(programStages.active, true));
  return getDb()
    .select()
    .from(programStages)
    .where(and(...filters))
    .orderBy(asc(programStages.position));
}

/**
 * Create a programme stage — one named step of the study's programme (D-067).
 * Names, order and modality are this trial's design, so they are rows here,
 * never values in code (non-negotiable 6).
 */
export async function createProgramStage(params: {
  studyId: string;
  actorId: string;
  code: string;
  nameEs: string;
  nameEn?: string | null;
  modality: SessionModality;
  position?: number;
}): Promise<string> {
  const { studyId, actorId } = params;
  const code = params.code.trim().toLowerCase();
  const nameEs = params.nameEs.trim();

  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: programStages.id })
      .from(programStages)
      .where(and(eq(programStages.studyId, studyId), eq(programStages.code, code)))
      .limit(1);
    if (existing) throw new ConflictError("duplicateCode");

    const [created] = await tx
      .insert(programStages)
      .values({
        studyId,
        code,
        nameEs,
        nameEn: params.nameEn?.trim() || null,
        modality: params.modality,
        position: params.position ?? 0,
      })
      .returning({ id: programStages.id });

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "program_stage.created",
      entityType: "program_stage",
      entityId: created.id,
      after: { code, nameEs, modality: params.modality },
    });

    return created.id;
  });
}

export async function updateProgramStage(params: {
  studyId: string;
  stageId: string;
  actorId: string;
  nameEs?: string;
  nameEn?: string | null;
  modality?: SessionModality;
  position?: number;
}): Promise<void> {
  const { studyId, stageId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(programStages)
      .where(and(eq(programStages.id, stageId), eq(programStages.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("program stage", stageId);

    const patch = {
      nameEs: params.nameEs !== undefined ? params.nameEs.trim() : current.nameEs,
      nameEn: params.nameEn !== undefined ? (params.nameEn?.trim() || null) : current.nameEn,
      modality: params.modality ?? current.modality,
      position: params.position ?? current.position,
    } satisfies Partial<ProgramStage>;

    const fields: (keyof typeof patch)[] = ["nameEs", "nameEn", "modality", "position"];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of fields) {
      if (patch[key] !== current[key]) {
        before[key] = current[key];
        after[key] = patch[key];
      }
    }
    if (Object.keys(after).length === 0) return;

    await tx.update(programStages).set(patch).where(eq(programStages.id, stageId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: "program_stage.updated",
      entityType: "program_stage",
      entityId: stageId,
      before,
      after,
    });
  });
}

/**
 * Retire (or restore) a programme stage. A flag, not a delete: cohorts may
 * still point at it via `current_stage_id`, and session templates via
 * `stage_id` (migration 0017) — removing the row would orphan both.
 */
export async function setProgramStageActive(params: {
  studyId: string;
  stageId: string;
  actorId: string;
  active: boolean;
}): Promise<void> {
  const { studyId, stageId, actorId } = params;

  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: programStages.id, code: programStages.code, active: programStages.active })
      .from(programStages)
      .where(and(eq(programStages.id, stageId), eq(programStages.studyId, studyId)))
      .limit(1);
    if (!current) throw new NotFoundError("program stage", stageId);
    if (current.active === params.active) return;

    await tx.update(programStages).set({ active: params.active }).where(eq(programStages.id, stageId));

    await recordAuditEvent(tx, {
      studyId,
      actor: { type: "STAFF", id: actorId },
      action: params.active ? "program_stage.activated" : "program_stage.deactivated",
      entityType: "program_stage",
      entityId: stageId,
      before: { active: current.active },
      after: { active: params.active, code: current.code },
    });
  });
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
