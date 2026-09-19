-- =============================================================================
-- CLP Hub · Migration 0016 · Programme stages (Phase 4f, 2026-09-18 request)
-- Tables: program_stages · Adds: cohorts.current_stage_id, current_stage_entered_at
--
-- Stage names, order and default modality are CONFIGURATION ROWS, exactly like
-- session_templates (migration 0005) — a stage called "Cuerpos de luz" is data
-- belonging to a study, never a value in code (non-negotiable 6). Reuses the
-- session_modality enum from migration 0005 rather than inventing a second one.
--
-- `cohorts.current_stage_id` records which stage a cohort is currently in.
-- Nullable: a cohort still in PLANNING/RECRUITING has not started the
-- programme yet, so "no stage" is a real, honest state, not a missing value.
-- Nothing here infers or advances the stage automatically — moving a cohort is
-- always an explicit staff action, audited like every other cohort change.
-- =============================================================================

create table if not exists program_stages (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references studies(id) on delete restrict,
  code        text not null,
  name_es     text not null,
  name_en     text,
  position    integer not null default 0,
  modality    session_modality not null default 'IN_PERSON',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint program_stages_code_format check (code ~ '^[a-z][a-z0-9_-]{1,48}$'),
  constraint program_stages_code_unique unique (study_id, code),
  constraint program_stages_name_length check (length(btrim(name_es)) between 1 and 120)
);

create index if not exists program_stages_study_idx
  on program_stages (study_id, position) where active;

drop trigger if exists program_stages_set_updated_at on program_stages;
create trigger program_stages_set_updated_at before update on program_stages
  for each row execute function set_updated_at();

alter table cohorts add column if not exists current_stage_id uuid references program_stages(id);
alter table cohorts add column if not exists current_stage_entered_at timestamptz;

-- Security: deny the Supabase API keys entirely --------------------------------
alter table program_stages enable row level security;
revoke all on program_stages from anon, authenticated;
