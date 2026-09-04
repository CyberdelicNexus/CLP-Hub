-- =============================================================================
-- CLP Hub · Migration 0002 · Recruitment (Phase 1)
-- Tables: participants, participant_contacts, applications,
--         application_questions, application_answers
--
-- Data boundaries (docs/research-data-boundaries.md):
--   Category A (operational identity) lives in participant_contacts and is
--   gated by the participants.contact.read permission.
--   Category C (research/clinical) MUST NOT be stored. In particular,
--   application_questions must never be configured to ask about health,
--   symptoms, diagnoses, medication or psychometrics (D-014).
--
-- Nothing here computes eligibility. Application status is an operational
-- triage state set by staff; eligibility arrives in Phase 2.
-- =============================================================================

-- Enums ----------------------------------------------------------------------
do $$ begin
  create type recruitment_status as enum (
    'INTERESTED','APPLICATION_STARTED','APPLICATION_SUBMITTED',
    'PRESCREEN','SCREENING_PENDING','SCREENING_SCHEDULED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum (
    'SUBMITTED','IN_REVIEW','ACCEPTED_FOR_SCREENING','NOT_PURSUED','WITHDRAWN'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_source as enum ('PUBLIC_FORM','STAFF_ENTRY','IMPORT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum (
    'SHORT_TEXT','LONG_TEXT','EMAIL','PHONE','SELECT','MULTI_SELECT','BOOLEAN','DATE'
  );
exception when duplicate_object then null; end $$;

-- Participant codes ------------------------------------------------------------
-- A sequence, not a per-study count, so concurrent submissions cannot collide.
-- Codes are the pseudonymous handle that survives erasure of contact data.
create sequence if not exists participant_code_seq as bigint start 1;

-- participants -----------------------------------------------------------------
create table if not exists participants (
  id                 uuid primary key default gen_random_uuid(),
  study_id           uuid not null references studies(id) on delete restrict,
  code               text not null,
  recruitment_status recruitment_status not null default 'INTERESTED',
  locale             ui_locale not null default 'es',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint participants_code_format check (code ~ '^P-[0-9]{6,}$'),
  constraint participants_code_unique unique (study_id, code)
);

create index if not exists participants_study_idx
  on participants (study_id, created_at desc);
create index if not exists participants_status_idx
  on participants (study_id, recruitment_status);

drop trigger if exists participants_set_updated_at on participants;
create trigger participants_set_updated_at before update on participants
  for each row execute function set_updated_at();

-- participant_contacts ---------------------------------------------------------
-- Category A only. Separated from participants so that reads can be gated by
-- participants.contact.read and so erasure can clear this row while operational
-- history keyed by participants.code survives (open item 2 in the boundaries doc).
--
-- study_id is denormalised from participants purely so the database itself can
-- enforce one contact email per study (the duplicate-linking rule, D-013).
create table if not exists participant_contacts (
  participant_id   uuid primary key references participants(id) on delete cascade,
  study_id         uuid not null references studies(id) on delete restrict,
  full_name        text,
  email            text,
  email_normalized text,
  phone            text,
  timezone         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint participant_contacts_email_present
    check (email is null or length(btrim(email)) > 0)
);

create unique index if not exists participant_contacts_email_unique
  on participant_contacts (study_id, email_normalized)
  where email_normalized is not null;

drop trigger if exists participant_contacts_set_updated_at on participant_contacts;
create trigger participant_contacts_set_updated_at before update on participant_contacts
  for each row execute function set_updated_at();

-- application_questions --------------------------------------------------------
-- Study configuration, not code. Labels are per locale; Spanish is required
-- because every participant-facing touchpoint must exist in Spanish (D-009).
create table if not exists application_questions (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references studies(id) on delete restrict,
  key         text not null,
  position    integer not null default 0,
  type        question_type not null,
  required    boolean not null default false,
  options     jsonb,
  label_es    text not null,
  label_en    text,
  help_es     text,
  help_en     text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint application_questions_key_format check (key ~ '^[a-z][a-z0-9_]{1,48}$'),
  constraint application_questions_key_unique unique (study_id, key),
  -- Choice questions need options; non-choice questions must not carry them.
  constraint application_questions_options_consistent check (
    (type in ('SELECT','MULTI_SELECT') and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) > 0)
    or (type not in ('SELECT','MULTI_SELECT') and options is null)
  )
);

create index if not exists application_questions_study_idx
  on application_questions (study_id, position) where active;

drop trigger if exists application_questions_set_updated_at on application_questions;
create trigger application_questions_set_updated_at before update on application_questions
  for each row execute function set_updated_at();

-- applications -----------------------------------------------------------------
create table if not exists applications (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  participant_id uuid not null references participants(id) on delete restrict,
  status         application_status not null default 'SUBMITTED',
  source         application_source not null default 'PUBLIC_FORM',
  locale         ui_locale not null default 'es',
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists applications_study_idx
  on applications (study_id, submitted_at desc);
create index if not exists applications_status_idx
  on applications (study_id, status, submitted_at desc);
create index if not exists applications_participant_idx
  on applications (participant_id, submitted_at desc);

drop trigger if exists applications_set_updated_at on applications;
create trigger applications_set_updated_at before update on applications
  for each row execute function set_updated_at();

-- application_answers ----------------------------------------------------------
-- `value` is jsonb because a MULTI_SELECT answer is an array while every other
-- type is a scalar. One answer per question per application.
create table if not exists application_answers (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  question_id    uuid not null references application_questions(id) on delete restrict,
  value          jsonb not null,
  created_at     timestamptz not null default now(),
  constraint application_answers_unique unique (application_id, question_id)
);

create index if not exists application_answers_application_idx
  on application_answers (application_id);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table participants          enable row level security;
alter table participant_contacts  enable row level security;
alter table application_questions enable row level security;
alter table applications          enable row level security;
alter table application_answers   enable row level security;

revoke all on participants, participant_contacts, application_questions,
              applications, application_answers
  from anon, authenticated;
revoke all on sequence participant_code_seq from anon, authenticated;
