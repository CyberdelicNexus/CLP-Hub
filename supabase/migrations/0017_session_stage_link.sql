-- =============================================================================
-- CLP Hub · Migration 0017 · Link session templates to programme stages
-- (Phase 4f continued, 2026-09-18 request)
--
-- Nullable: a session template not tied to a named stage (an ad-hoc extra
-- session, or a study that hasn't configured stages at all) is still valid.
-- =============================================================================

alter table session_templates
  add column if not exists stage_id uuid references program_stages(id);

create index if not exists session_templates_stage_idx
  on session_templates (stage_id) where stage_id is not null;
