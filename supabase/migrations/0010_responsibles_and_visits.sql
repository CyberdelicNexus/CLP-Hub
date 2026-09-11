-- =============================================================================
-- CLP Hub · Migration 0010 · Responsibles and the initial visit (Phase 4d)
-- Tables: participant_responsibilities, initial_visits
--
-- WHAT THIS ADDS
-- --------------
-- Two things the 2026-09-11 meeting asked for that had no home:
--
--   1. WHO is responsible for a given participant — who runs the initial visit,
--      and who takes or sets up the headset when that is someone else.
--      Cohort-level staffing already exists as `cohort_staff` (D-022) and is NOT
--      duplicated; this is the narrower, per-person question.
--
--   2. The INITIAL VISIT itself: the in-person appointment where the physical
--      consent is signed and the equipment is handed over. Distinct from
--      `screenings` (earlier, about eligibility) and from `cohort_sessions`
--      (later, per cohort rather than per person).
--
-- ⚠ NOTE ON FREE TEXT. `initial_visits` carries the only two free-text fields in
-- the participant record: a location and operational notes. This is a deliberate
-- widening of the line D-019 drew for screenings, and the reasoning is in D-035:
-- "aparcar detrás, el portero abre a las 9" is logistics, and refusing to store
-- it just moves it to WhatsApp where nobody can see it. Both are capped, the UI
-- says in Spanish that clinical information does not go there, and neither is
-- ever copied into an audit snapshot — so each lives in exactly one place and
-- can be erased.
--
-- Purely additive. No existing table, column, index or row is touched.
-- =============================================================================

do $$ begin
  create type responsibility_role as enum ('INITIAL_SESSION','VR_EQUIPMENT');
exception when duplicate_object then null; end $$;

-- Deliberately its own type rather than reusing screening_status. The two
-- vocabularies are equal today by coincidence, not by rule, and coupling them
-- would mean a change to one silently changing the other.
do $$ begin
  create type visit_status as enum ('SCHEDULED','COMPLETED','NO_SHOW','CANCELLED');
exception when duplicate_object then null; end $$;

-- participant_responsibilities -------------------------------------------------
-- Historical: revoked, never deleted, so "who was responsible in March" stays
-- answerable.
--
-- Unlike cohort_staff, a row here grants NO extra visibility. It is a work
-- assignment; widening what someone can see goes through
-- src/domain/permissions.ts where it can be reviewed (non-negotiable 8).
create table if not exists participant_responsibilities (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  participant_id uuid not null references participants(id) on delete restrict,
  role           responsibility_role not null,
  user_id        uuid not null references users(id) on delete restrict,
  assigned_by    uuid references users(id),
  assigned_at    timestamptz not null default now(),
  revoked_by     uuid references users(id),
  revoked_at     timestamptz,
  constraint participant_responsibilities_revocation_consistent
    check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);

-- One active holder per role per participant. Two people simultaneously
-- responsible for the headset is how a headset ends up with nobody carrying it.
create unique index if not exists participant_responsibilities_one_active
  on participant_responsibilities (participant_id, role)
  where revoked_at is null;

create index if not exists participant_responsibilities_user_idx
  on participant_responsibilities (user_id) where revoked_at is null;

create index if not exists participant_responsibilities_study_idx
  on participant_responsibilities (study_id, role);

-- initial_visits ---------------------------------------------------------------
create table if not exists initial_visits (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  participant_id uuid not null references participants(id) on delete restrict,
  status         visit_status not null default 'SCHEDULED',
  scheduled_at   timestamptz,
  completed_at   timestamptz,
  location       text,
  notes          text,
  recorded_by    uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint initial_visits_location_length
    check (location is null or length(location) <= 200),
  -- Capped, so a note stays a note. The cap is what stops it becoming a clinical
  -- narrative; the UI says so in words as well.
  constraint initial_visits_notes_length
    check (notes is null or length(notes) <= 500),
  -- A completed visit has a timestamp, exactly as a completed screening does.
  constraint initial_visits_completed_at_present
    check (status <> 'COMPLETED' or completed_at is not null)
);

-- At most one open visit per participant. A repeat is a new row once the first
-- has been closed, so the history stays honest (the D-019 pattern).
create unique index if not exists initial_visits_one_open
  on initial_visits (participant_id)
  where status = 'SCHEDULED';

create index if not exists initial_visits_study_idx
  on initial_visits (study_id, status, scheduled_at);

create index if not exists initial_visits_participant_idx
  on initial_visits (participant_id, created_at desc);

drop trigger if exists initial_visits_set_updated_at on initial_visits;
create trigger initial_visits_set_updated_at before update on initial_visits
  for each row execute function set_updated_at();

-- Security: deny the Supabase API keys entirely --------------------------------
alter table participant_responsibilities enable row level security;
alter table initial_visits               enable row level security;

revoke all on participant_responsibilities, initial_visits from anon, authenticated;
