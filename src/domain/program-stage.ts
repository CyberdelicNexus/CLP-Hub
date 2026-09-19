/**
 * Programme stage vocabulary (Phase 4f, 2026-09-18 request).
 *
 * A stage is a named step of the study's programme — "Preparación",
 * "Orientación", and so on — that a cohort moves through as a whole. Like
 * session templates (domain/session.ts), the stage NAMES, their ORDER and
 * their MODALITY are configuration rows in `program_stages`, never values in
 * this file: a stage called "Cuerpos de luz" is this trial's programme design,
 * and a different study configures its own (non-negotiable 6).
 *
 * There is deliberately no fixed enum of stage codes here, unlike
 * `CohortStatus` or `SessionStatus` — the set of stages is exactly what a
 * study configures, and "next stage" is simply the next `position` in that
 * study's own list, not a hard-coded sequence.
 */

export const STAGE_CODE_PATTERN = /^[a-z][a-z0-9_-]{1,48}$/;
export const STAGE_NAME_MAX_LENGTH = 120;

export interface StageLike {
  id: string;
  position: number;
}

/**
 * The stage after `currentStageId` in `stages` (ordered by position), or the
 * first stage when the cohort has not started the programme yet
 * (`currentStageId === null`). Null at the end of the list.
 */
export function nextProgramStage<T extends StageLike>(
  stages: readonly T[],
  currentStageId: string | null,
): T | null {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  if (currentStageId === null) return ordered[0] ?? null;
  const i = ordered.findIndex((s) => s.id === currentStageId);
  if (i === -1) return ordered[0] ?? null;
  return ordered[i + 1] ?? null;
}
