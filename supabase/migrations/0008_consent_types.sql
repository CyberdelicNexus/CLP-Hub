-- =============================================================================
-- CLP Hub · Migration 0008 · Consent types and scopes (Phase 4b)
-- Tables: consent_scopes
-- Alters:  consents (consent_type, granted_scopes)
--          study_arms (requires_physical_consent)
--          REPLACES the index consents_one_active_per_participant
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The study has two consent moments, not one:
--
--   DIGITAL   accepted remotely in the screening platform, BEFORE any datum
--             about the person is collected — their name included (D-031).
--   PHYSICAL  signed in person at the initial visit, and the only one that can
--             carry extra authorizations such as an interview or appearing in
--             a documentary.
--
-- Migration 0003 permitted exactly ONE active consent per participant, which
-- makes holding both impossible. That index is therefore replaced by one scoped
-- per type.
--
-- ⚠ IMPACT, STATED PLAINLY. This is the one part of this change that relaxes an
-- existing guarantee:
--
--   Before: a participant could have at most one PENDING/CONSENTED consent row.
--   After:  at most one PENDING/CONSENTED row PER TYPE — so up to two.
--
--   That is the intended behaviour and the whole point of the change, but it
--   does mean the old invariant no longer holds. It is reversible: dropping the
--   new index and recreating the old one restores it, and no row is deleted or
--   rewritten by doing so.
--
--   Existing consent rows are backfilled to consent_type = 'DIGITAL'. Under
--   non-negotiable 9 every such row is synthetic, so no real decision is being
--   relabelled. If that ever stops being true, this backfill must be revisited
--   BEFORE the migration runs, because retyping a real consent is falsifying a
--   record of what a person agreed to.
--
-- NOTHING ELSE IS DESTRUCTIVE: new nullable-or-defaulted columns, one new table,
-- one enum. No row is deleted.
-- =============================================================================

-- Consent type -----------------------------------------------------------------
-- Deliberately generic: the screening platform's name is configuration, not a
-- value in this enum, so changing vendor is not a migration.
do $$ begin
  create type consent_type as enum ('DIGITAL','PHYSICAL');
exception when duplicate_object then null; end $$;

-- consents ---------------------------------------------------------------------
alter table consents add column if not exists consent_type consent_type
  not null default 'DIGITAL';
alter table consents add column if not exists granted_scopes text[]
  not null default '{}';

-- A remote tick-box accepted before the person has met anyone is not where you
-- agree to being filmed. Refused in the database, not merely in the form.
do $$ begin
  alter table consents add constraint consents_scopes_physical_only
    check (consent_type = 'PHYSICAL' or cardinality(granted_scopes) = 0);
exception when duplicate_object then null; end $$;

-- Scope entries are configuration CODES, not free text. Postgres cannot check
-- them against consent_scopes here — a CHECK constraint may not contain a
-- subquery — so the shape is constrained instead, and membership is verified in
-- the service inside the same transaction that writes the row. The shape check
-- is what stops the array becoming somewhere to type a sentence.
do $$ begin
  alter table consents add constraint consents_granted_scopes_shape
    -- Joined and matched as one string, because a CHECK constraint may not
    -- contain a subquery and therefore cannot unnest the array.
    check (
      cardinality(granted_scopes) <= 20
      and array_to_string(granted_scopes, ',')
          ~ '^([A-Z0-9][A-Z0-9_]{1,47})?(,[A-Z0-9][A-Z0-9_]{1,47})*$'
    );
exception when duplicate_object then null; end $$;

create index if not exists consents_type_idx on consents (participant_id, consent_type);

-- THE INDEX SWAP. Old invariant: one active consent per participant. New one:
-- one active consent per participant PER TYPE, so digital and physical can both
-- be in force. Dropping the old index removes no data and is reversible.
drop index if exists consents_one_active_per_participant;

create unique index if not exists consents_one_active_per_participant_type
  on consents (participant_id, consent_type)
  where status in ('PENDING','CONSENTED');

-- consent_scopes ---------------------------------------------------------------
-- Configuration. "Entrevista" and "documental" are one trial's plan; writing
-- them as boolean columns would put that plan into every study's schema
-- (non-negotiable 6). Scopes are deactivated, never deleted — a record of what
-- someone agreed to is not editable history.
create table if not exists consent_scopes (
  id           uuid primary key default gen_random_uuid(),
  study_id     uuid not null references studies(id) on delete restrict,
  code         text not null,
  label_es     text not null,
  label_en     text,
  consent_type consent_type not null default 'PHYSICAL',
  position     integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint consent_scopes_code_unique unique (study_id, code),
  constraint consent_scopes_code_shape check (code ~ '^[A-Z0-9][A-Z0-9_]{1,47}$'),
  constraint consent_scopes_label_length
    check (length(label_es) between 1 and 120
           and (label_en is null or length(label_en) <= 120)),
  -- Only an in-person signature carries these.
  constraint consent_scopes_physical_only check (consent_type = 'PHYSICAL')
);

create index if not exists consent_scopes_study_idx on consent_scopes (study_id, position);

drop trigger if exists consent_scopes_set_updated_at on consent_scopes;
create trigger consent_scopes_set_updated_at before update on consent_scopes
  for each row execute function set_updated_at();

-- study_arms -------------------------------------------------------------------
-- Which arms sign in person is a PROTOCOL matter, so it is configuration. The
-- application never decides that a control arm needs less than an experimental
-- one; it subtracts what is recorded from what is configured so a gap is
-- visible, and blocks nothing on the result (non-negotiable 3, and the same
-- reasoning as D-021).
alter table study_arms add column if not exists requires_physical_consent boolean
  not null default false;

-- Security: deny the Supabase API keys entirely --------------------------------
alter table consent_scopes enable row level security;

revoke all on consent_scopes from anon, authenticated;
