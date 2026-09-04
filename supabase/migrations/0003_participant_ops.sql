-- =============================================================================
-- CLP Hub · Migration 0003 · Participant operations (Phase 2)
-- Tables: screenings, consents
-- Columns: participants.eligibility_status, participants.enrollment_status
--
-- CATEGORY C BOUNDARY (docs/research-data-boundaries.md)
--   Screening answers, instruments, scores, clinical notes and health history
--   are NOT stored here and no column exists to hold them. A screening row is
--   an appointment plus a staff-recorded eligibility result plus an opaque
--   reference to the approved system that holds the real record.
--   Neither table has a free-text notes column, deliberately.
--
-- Nothing in this migration computes eligibility. Staff record determinations
-- made elsewhere. Randomization is NOT part of this phase (D-017).
-- =============================================================================

-- Enums ----------------------------------------------------------------------
do $$ begin
  create type eligibility_status as enum (
    'PENDING','ELIGIBLE','INELIGIBLE','REVIEW_REQUIRED','WAITLIST'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum (
    'CONSENT_PENDING','ENROLLED','RANDOMIZED','COHORT_ASSIGNED','WITHDRAWN','COMPLETED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type screening_status as enum ('SCHEDULED','COMPLETED','NO_SHOW','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consent_status as enum (
    'PENDING','CONSENTED','DECLINED','WITHDRAWN','SUPERSEDED'
  );
exception when duplicate_object then null; end $$;

-- participants: two further independent status fields --------------------------
-- eligibility_status starts PENDING (nobody has looked yet).
-- enrollment_status is NULLABLE: null means "not in the enrollment pipeline",
-- which is a different statement from CONSENT_PENDING.
alter table participants
  add column if not exists eligibility_status eligibility_status not null default 'PENDING';

alter table participants
  add column if not exists enrollment_status enrollment_status;

create index if not exists participants_eligibility_idx
  on participants (study_id, eligibility_status);
create index if not exists participants_enrollment_idx
  on participants (study_id, enrollment_status) where enrollment_status is not null;

-- screenings -------------------------------------------------------------------
create table if not exists screenings (
  id                 uuid primary key default gen_random_uuid(),
  study_id           uuid not null references studies(id) on delete restrict,
  participant_id     uuid not null references participants(id) on delete restrict,
  status             screening_status not null default 'SCHEDULED',
  scheduled_at       timestamptz,
  completed_at       timestamptz,
  -- The eligibility determination recorded after the appointment. Null until a
  -- result exists. This is a RESULT, not a computation: nothing derives it.
  result             eligibility_status,
  -- Opaque pointer to the approved system holding the actual screening record.
  -- An identifier only; never a note, never a summary of what was said.
  external_record_id text,
  recorded_by        uuid references users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Only a completed screening may carry a result.
  constraint screenings_result_requires_completion
    check (result is null or status = 'COMPLETED'),
  -- A completed screening must say when.
  constraint screenings_completed_at_present
    check (status <> 'COMPLETED' or completed_at is not null),
  -- PENDING is not a result: it means "not determined", which is `null` here.
  constraint screenings_result_not_pending
    check (result is null or result <> 'PENDING'),
  -- Keep the reference an identifier rather than a prose field.
  constraint screenings_external_record_id_length
    check (external_record_id is null or length(external_record_id) <= 120)
);

create index if not exists screenings_study_idx
  on screenings (study_id, status, scheduled_at);
create index if not exists screenings_participant_idx
  on screenings (participant_id, created_at desc);

drop trigger if exists screenings_set_updated_at on screenings;
create trigger screenings_set_updated_at before update on screenings
  for each row execute function set_updated_at();

-- consents ---------------------------------------------------------------------
-- Historical: rows are superseded, never rewritten into a different decision.
create table if not exists consents (
  id                 uuid primary key default gen_random_uuid(),
  study_id           uuid not null references studies(id) on delete restrict,
  participant_id     uuid not null references participants(id) on delete restrict,
  status             consent_status not null default 'PENDING',
  -- Which consent form version, e.g. "PIS v2.1". A label, not a document.
  version_label      text not null,
  decided_at         timestamptz,
  -- Where the signed document actually lives. Not stored in this application.
  external_record_id text,
  recorded_by        uuid references users(id),
  superseded_by      uuid references consents(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint consents_version_label_length
    check (length(btrim(version_label)) between 1 and 60),
  -- A settled decision must say when it was made.
  constraint consents_decided_at_present
    check (status in ('PENDING') or decided_at is not null),
  -- Only a superseded row points at its replacement.
  constraint consents_superseded_consistent
    check ((status = 'SUPERSEDED') = (superseded_by is not null)),
  constraint consents_external_record_id_length
    check (external_record_id is null or length(external_record_id) <= 120)
);

-- At most one consent row per participant may be in force at a time.
create unique index if not exists consents_one_active_per_participant
  on consents (participant_id)
  where status in ('PENDING','CONSENTED');

create index if not exists consents_study_idx on consents (study_id, status);
create index if not exists consents_participant_idx
  on consents (participant_id, created_at desc);

drop trigger if exists consents_set_updated_at on consents;
create trigger consents_set_updated_at before update on consents
  for each row execute function set_updated_at();

-- Security: deny the Supabase API keys entirely --------------------------------
alter table screenings enable row level security;
alter table consents   enable row level security;

revoke all on screenings, consents from anon, authenticated;
