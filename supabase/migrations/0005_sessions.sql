-- =============================================================================
-- CLP Hub · Migration 0005 · Sessions and attendance (Phase 3b)
-- Tables: session_templates, cohort_sessions, session_attendance
--
-- Session names, order, modality and timings are CONFIGURATION ROWS. A session
-- called "Vida" is data belonging to a study, never a value in code
-- (non-negotiable 6).
--
-- Attendance uses the brief's vocabulary, in which TECHNICAL_FAILURE is a
-- distinct outcome from ABSENT: a failed headset is not a participant who did
-- not turn up. Nothing in this schema or in application code collapses the two.
--
-- No clinical content: there is no notes or observation column on any of these
-- tables. What happened to a participant during a session belongs in the
-- institution's approved system (docs/research-data-boundaries.md).
-- =============================================================================

do $$ begin
  create type session_modality as enum ('ZOOM','VR','IN_PERSON','ASYNCHRONOUS','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('SCHEDULED','HELD','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum (
    'EXPECTED','ATTENDED','LATE','ABSENT','EXCUSED','TECHNICAL_FAILURE','WITHDRAWN'
  );
exception when duplicate_object then null; end $$;

-- session_templates -------------------------------------------------------------
-- The programme definition for a study. `arm_id` is nullable: null means the
-- template applies to every arm, which avoids asserting a trial design this
-- application has no business encoding.
create table if not exists session_templates (
  id               uuid primary key default gen_random_uuid(),
  study_id         uuid not null references studies(id) on delete restrict,
  arm_id           uuid references study_arms(id) on delete restrict,
  code             text not null,
  name_es          text not null,
  name_en          text,
  position         integer not null default 0,
  modality         session_modality not null default 'IN_PERSON',
  duration_minutes integer,
  /** Days after the cohort start date. Nullable: not every session is offset-scheduled. */
  day_offset       integer,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint session_templates_code_format check (code ~ '^[a-z][a-z0-9_-]{1,48}$'),
  constraint session_templates_code_unique unique (study_id, code),
  constraint session_templates_name_length check (length(btrim(name_es)) between 1 and 120),
  constraint session_templates_duration_positive
    check (duration_minutes is null or duration_minutes > 0)
);

create index if not exists session_templates_study_idx
  on session_templates (study_id, position) where active;

drop trigger if exists session_templates_set_updated_at on session_templates;
create trigger session_templates_set_updated_at before update on session_templates
  for each row execute function set_updated_at();

-- cohort_sessions ---------------------------------------------------------------
-- A scheduled instance for one cohort. `template_id` is nullable so an ad-hoc
-- session can be scheduled without inventing a template for it.
create table if not exists cohort_sessions (
  id               uuid primary key default gen_random_uuid(),
  study_id         uuid not null references studies(id) on delete restrict,
  cohort_id        uuid not null references cohorts(id) on delete restrict,
  template_id      uuid references session_templates(id) on delete restrict,
  name             text not null,
  modality         session_modality not null default 'IN_PERSON',
  status           session_status not null default 'SCHEDULED',
  scheduled_start  timestamptz not null,
  duration_minutes integer,
  -- Room, address or meeting link. Operational only.
  location         text,
  facilitator_id   uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint cohort_sessions_name_length check (length(btrim(name)) between 1 and 120),
  constraint cohort_sessions_location_length
    check (location is null or length(location) <= 200),
  constraint cohort_sessions_duration_positive
    check (duration_minutes is null or duration_minutes > 0)
);

create index if not exists cohort_sessions_cohort_idx
  on cohort_sessions (cohort_id, scheduled_start);
create index if not exists cohort_sessions_study_idx
  on cohort_sessions (study_id, status, scheduled_start);

drop trigger if exists cohort_sessions_set_updated_at on cohort_sessions;
create trigger cohort_sessions_set_updated_at before update on cohort_sessions
  for each row execute function set_updated_at();

-- session_attendance ------------------------------------------------------------
-- One row per participant per session. Rows start EXPECTED when the session is
-- scheduled, so the register is complete before it happens rather than being
-- inferred afterwards from who was written down.
create table if not exists session_attendance (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references cohort_sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete restrict,
  status         attendance_status not null default 'EXPECTED',
  recorded_by    uuid references users(id),
  recorded_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint session_attendance_unique unique (session_id, participant_id),
  -- Anything other than the initial EXPECTED is a recorded decision by someone.
  constraint session_attendance_recorded_consistent
    check (status = 'EXPECTED' or recorded_at is not null)
);

create index if not exists session_attendance_session_idx on session_attendance (session_id);
create index if not exists session_attendance_participant_idx
  on session_attendance (participant_id);

drop trigger if exists session_attendance_set_updated_at on session_attendance;
create trigger session_attendance_set_updated_at before update on session_attendance
  for each row execute function set_updated_at();

-- Security: deny the Supabase API keys entirely --------------------------------
alter table session_templates   enable row level security;
alter table cohort_sessions     enable row level security;
alter table session_attendance  enable row level security;

revoke all on session_templates, cohort_sessions, session_attendance
  from anon, authenticated;
