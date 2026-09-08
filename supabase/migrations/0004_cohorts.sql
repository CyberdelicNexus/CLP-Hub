-- =============================================================================
-- CLP Hub · Migration 0004 · Cohorts and allocation (Phase 3a)
-- Tables: study_arms, cohorts, cohort_staff, participant_cohort_assignments,
--         randomizations
--
-- NO RANDOMIZATION ALGORITHM EXISTS HERE OR ANYWHERE IN THIS REPOSITORY.
-- `randomizations` records an allocation produced by an approved mechanism
-- outside this system, plus a reference to it (D-018). Nothing in the schema,
-- and nothing in application code, chooses an arm.
--
-- Per D-021 the application does NOT refuse to record an allocation on the
-- basis of consent or eligibility: staff record what happened, and the audit
-- row captures the participant's consent and eligibility state at that moment
-- so the record is complete and reviewable.
-- =============================================================================

do $$ begin
  create type cohort_status as enum (
    'PLANNING','RECRUITING','PREPARATION','ACTIVE','INTEGRATION','FOLLOW_UP','COMPLETED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type allocation_method as enum ('MANUAL_ENTRY');
exception when duplicate_object then null; end $$;

-- study_arms -------------------------------------------------------------------
-- Pure configuration. Arm names are rows so no trial specific reaches the code.
-- Deliberately no allocation ratio column: this system does not allocate, and a
-- ratio here would imply otherwise.
create table if not exists study_arms (
  id         uuid primary key default gen_random_uuid(),
  study_id   uuid not null references studies(id) on delete restrict,
  code       text not null,
  name_es    text not null,
  name_en    text,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_arms_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint study_arms_code_unique unique (study_id, code),
  constraint study_arms_name_length check (length(btrim(name_es)) between 1 and 120)
);

create index if not exists study_arms_study_idx on study_arms (study_id, position);

drop trigger if exists study_arms_set_updated_at on study_arms;
create trigger study_arms_set_updated_at before update on study_arms
  for each row execute function set_updated_at();

-- cohorts ----------------------------------------------------------------------
create table if not exists cohorts (
  id                 uuid primary key default gen_random_uuid(),
  study_id           uuid not null references studies(id) on delete restrict,
  code               text not null,
  name               text not null,
  status             cohort_status not null default 'PLANNING',
  planned_start_date date,
  planned_end_date   date,
  capacity           integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cohorts_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint cohorts_code_unique unique (study_id, code),
  constraint cohorts_name_length check (length(btrim(name)) between 1 and 120),
  constraint cohorts_capacity_positive check (capacity is null or capacity > 0),
  constraint cohorts_dates_ordered
    check (planned_start_date is null or planned_end_date is null
           or planned_end_date >= planned_start_date)
);

create index if not exists cohorts_study_idx on cohorts (study_id, status);

drop trigger if exists cohorts_set_updated_at on cohorts;
create trigger cohorts_set_updated_at before update on cohorts
  for each row execute function set_updated_at();

-- cohort_staff -----------------------------------------------------------------
-- Which staff run which cohort. Historical, like user_roles: revoked, never
-- deleted. This is also the narrowing used for cohort-scoped visibility: a
-- caller without cohorts.read.all sees only the cohorts they appear in here.
create table if not exists cohort_staff (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references cohorts(id) on delete restrict,
  user_id    uuid not null references users(id) on delete restrict,
  assigned_by uuid references users(id),
  assigned_at timestamptz not null default now(),
  revoked_by  uuid references users(id),
  revoked_at  timestamptz,
  constraint cohort_staff_revocation_consistent
    check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);

create unique index if not exists cohort_staff_active_unique
  on cohort_staff (cohort_id, user_id) where revoked_at is null;
create index if not exists cohort_staff_user_idx
  on cohort_staff (user_id) where revoked_at is null;

-- participant_cohort_assignments -----------------------------------------------
-- Historical membership: a participant leaving a cohort sets removed_at rather
-- than deleting the row, so the record of who was in which cohort survives.
create table if not exists participant_cohort_assignments (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  cohort_id      uuid not null references cohorts(id) on delete restrict,
  participant_id uuid not null references participants(id) on delete restrict,
  assigned_by    uuid references users(id),
  assigned_at    timestamptz not null default now(),
  removed_by     uuid references users(id),
  removed_at     timestamptz,
  constraint pca_removal_consistent
    check ((removed_at is null and removed_by is null) or removed_at is not null)
);

-- A participant belongs to at most one cohort at a time.
create unique index if not exists pca_one_active_per_participant
  on participant_cohort_assignments (participant_id) where removed_at is null;
create index if not exists pca_cohort_idx
  on participant_cohort_assignments (cohort_id) where removed_at is null;

-- randomizations ---------------------------------------------------------------
-- The recorded OUTCOME of an allocation made elsewhere. One per participant:
-- a second allocation for the same person is a data-integrity error, not a
-- clinical rule. Corrections are an open question (see docs/decisions.md).
create table if not exists randomizations (
  id                 uuid primary key default gen_random_uuid(),
  study_id           uuid not null references studies(id) on delete restrict,
  participant_id     uuid not null references participants(id) on delete restrict,
  arm_id             uuid not null references study_arms(id) on delete restrict,
  method             allocation_method not null default 'MANUAL_ENTRY',
  allocated_at       timestamptz not null,
  external_record_id text,
  recorded_by        uuid references users(id),
  created_at         timestamptz not null default now(),
  constraint randomizations_one_per_participant unique (participant_id),
  constraint randomizations_external_record_id_length
    check (external_record_id is null or length(external_record_id) <= 120)
);

create index if not exists randomizations_study_idx on randomizations (study_id, allocated_at desc);
create index if not exists randomizations_arm_idx on randomizations (arm_id);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table study_arms                     enable row level security;
alter table cohorts                        enable row level security;
alter table cohort_staff                   enable row level security;
alter table participant_cohort_assignments enable row level security;
alter table randomizations                 enable row level security;

revoke all on study_arms, cohorts, cohort_staff,
              participant_cohort_assignments, randomizations
  from anon, authenticated;
