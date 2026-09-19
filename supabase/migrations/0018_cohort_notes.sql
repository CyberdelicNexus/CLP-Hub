-- =============================================================================
-- CLP Hub · Migration 0018 · Cohort sticky notes (2026-09-19 request)
-- Tables: cohort_notes
--
-- A team reminder attached to a cohort — "remember the Zoom link changed",
-- not a research record and not a task with a status/priority/assignment
-- workflow (that's `tasks`, migration 0015). Colour is one of four pastel
-- surface tones the UI already uses; create and delete only, no edit.
-- =============================================================================

create type cohort_note_color as enum ('LILAC', 'PEACH', 'MINT', 'SKY');

create table if not exists cohort_notes (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references studies(id) on delete restrict,
  cohort_id   uuid not null references cohorts(id) on delete restrict,
  color       cohort_note_color not null default 'LILAC',
  body        text not null,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  constraint cohort_notes_body_length check (length(btrim(body)) between 1 and 280)
);

create index if not exists cohort_notes_cohort_idx on cohort_notes (cohort_id, created_at);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table cohort_notes enable row level security;
revoke all on cohort_notes from anon, authenticated;
